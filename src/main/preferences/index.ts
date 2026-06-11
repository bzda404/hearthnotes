import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import log from 'electron-log'
import { isWindows } from '../config'
import { hasSameKeys } from '../utils'
import { getSupportedLanguages, isLanguageSupported } from 'common/i18n'
import { TypedEmitter } from '@shared/types/typedEmitter'
import type { IUserPreferences } from '@shared/types/preferences'
import schema from './schema.json'

const PREFERENCES_FILE_NAME = 'preferences'

// The Preference class extends EventEmitter but does not currently emit any
// events itself — keep the event map empty until concrete events are added.
type PreferenceEvents = Record<string, unknown[]>

// Structural subset of EnvPaths/AppPaths — only `preferencesPath` is read here.
interface AppPaths {
  readonly preferencesPath: string
}

class Preference extends TypedEmitter<PreferenceEvents> {
  public readonly preferencesPath: string
  public readonly hasPreferencesFile: boolean
  private _data: Record<string, unknown>
  private _dirty = false
  private _writeTimer: ReturnType<typeof setTimeout> | null = null
  private readonly _filePath: string
  private readonly _schema: Record<string, unknown>
  public readonly staticPath: string

  /**
   * @param paths The path instance.
   */
  constructor(paths: AppPaths) {
    super()

    const { preferencesPath } = paths
    this.preferencesPath = preferencesPath
    this._filePath = path.join(preferencesPath, `./${PREFERENCES_FILE_NAME}.json`)
    this.hasPreferencesFile = fs.existsSync(this._filePath)
    this._schema = schema as Record<string, unknown>

    // Load existing data or initialize empty
    if (this.hasPreferencesFile) {
      try {
        this._data = JSON.parse(fs.readFileSync(this._filePath, 'utf-8'))
      } catch {
        this._data = {}
      }
    } else {
      this._data = {}
    }

    this.staticPath = path.join(global.__static, 'preference.json')
    this.init()
  }

  init = (): void => {
    let defaultSettings: Record<string, unknown> | null = null
    try {
      defaultSettings = JSON.parse(fs.readFileSync(this.staticPath, { encoding: 'utf8' }) || '{}')

      // Set best theme on first application start.
      if (nativeTheme.shouldUseDarkColors) {
        defaultSettings!.theme = 'dark'
      }

      // Set system language on first application start
      if (!this.hasPreferencesFile) {
        const systemLanguage = this._getSystemLanguage()
        if (systemLanguage) {
          defaultSettings!.language = systemLanguage
        }
      }
    } catch (err) {
      log.error(err)
    }

    if (!defaultSettings) {
      throw new Error('Can not load static preference.json file')
    }

    // I don't know why `this.store.size` is 3 when first load, so I just check file existed.
    if (!this.hasPreferencesFile) {
      this._data = { ...defaultSettings }
      this._scheduleWrite()
    } else {
      const userSetting = this.getAll() as Record<string, unknown>
      const requiresUpdate = !hasSameKeys(defaultSettings, userSetting)
      const userSettingKeys = Object.keys(userSetting)
      const defaultSettingKeys = Object.keys(defaultSettings)

      if (requiresUpdate) {
        // Remove outdated settings
        for (const key of userSettingKeys) {
          if (!defaultSettingKeys.includes(key)) {
            delete userSetting[key]
          }
        }

        // Add new setting options
        let addedNewEntries = false
        for (const key in defaultSettings) {
          if (!userSettingKeys.includes(key)) {
            addedNewEntries = true
            userSetting[key] = defaultSettings[key]
          }
        }
        if (addedNewEntries) {
          this._data = { ...userSetting }
          this._scheduleWrite()
        }
      }
    }

    this._listenForIpcMain()
  }

  getAll(): IUserPreferences {
    return this._data as unknown as IUserPreferences
  }

  setItem(key: string, value: unknown): void {
    this._data[key] = value
    this._scheduleWrite()
    ipcMain.emit('broadcast-preferences-changed', { [key]: value })
  }

  getItem<T = unknown>(key: string): T {
    return this._data[key] as T
  }

  /**
   * Change multiple setting entries.
   *
   * @param settings A settings object or subset object with key/value entries.
   */
  setItems(settings: Record<string, unknown> | null | undefined): void {
    if (!settings) {
      log.error('Cannot change settings without entires: object is undefined or null.')
      return
    }

    Object.keys(settings).forEach((key) => {
      this.setItem(key, settings[key])
    })
  }

  getPreferredEol(): 'lf' | 'crlf' {
    const endOfLine = this.getItem<string>('endOfLine')
    if (endOfLine === 'lf') {
      return 'lf'
    }
    return endOfLine === 'crlf' || isWindows ? 'crlf' : 'lf'
  }

  exportJSON(): void {
    // todo
  }

  importJSON(): void {
    // todo
  }

  _listenForIpcMain(): void {
    ipcMain.on('mt::ask-for-user-preference', (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (win) {
        win.webContents.send('mt::user-preference', this.getAll())
      }
    })
    ipcMain.on('mt::set-user-preference', (_e, settings: Record<string, unknown>) => {
      this.setItems(settings)
    })
    ipcMain.on('mt::cmd-toggle-autosave', () => {
      this.setItem('autoSave', !this.getItem('autoSave'))
    })

    // Note: dispatched via `ipcMain.emit(...)`. The payload arrives as the
    // first positional argument.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcMain.on('set-user-preference', (settings: any) => {
      this.setItems(settings as Record<string, unknown>)
    })
  }

  /**
   * Schedule a debounced async write of preferences to disk.
   * Batches multiple rapid changes into a single write.
   */
  private _scheduleWrite(): void {
    this._dirty = true
    if (this._writeTimer) return // Already scheduled
    this._writeTimer = setTimeout(async() => {
      this._writeTimer = null
      if (!this._dirty) return
      this._dirty = false
      await this._writeToDisk()
    }, 300)
  }

  private async _writeToDisk(): Promise<void> {
    try {
      const dir = path.dirname(this._filePath)
      await fsPromises.mkdir(dir, { recursive: true })
      const tmpPath = `${this._filePath}.${Math.random().toString(36).slice(2)}.tmp`
      await fsPromises.writeFile(tmpPath, JSON.stringify(this._data, null, 2), 'utf-8')
      await fsPromises.rename(tmpPath, this._filePath)
    } catch (err) {
      log.error('Failed to write preferences:', err)
    }
  }

  /**
   * Gets the system language, or null if it's not in the supported list
   * @returns Supported system language code or null
   */
  _getSystemLanguage(): string | null {
    try {
      // Get the system language
      const systemLocale = app.getLocale()
      log.info(`System locale detected: ${systemLocale}`)

      // Get the list of supported languages
      const supportedLanguages = getSupportedLanguages()

      // Directly match the full language code (e.g. zh-CN)
      if (isLanguageSupported(systemLocale)) {
        log.info(`Using system language: ${systemLocale}`)
        return systemLocale
      }

      // Attempt to match the primary part of the language (e.g. zh)
      const primaryLanguage = systemLocale.split('-')[0]!
      const matchedLanguage = supportedLanguages.find((lang) => lang.startsWith(primaryLanguage))

      if (matchedLanguage) {
        log.info(`Using matched language: ${matchedLanguage} for system locale: ${systemLocale}`)
        return matchedLanguage
      }

      log.info(`System language ${systemLocale} not supported, will use default language`)
      return null
    } catch (error) {
      log.error('Error detecting system language:', error)
      return null
    }
  }
}

export default Preference

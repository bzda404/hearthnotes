import { app } from 'electron'
import EnvPaths from 'common/envPaths'
import { ensureDirSync } from 'common/filesystem'

class AppPaths extends EnvPaths {
  /**
   * Configure and sets all application paths.
   *
   * @param userDataPath The user data path or empty string for default.
   */
  constructor(userDataPath: string = '') {
    if (!userDataPath) {
      // Use default user data path.
      userDataPath = app.getPath('userData')
    }

    // Initialize environment paths
    super(userDataPath)

    // Changing the user data directory is only allowed during application bootstrap.
    app.setPath('userData', this.electronUserDataPath)
  }
}

export const ensureAppDirectoriesSync = (paths: AppPaths): void => {
  ensureDirSync(paths.userDataPath)
  ensureDirSync(paths.logPath)
  ensureDirSync(paths.electronUserDataPath)
  ensureDirSync(paths.preferencesPath)
  // GlobalStorage and sessionsPath don't exist on EnvPaths yet.
  // When added, uncomment:
  // ensureDirSync(paths.globalStorage)
  // ensureDirSync(paths.sessionsPath)
}

export default AppPaths

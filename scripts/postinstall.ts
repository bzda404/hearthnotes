#!/usr/bin/env node
/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck
/**
 * Cross-platform postinstall for Hearthnotes (standalone repo).
 * Patches native-keymap for C++20, downloads Electron,
 * rebuilds native modules for Electron's ABI, generates locale files.
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const repoRoot = path.join(__dirname, '..')

function run(cmd, opts = {}) {
  const { cwd = repoRoot, env = {} } = opts
  execSync(cmd, { stdio: 'inherit', cwd, env: { ...process.env, ...env } })
}

const userAgent = process.env.npm_config_user_agent || ''
const isPnpm = userAgent.startsWith('pnpm')
const ext = process.platform === 'win32' ? '.cmd' : ''
const patchPackageBin = path.join(repoRoot, 'node_modules', '.bin', `patch-package${ext}`)
const electronRebuildBin = path.join(repoRoot, 'node_modules', '.bin', `electron-rebuild${ext}`)

// Skip native module operations in CI (no X11/xkbfile on Linux runners)
const isCI = !!process.env.CI


// ── 1. Ensure native-keymap source is present ──
const nativeKeymapDir = path.join(repoRoot, 'node_modules', 'native-keymap')
if (!isCI && !fs.existsSync(nativeKeymapDir)) {
  console.log('Installing native-keymap source (skipping compilation)...')
  if (isPnpm) {
    run('pnpm add native-keymap --ignore-scripts')
  } else {
    run('npm install native-keymap --ignore-scripts --no-save')
  }
}

// ── 2. Download + extract Electron binary ──
const electronInstall = path.join(repoRoot, 'node_modules', 'electron', 'install.js')

if (!fs.existsSync(electronInstall)) {
  console.error('electron/install.js not found — skipping Electron download')
} else {
  const os = require('os')
  const plat =
    process.env.ELECTRON_INSTALL_PLATFORM || process.env.npm_config_platform || os.platform()
  const platformBinary =
    plat === 'win32'
      ? 'electron.exe'
      : plat === 'darwin' || plat === 'mas'
        ? 'Electron.app/Contents/MacOS/Electron'
        : 'electron'

  const pathTxt = path.join(repoRoot, 'node_modules', 'electron', 'path.txt')
  const distDir = path.join(repoRoot, 'node_modules', 'electron', 'dist')

  const isComplete = () => {
    if (!fs.existsSync(pathTxt)) return false
    const rel = fs.readFileSync(pathTxt, 'utf8').trim()
    if (!fs.existsSync(path.join(repoRoot, 'node_modules', 'electron', rel))) return false
    if (plat === 'darwin' || plat === 'mas') {
      return fs.existsSync(path.join(distDir, 'Electron.app', 'Contents', 'Frameworks'))
    }
    return true
  }

  if (!isComplete()) {
    if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true })
    if (fs.existsSync(pathTxt)) fs.unlinkSync(pathTxt)

    console.log('Downloading Electron binary...')
    try {
      run(`node "${electronInstall}"`)
    } catch {
      const mirror = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/'
      console.log(`Direct download failed, retrying with mirror: ${mirror}`)
      run(`node "${electronInstall}"`, { env: { ELECTRON_MIRROR: mirror } })
    }

    if (
      (plat === 'darwin' || plat === 'mas') &&
      !fs.existsSync(path.join(distDir, 'Electron.app', 'Contents', 'Frameworks'))
    ) {
      const { version } = require(path.join(repoRoot, 'node_modules', 'electron', 'package.json'))
      const arch = process.env.npm_config_arch || os.arch()
      const zipName = `electron-v${version}-darwin-${arch === 'arm64' ? 'arm64' : 'x64'}.zip`
      const cacheRoot =
        process.env.electron_config_cache ||
        path.join(os.homedir(), 'Library', 'Caches', 'electron')

      let zipPath = ''
      try {
        zipPath = execSync(`find "${cacheRoot}" -name "${zipName}" 2>/dev/null | head -1`)
          .toString()
          .trim()
      } catch {
        /* ignore */
      }

      if (!zipPath) {
        throw new Error(
          'Electron zip not in cache after download. ' +
            'Try: ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install'
        )
      }

      console.log(`Re-extracting with system unzip...`)
      if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true })
      run(`unzip -q "${zipPath}" -d "${distDir}"`)
      fs.writeFileSync(pathTxt, platformBinary)
      fs.writeFileSync(path.join(distDir, 'version'), version)
    }

    if (!fs.existsSync(pathTxt)) {
      fs.writeFileSync(pathTxt, platformBinary)
    }
  }
}

// ── 3. Apply C++20 patch to native-keymap ──
console.log('Applying patches...')
run(`"${patchPackageBin}"`)

// ── 4. Rebuild native modules for Electron ABI ──
if (isCI) {
  console.log('Skipping native module rebuild in CI environment')
} else {
  console.log('Rebuilding native modules for Electron...')
  run(`"${electronRebuildBin}" -f`)
}

// ── 5. Generate minified locale files ──
console.log('Minifying locales...')
run('pnpm tsx scripts/minify-locales.ts')

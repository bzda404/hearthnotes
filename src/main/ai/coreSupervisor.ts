/**
 * MindVault Core supervisor.
 *
 * Notes first tries to connect to the local UDS Core. If it is not running,
 * the supervisor starts the Core process and waits for the socket
 * to become ready.
 */
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { app } from 'electron'
import { udsClient } from './udsClient'

export interface CoreSupervisorStatus {
  running: boolean
  startedByNote: boolean
  pid: number | null
  error: string | null
}

interface StartCommand {
  command: string
  args: string[]
  cwd: string
}

let coreProcess: ChildProcess | null = null
let lastError: string | null = null

export async function ensureCoreRunning(timeoutMs = 8000): Promise<boolean> {
  if (await udsClient.connect()) {
    lastError = null
    return true
  }

  if (!coreProcess || coreProcess.killed || coreProcess.exitCode !== null) {
    const command = resolveCoreStartCommand()
    if (!command) {
      lastError = '未找到可启动的 MindVault Core'
      return false
    }
    coreProcess = spawn(command.command, command.args, {
      cwd: command.cwd,
      stdio: 'ignore',
      detached: true,
      env: {
        ...process.env,
        MINDVAULT_CORE_BACKGROUND: '1',
      },
    })
    coreProcess.unref()
    coreProcess.once('error', (err) => {
      lastError = err.message
    })
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await udsClient.connect()) {
      lastError = null
      return true
    }
    await sleep(250)
  }

  lastError ||= '等待 MindVault Core UDS socket 就绪超时'
  return false
}

export function getCoreSupervisorStatus(): CoreSupervisorStatus {
  const running = udsClient.isConnected()
  return {
    running,
    startedByNote: !!coreProcess && coreProcess.exitCode === null && !coreProcess.killed,
    pid: coreProcess?.pid ?? null,
    error: lastError,
  }
}

export async function shutdownCoreSupervisor(): Promise<void> {
  if (!coreProcess || coreProcess.killed || coreProcess.exitCode !== null) return
  coreProcess.kill()
  coreProcess = null
}

function resolveCoreStartCommand(): StartCommand | null {
  // In standalone mode, only support packaged Hearth Core
  return resolvePackagedCoreCommand()
}



function resolvePackagedCoreCommand(): StartCommand | null {
  if (!app.isPackaged) return null

  if (process.platform === 'darwin') {
    const appPath = join(process.resourcesPath, 'MindVault Core.app', 'Contents', 'MacOS', 'MindVault Core')
    if (!existsSync(appPath)) return null
    return { command: appPath, args: ['--background'], cwd: process.resourcesPath }
  }

  const executable = process.platform === 'win32' ? 'MindVault Core.exe' : 'mindvault-core'
  const command = join(process.resourcesPath, executable)
  if (!existsSync(command)) return null
  return { command, args: ['--background'], cwd: process.resourcesPath }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

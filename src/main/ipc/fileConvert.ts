/**
 * File Converter IPC handlers — main process side.
 */
import { ipcMain } from 'electron'
import { convertFile } from '../filesystem/fileConverter'

export const registerFileConvertHandlers = (): void => {
  ipcMain.handle('mt::fileConvert::convert', async(_event, filePath: string, outputDir?: string) => {
    try {
      const result = await convertFile(filePath, { outputDir })
      return result.outputPath
    } catch (err) {
      console.error('[FileConvert] Conversion failed:', err)
      throw err
    }
  })
}

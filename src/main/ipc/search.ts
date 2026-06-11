import { ipcMain } from 'electron'
import { buildKnowledgeBaseIndex, indexBuilder, searchKnowledgeBases } from '../search'

export const registerSearchHandlers = (): void => {
  ipcMain.handle(
    'mt::search::bm25',
    async(_event, query: string, kbName?: string) => {
      return searchKnowledgeBases(query, kbName, 20, true)
    }
  )

  ipcMain.handle(
    'mt::search::build-index',
    async(_event, kbPath: string, kbName: string) => {
      await buildKnowledgeBaseIndex(kbPath, kbName)
    }
  )
}

export { indexBuilder }

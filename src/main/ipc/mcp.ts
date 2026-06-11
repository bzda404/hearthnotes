/**
 * MCP IPC 处理器
 */
import { ipcMain } from 'electron'
import { handleDecision } from '../mcp/privacyInterceptor'
import { getKnowledgeBasePath, setKnowledgeBasePath } from '../mcp/handlers'
import { clearPrivacyAuditLog, ensurePrivacyAuditLogLoaded, getMCPTelemetry } from '../mcp/telemetry'
import type { PrivacyDecision, MCPServerStatus } from '@shared/types/mcpTypes'

export const registerMCPHandlers = (): void => {
  // 状态查询
  ipcMain.handle('mt::mcp::status', async(): Promise<MCPServerStatus> => {
    await ensurePrivacyAuditLogLoaded()
    return {
      running: true, // MCP server 总是通过 stdio 运行
      transport: 'stdio',
      port: null,
      connectedClients: 0,
      knowledgeBasePath: getKnowledgeBasePath(),
      telemetry: getMCPTelemetry(),
    }
  })

  ipcMain.handle('mt::mcp::set-knowledge-base', async(_event, path: string): Promise<void> => {
    setKnowledgeBasePath(path)
  })

  ipcMain.handle('mt::mcp::clear-audit-log', async(): Promise<MCPServerStatus> => {
    await clearPrivacyAuditLog()
    return {
      running: true,
      transport: 'stdio',
      port: null,
      connectedClients: 0,
      knowledgeBasePath: getKnowledgeBasePath(),
      telemetry: getMCPTelemetry(),
    }
  })

  // 隐私决策
  ipcMain.handle('mt::mcp::privacy-decision', async(_event, decision: PrivacyDecision) => {
    handleDecision(decision.requestId, decision.allowed, decision.desensitize)
  })
}

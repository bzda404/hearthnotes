/**
 * MCP Server — stdio-only 传输，JSON-RPC 2.0
 * 日志严格输出到 stderr，数据流走 stdout
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  setKnowledgeBasePath,
  handleSearchNotes,
  handleReadNote,
  handleListNotes,
  handleWriteNote,
  handleGetContext,
} from './handlers'
import { desensitizeSync } from '../ai/desensitizer'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

let mcpServer: Server | null = null
let transport: StdioServerTransport | null = null

const PREVIEW_LIMIT = 1200

export function createMCPServer(): Server {
  const server = new Server(
    { name: 'aincore', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } }
  )

  // 注册工具列表
  server.setRequestHandler(ListToolsRequestSchema, async() => ({
    tools: [
      {
        name: 'search_notes',
        description: '搜索知识库中的笔记',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: '搜索关键词' },
            kb: { type: 'string', description: '限定知识库名称' },
            limit: { type: 'number', description: '最大结果数' },
          },
          required: ['query'],
        },
      },
      {
        name: 'read_note',
        description: '读取指定笔记的内容',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: '笔记文件绝对路径' },
          },
          required: ['path'],
        },
      },
      {
        name: 'list_notes',
        description: '列出知识库中的所有笔记',
        inputSchema: {
          type: 'object' as const,
          properties: {
            kb: { type: 'string', description: '知识库名称' },
            recursive: { type: 'boolean', description: '是否递归子目录' },
          },
          required: ['kb'],
        },
      },
      {
        name: 'write_note',
        description: '写入或创建笔记',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: '笔记文件绝对路径' },
            content: { type: 'string', description: 'Markdown 内容' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'get_context',
        description: '获取笔记内容（可指定行范围）',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: '笔记文件绝对路径' },
            range: {
              type: 'array',
              items: { type: 'number' },
              description: '行范围 [start, end]（从1开始）',
            },
          },
          required: ['path'],
        },
      },
    ],
  }))

  // 注册工具调用处理器（带隐私拦截）
  server.setRequestHandler(CallToolRequestSchema, async(request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params
    // 所有工具调用都经过隐私拦截
    const result = await callToolWithPrivacy(name, args as Record<string, unknown>, 'MCP Client')
    return result as CallToolResult
  })

  // 注册资源列表
  server.setRequestHandler(ListResourcesRequestSchema, async() => ({
    resources: [
      {
        uri: 'aincore://kb',
        name: '知识库列表',
        description: '列出所有可用知识库',
        mimeType: 'application/json',
      },
    ],
  }))

  // 注册资源读取
  server.setRequestHandler(ReadResourceRequestSchema, async(request) => {
    const uri = request.params.uri
    if (uri === 'aincore://kb') {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ message: '请使用 list_notes 工具浏览知识库' }),
        }],
      }
    }
    return { contents: [] }
  })

  return server
}

/**
 * 带隐私拦截的工具调用
 */
export async function callToolWithPrivacy(
  name: string,
  args: Record<string, unknown>,
  clientName: string
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const previewData = await buildPrivacyPreview(name, args, clientName)

  // 隐私拦截（Promise 挂起，等待用户决策）
  const { interceptRequest } = await import('./privacyInterceptor')
  const result = await interceptRequest(name, args, clientName, undefined, previewData)

  if (!result.allowed) {
    return {
      content: [{ type: 'text', text: 'Access denied by user' }],
      isError: true,
    }
  }

  // 执行实际工具
  let toolResult: { content: Array<{ type: 'text'; text: string }>; isError?: boolean }
  switch (name) {
    case 'search_notes':
      toolResult = await handleSearchNotes(args, clientName)
      break
    case 'read_note':
      toolResult = await handleReadNote(args, clientName)
      break
    case 'list_notes':
      toolResult = await handleListNotes(args, clientName)
      break
    case 'write_note':
      toolResult = await handleWriteNote(args, clientName)
      break
    case 'get_context':
      toolResult = await handleGetContext(args, clientName)
      break
    default:
      return { content: [{ type: 'text', text: `未知工具: ${name}` }], isError: true }
  }

  // 如果用户选择了"脱敏后传输"，对结果文本进行脱敏处理
  if (result.desensitize && !toolResult.isError) {
    toolResult = {
      content: toolResult.content.map((item) => {
        if (item.type === 'text') {
          const preview = desensitizeSync(item.text)
          return { type: 'text' as const, text: preview.masked }
        }
        return item
      }),
    }
  }

  return toolResult
}

export async function buildPrivacyPreview(
  name: string,
  args: Record<string, unknown>,
  clientName: string
): Promise<string> {
  try {
    let previewResult: { content: Array<{ type: 'text'; text: string }>; isError?: boolean } | null = null

    switch (name) {
      case 'search_notes':
        previewResult = await handleSearchNotes({ ...args, limit: Math.min(Number(args.limit || 5), 5) }, clientName)
        break
      case 'read_note':
        previewResult = await handleReadNote(args, clientName)
        break
      case 'list_notes':
        previewResult = await handleListNotes(args, clientName)
        break
      case 'get_context':
        previewResult = await handleGetContext(args, clientName)
        break
      case 'write_note':
        return [
          `写入文件: ${String(args.path || '')}`,
          '',
          String(args.content || ''),
        ].join('\n').slice(0, PREVIEW_LIMIT)
      default:
        return JSON.stringify(args, null, 2).slice(0, PREVIEW_LIMIT)
    }

    if (!previewResult || previewResult.isError) {
      return JSON.stringify(args, null, 2).slice(0, PREVIEW_LIMIT)
    }

    return previewResult.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n')
      .slice(0, PREVIEW_LIMIT)
  } catch {
    return JSON.stringify(args, null, 2).slice(0, PREVIEW_LIMIT)
  }
}

/**
 * 启动 MCP 服务器（stdio 传输）
 */
export async function startMCPServer(kbPath?: string): Promise<void> {
  if (mcpServer) return

  if (kbPath) setKnowledgeBasePath(kbPath)

  mcpServer = createMCPServer()
  transport = new StdioServerTransport()

  try {
    await mcpServer.connect(transport)
    // 日志输出到 stderr，不污染 stdout 的 JSON-RPC 数据流
    process.stderr.write('[MCP] Server started with stdio transport\n')
  } catch (err) {
    process.stderr.write(`[MCP] Failed to start: ${err}\n`)
    mcpServer = null
    transport = null
  }
}

export async function stopMCPServer(): Promise<void> {
  if (transport) {
    await transport.close()
    transport = null
  }
  mcpServer = null
}

export function isMCPServerRunning(): boolean {
  return mcpServer !== null
}

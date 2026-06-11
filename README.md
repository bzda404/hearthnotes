# Hearthnotes

> 基于本地 AI 的知识管理应用

Hearthnotes 是一个本地优先的知识管理工具，基于 [Hearth](https://github.com/bzda404/hearth) 平台的 AI 能力构建。它提供所见即所得的 Markdown 编辑器、BM25 全文搜索、MCP 协议支持和 AI 辅助写作功能，所有数据存储在本地，不依赖云端服务。

**状态：Release Candidate (v1.0.0-rc.1)**

## 功能

- **Markdown 编辑器** — 所见即所得编辑，支持 GFM、数学公式（KaTeX）、Mermaid 图表、代码高亮等
- **AI 辅助写作** — 自动补全、文本续写、语法纠正、智能摘要，通过 Hearth 本地模型驱动
- **BM25 搜索** — 基于 jieba 分词的全文检索，配合 RRF 融合排序提供高质量搜索结果
- **MCP 协议** — 实现 [Model Context Protocol](https://modelcontextprotocol.io/) stdio 服务端，可作为外部 AI 工具的知识源
- **隐私保护** — PII 脱敏、审计日志、同意门控，数据始终留在你的设备上
- **文件管理** — 树形目录浏览、拖拽排序、多种文件格式导入导出（PDF、DOCX、HTML 等）
- **多主题** — 内置明暗主题，支持自定义 CSS

## 技术栈

| 组件 | 技术 |
|---|---|
| 运行时 | Electron 38 + Node.js 22 |
| 前端 | Vue 3 + Element Plus + Pinia |
| 编辑器引擎 | muyajs（基于 Snabbdom 的 Markdown 渲染） |
| 搜索引擎 | BM25 + jieba 分词 + RRF 融合排序 |
| MCP | @modelcontextprotocol/sdk (stdio transport) |
| AI 通信 | @mindvault/sdk → Hearth UDS JSON-RPC |
| 构建 | electron-vite 5 + electron-builder 26 |
| 语言 | TypeScript 5.9 (strict) |

## 安装

### 前置条件

Hearthnotes 需要 [Hearth](https://github.com/bzda404/hearth) 在后台运行，以提供 AI 模型服务。请先安装并启动 Hearth。

### 从源码构建

```bash
git clone https://github.com/bzda404/hearthnotes.git
cd hearthnotes
pnpm install
pnpm dev          # 开发模式（需先启动 Hearth）
pnpm build:mac    # 构建 macOS 安装包
pnpm build:linux  # 构建 Linux 安装包
pnpm build:win    # 构建 Windows 安装包
```

### 使用预构建包

前往 [Releases](https://github.com/bzda404/hearthnotes/releases) 页面下载对应平台的安装包。

## 开发

```bash
# 先确保 Hearth 已在运行
pnpm dev          # 启动开发服务器
pnpm test         # 运行单元测试 (Vitest, 644 tests)
pnpm typecheck    # TypeScript 类型检查
pnpm lint         # ESLint 代码检查
```

## 项目结构

```
hearthnotes/
├── src/
│   ├── main/
│   │   ├── ai/           AI 服务（通过 @mindvault/sdk 连接 Hearth）
│   │   ├── mcp/          MCP 协议服务端 + 隐私拦截
│   │   ├── search/       BM25 索引 + RRF 融合搜索
│   │   ├── ipc/          IPC 处理器（AI、MCP、搜索、文件系统等）
│   │   └── index.ts      Electron 主进程入口
│   ├── renderer/
│   │   └── src/
│   │       ├── store/    Pinia 状态管理（AI、知识库、MCP）
│   │       ├── views/    页面（编辑器、设置、模型管理）
│   │       └── components/  UI 组件
│   └── shared/           共享类型定义
└── lib/
    └── muyajs/           Markdown 编辑器引擎
```

## 许可证

[MIT](LICENSE) — 部分代码源自 [MarkText](https://github.com/marktext/marktext)。

## 致谢

本项目的 Markdown 编辑器基于 MarkText 的 muya 引擎开发。感谢 MarkText 社区的贡献。

## 相关链接

- [Hearth](https://github.com/bzda404/hearth) — 本地 AI 算力平台
- [@mindvault/sdk](https://github.com/bzda404/mindvault-sdk) — 接入 Hearth 的 TypeScript SDK

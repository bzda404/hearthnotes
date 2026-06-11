# AinCore Notes

> 本地 AI 驱动的知识管理应用

AinCore Notes 是一个本地优先的知识管理工具，基于 [AinCore](https://github.com/bzda404/aincore) 平台的本地大语言模型能力构建。它提供所见即所得的 Markdown 编辑器、三层搜索管线（BM25 → RRF 融合 → 1B 语义重排序）、MCP 协议服务端和 AI 辅助写作功能。所有数据和 AI 推理均在本地完成，不依赖云端服务。

**状态：Release Candidate (v1.0.0-rc.2)**

## 核心特性

### Markdown 编辑器

- **所见即所得编辑** — 基于 Muya 引擎（源自 MarkText）的块级编辑器，Snabbdom VDOM 渲染
- **丰富的内容支持** — GFM 表格、KaTeX 数学公式、Mermaid / flowchart.js / Vega 图表、Prism.js 代码高亮
- **源代码模式** — CodeMirror 5 提供语法高亮的纯文本编辑
- **文件导入** — 支持 8 种格式转换为 Markdown：PDF（pdfjs-dist）、DOCX（mammoth + turndown）、XLSX（xlsx）、PPTX（jszip XML 提取）、HTML（turndown）、CSV、TXT、RTF/ODT/EPUB
- **文件导出** — PDF、HTML、styled HTML、PNG、JPEG（通过 Electron 打印管线）
- **拖拽与剪贴板** — 文件拖拽转换、图片粘贴上传（支持 PicGo）

### AI 辅助写作

- **智能补全** — 编辑时实时生成 Ghost Text 补全建议，Tab 键接受（温度 0.2，最大 64 tokens）
- **语法纠错** — 中英文语法检查，JSON 结构化输出 + 增量 JSON 修复状态机处理不完整响应
- **智能摘要** — 文档自动摘要（可配置长度，输入截断至 2000 字符）
- **笔记整理建议** — 基于标题和目录结构分析，推荐文件夹分组方案
- **AI 对话面板** — 右侧 360px 侧边面板，支持流式对话和上下文感知交互
- **三层 AI 韧性** — 主路径（@aincore/sdk OAuth）→ 备用路径（直连 UDS）→ 离线降级（纯正则脱敏）
- **OAuth 2.0 PKCE 连接** — 通过 @aincore/sdk 自动完成 AinCore 授权注册，Token 自动刷新，断线指数退避重连（最多 10 次）

### 搜索引擎

- **BM25 稀疏检索** — 基于 jieba-wasm 中文分词的倒排索引（k1=1.2, b=0.75），支持磁盘缓存（24 小时 TTL）和增量更新
- **RRF 融合排序** — 跨多个知识库并行查询，Reciprocal Rank Fusion（k=60）合并排序
- **1B 模型语义重排序** — 对 Top-10 候选使用轻量模型生成 YES/NO 判断，YES 分数 ×2、NO 分数 ×0.3
- **实时索引** — chokidar 文件监听 + 500ms 防抖的增量索引更新

### MCP 协议服务端

- **5 个工具注册** — `search_notes`（BM25 搜索）、`read_note`（读取笔记）、`list_notes`（目录列表）、`write_note`（写入笔记）、`get_context`（行范围上下文）
- **1 个资源注册** — `aincore://kb` 知识库资源
- **Stdio 传输** — JSON-RPC 2.0 on stdout，可被任意外部 AI 客户端作为知识源调用
- **路径沙箱** — 所有文件操作限制在知识库根目录内，`isPathInsideKnowledgeBase()` 防止路径穿越

### 隐私拦截器 (Privacy Interceptor)

- **Promise 挂起机制** — 外部 MCP 工具调用被异步挂起，直到用户做出隐私决策
- **三种决策** — 允许、拒绝、允许并脱敏（PII 遮蔽后再传输）
- **PII 预览** — 弹窗展示检测到的敏感信息预览（邮箱、身份证、银行卡、手机号）
- **AI 辅助 NER** — 当 AinCore 可用时，使用 NER 提示检测正则无法覆盖的 PII（姓名、地址等）
- **NDJSON 审计日志** — 所有决策持久化到 `{userData}/mcp-audit-log.jsonl`，支持 UI 筛选和清空
- **超时自动拒绝** — 可配置超时（默认 60 秒），防止授权挂起

### 文件管理

- **树形目录** — 知识库文件浏览器，支持拖拽排序、重命名、复制/剪切/粘贴
- **多格式支持** — PDF、DOCX、XLSX、PPTX、HTML、CSV、TXT、RTF、ODT、EPUB 导入
- **Ripgrep 集成** — @vscode/ripgrep 驱动的全局文本搜索，支持正则、大小写、glob 过滤、上下文行

## 技术栈

| 组件 | 技术 |
|---|---|
| 运行时 | Electron 38 + Node.js 22 |
| 前端 | Vue 3.5 + Element Plus + Pinia + vue-i18n |
| 编辑器引擎 | Muya（Snabbdom VDOM + CodeMirror 5 源代码模式） |
| 搜索引擎 | BM25 + jieba-wasm 分词 + RRF 融合排序 + 1B 语义重排序 |
| MCP 服务 | @modelcontextprotocol/sdk（stdio transport，5 tools + 1 resource） |
| AI 通信 | @aincore/sdk → AinCore UDS JSON-RPC（OAuth 2.0 PKCE） |
| 文件转换 | pdfjs-dist, mammoth, turndown, xlsx, jszip |
| 构建 | electron-vite 5 + electron-builder 26 |
| 测试 | Vitest（644 个测试） + Playwright E2E |
| 语言 | TypeScript 5.9 (strict) |

## 安装

### 前置条件

AinCore Notes 需要 [AinCore](https://github.com/bzda404/aincore) 在后台运行以提供 AI 模型服务。请先安装并启动 AinCore。

### 从源码构建

```bash
git clone https://github.com/bzda404/aincore-notes.git
cd aincore-notes
pnpm install
pnpm dev          # 开发模式（需先启动 AinCore）
pnpm build:mac    # 构建 macOS 安装包
pnpm build:linux  # 构建 Linux 安装包
pnpm build:win    # 构建 Windows 安装包
```

### 使用预构建包

前往 [Releases](https://github.com/bzda404/aincore-notes/releases) 页面下载对应平台的安装包。

## 开发

```bash
# 先确保 AinCore 已在运行
pnpm dev          # 启动开发服务器
pnpm test         # 运行单元测试 (Vitest)
pnpm test:e2e     # 运行 E2E 测试 (Playwright)
pnpm typecheck    # TypeScript 类型检查
pnpm lint         # ESLint 代码检查
```

## 项目结构

```
aincore-notes/
├── src/
│   ├── main/
│   │   ├── ai/           AI 服务层
│   │   │   ├── coreBridge.ts      @aincore/sdk OAuth 2.0 PKCE 通信网关
│   │   │   ├── desensitizer.ts    PII 检测与脱敏（正则 + AI NER）
│   │   │   ├── jsonRepair.ts      增量 JSON 修复状态机（处理不完整 LLM 输出）
│   │   │   └── schemaValidator.ts AI 输出校验（去角色标签/代码围栏/尾逗号）
│   │   ├── mcp/          MCP 协议层
│   │   │   ├── server.ts          stdio MCP 服务端（5 tools + 1 resource）
│   │   │   ├── handlers.ts        工具处理器（路径沙箱隔离）
│   │   │   ├── privacyInterceptor.ts  Promise 挂起式隐私拦截器
│   │   │   └── telemetry.ts       NDJSON 审计日志 + RAG 遥测
│   │   ├── search/       搜索引擎
│   │   │   ├── bm25Index.ts       BM25 倒排索引（jieba 分词）
│   │   │   ├── indexBuilder.ts    索引构建器（磁盘缓存 + 增量更新）
│   │   │   ├── federatedSearch.ts RRF 跨知识库融合排序
│   │   │   └── reranker.ts        1B 模型语义重排序
│   │   ├── ipc/          IPC 处理器（14 模块，100+ 通道）
│   │   ├── filesystem/   文件操作 + 格式转换（8 种格式）
│   │   └── index.ts      Electron 主进程入口
│   ├── renderer/
│   │   └── src/
│   │       ├── store/    Pinia 状态管理（15 个 store）
│   │       ├── views/    页面（工作区、模型管理、偏好设置）
│   │       └── components/  UI 组件（AI 面板、隐私拦截器、文件树）
│   └── shared/           共享类型（60+ IPC 通道类型、AI/MCP 接口）
└── lib/
    └── muyajs/           Muya 编辑器引擎（本地 vendor）
```

## 许可证

[MIT](LICENSE) — 部分代码源自 [MarkText](https://github.com/marktext/marktext)。

## 致谢

本项目的 Markdown 编辑器基于 MarkText 的 Muya 引擎开发。感谢 MarkText 社区的贡献。

## 生态

| 项目 | 说明 |
|---|---|
| [AinCore](https://github.com/bzda404/aincore) | 本地 AI 计算平台核心枢纽（llama.cpp 推理 + OAuth 授权 + 隐私哨兵） |
| [@aincore/sdk](https://github.com/bzda404/aincore-cdk) | 接入 AinCore 的 TypeScript SDK（OAuth 2.0 PKCE + UDS JSON-RPC） |

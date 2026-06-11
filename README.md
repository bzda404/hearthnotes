# AinCore Notes

> AI 驱动的本地知识管理应用 — 所见即所得编辑 + 智能搜索 + MCP 协议

AinCore Notes 是一个本地优先的知识管理工具，基于 [AinCore](https://github.com/bzda404/aincore) 平台的本地大语言模型能力构建。它提供基于 MuyaJS 的块级所见即所得 Markdown 编辑器、三层搜索管线（BM25 → RRF 融合 → 1B 语义重排序）、MCP 协议服务端和 AI 辅助写作功能。所有数据和 AI 推理均在本地完成，不依赖云端服务。

**状态：Release Candidate (v1.0.0-rc.2)**

## 核心特性

### Markdown 编辑器 (MuyaJS)

基于 MarkText Muya 引擎的块级 VDOM 编辑器，Snabbdom 虚拟 DOM 渲染：

- **所见即所得编辑** — 27 个 ContentState 原型混入覆盖全部编辑操作（段落、列表、表格、代码块、引用、数学公式等）
- **30+ 内联渲染器** — 自动链接、强调、删除线、高亮、脚注、HTML 标签、图片、行内数学公式等
- **源代码模式** — CodeMirror 5 语法高亮编辑，Railscasts 主题，fuzzaldrin 模糊语言搜索
- **丰富内容支持** — KaTeX 数学公式、Mermaid / flowchart.js / PlantUML / Vega 图表、Prism.js 代码高亮、GFM 表格
- **8 种格式导入** — PDF（pdfjs-dist）、DOCX（mammoth + turndown）、XLSX、PPTX（jszip）、HTML、CSV、TXT、RTF/ODT/EPUB
- **多格式导出** — PDF · HTML · styled HTML · PNG · JPEG（Electron 打印管线，A3/A4/A5/Legal/Letter 页面尺寸）

### AI 辅助写作

通过 @aincore/sdk 连接本地大模型，提供四项 AI 能力：

- **智能补全** — 编辑时实时生成 Ghost Text 补全建议（`max_tokens: 64`, `temperature: 0.2`），Tab 键接受，输出自动去代码围栏和角色标签
- **语法纠错** — 中英文双语 few-shot Prompt，JSON 结构化输出 + `IncrementalJsonRepair` 状态机处理不完整响应（最多 2 次重试）
- **智能摘要** — 可配置长度（默认 150 字符），输入截断至 2000 字符，`temperature: 0.3`
- **笔记整理建议** — 基于标题和目录结构分析，推荐文件夹分组方案（`max_tokens: 1024`, `temperature: 0.4`）
- **AI 对话面板** — 右侧 360px 侧边面板，支持流式对话和上下文感知交互

**三层 AI 韧性架构：**

| 层级 | 机制 | 降级策略 |
|---|---|---|
| **Tier 1: SDK** | `@aincore/sdk` OAuth 2.0 PKCE 通信 | 完整 AI 功能 |
| **Tier 2: UDS** | 直连 Unix Domain Socket JSON-RPC | 核心推理能力 |
| **Tier 3: 离线** | 纯正则脱敏 + 本地功能 | 编辑器 + 搜索不受影响 |

- **OAuth PKCE 连接** — 自动注册 → S256 授权码 → Token 交换 → 刷新（5 分钟预过期窗口自动续期）
- **断线重连** — 指数退避（2s → 32s 上限），最多 10 次，30 秒健康检查轮询
- **一方应用自动同意** — 作为 AinCore 内置应用，OAuth 授权流程无需用户交互

### 搜索引擎

三层检索管线：稀疏检索 → 融合排序 → 语义重排序：

- **BM25 稀疏检索** — 自研实现（`k1=1.2`, `b=0.75`），jieba-wasm 中文分词，倒排索引，Top-20 结果
- **RRF 融合排序** — 跨多个知识库并行查询，Reciprocal Rank Fusion（`k=60`）合并去重
- **1B 语义重排序** — 对 Top-10 候选使用常驻轻量模型生成 YES/NO 判断，YES 分数 ×2 / NO 分数 ×0.3
- **实时索引** — `fs.watch` + 500ms 防抖的增量更新，JSON 序列化缓存（24 小时 TTL）
- **Ripgrep 集成** — `@vscode/ripgrep` 驱动的全局文本搜索，支持正则、大小写、glob 过滤、上下文行、多行匹配

### MCP 协议服务端 (Model Context Protocol)

标准 MCP stdio 服务端，可被任意外部 AI 客户端作为知识源调用：

- **5 个工具** — `search_notes`（BM25 全文搜索）· `read_note`（读取笔记）· `list_notes`（目录列表）· `write_note`（写入笔记）· `get_context`（行范围上下文）
- **1 个资源** — `aincore://kb`（`application/json`）列出所有可用知识库
- **Stdio 传输** — JSON-RPC 2.0 on stdout，日志输出到 stderr
- **路径沙箱** — `isPathInsideKnowledgeBase()` + `resolveInsideKnowledgeBase()` 防止路径穿越

### 隐私拦截器 (Privacy Interceptor)

Promise 挂起式异步隐私决策，拦截所有外部 MCP 工具调用：

- **三种决策** — `allowed`（允许原始数据传输）· `rejected`（拒绝访问）· `desensitized`（允许但 PII 脱敏后传输）
- **异步挂起** — `interceptRequest()` 创建 Promise 挂起到 `pendingRequests` Map，IPC 弹窗通知所有渲染窗口
- **超时自动拒绝** — 默认 60 秒超时（可配置），防止授权挂起
- **PII 检测** — 正则匹配 4 种类型（邮箱 · 身份证 · 银行卡 · 手机号）+ AI NER 辅助检测（Core 可用时）
- **NDJSON 审计** — 所有决策持久化到 `{userData}/mcp-audit-log.jsonl`，支持 UI 筛选和清空

### 文件管理

- **树形目录** — 知识库文件浏览器，拖拽排序、重命名、复制/剪切/粘贴
- **Chokidar 监听** — 文件系统变更实时同步
- **多格式导入** — 8 种格式转换为 Markdown（PDF / DOCX / XLSX / PPTX / HTML / CSV / TXT / RTF）

## 技术栈

| 组件 | 技术 |
|---|---|
| 运行时 | Electron 38.4 + Node.js 22 |
| 前端 | Vue 3.5 + Element Plus + Pinia + vue-i18n |
| 编辑器引擎 | MuyaJS（Snabbdom VDOM + 27 ContentState 混入 + CodeMirror 5 源代码模式） |
| 搜索引擎 | 自研 BM25 + jieba-wasm 分词 + RRF 融合排序 + 1B 语义重排序 |
| MCP 服务 | @modelcontextprotocol/sdk（stdio transport，5 tools + 1 resource） |
| AI 通信 | @aincore/sdk → AinCore UDS JSON-RPC（OAuth 2.0 PKCE） |
| 文件转换 | pdfjs-dist · mammoth · turndown · xlsx · jszip |
| 构建 | electron-vite 5 + electron-builder 26 |
| 测试 | Vitest 644 个单元测试 + Playwright 24 个 E2E 测试 |
| 语言 | TypeScript 5.9 (strict) |

## 安装

### 前置条件

AinCore Notes 需要 [AinCore](https://github.com/bzda404/aincore) 在后台运行以提供 AI 模型服务。请先安装并启动 AinCore。

### 从源码构建

```bash
git clone https://github.com/bzda404/aincore-notes.git
cd aincore-notes
pnpm install
pnpm dev            # 开发模式（需先启动 AinCore）
pnpm build:mac      # macOS（arm64 + x64）
pnpm build:linux    # Linux（AppImage + snap + deb）
pnpm build:win      # Windows（nsis + zip）
```

### 使用预构建包

前往 [Releases](https://github.com/bzda404/aincore-notes/releases) 下载对应平台安装包。

## 开发

```bash
# 确保 AinCore 已在运行
pnpm dev            # 启动开发服务器
pnpm test           # 运行 644 个单元测试
pnpm test:e2e       # 运行 E2E 测试 (Playwright)
pnpm typecheck      # TypeScript 类型检查
pnpm lint           # ESLint 代码检查
```

## 项目结构

```
aincore-notes/
├── src/
│   ├── main/
│   │   ├── ai/                AI 服务层（8 个文件）
│   │   │   ├── coreBridge.ts      @aincore/sdk OAuth 2.0 PKCE 通信网关
│   │   │   ├── coreSupervisor.ts  AinCore 进程生命周期（spawn + UDS 监控）
│   │   │   ├── udsClient.ts       直连 UDS JSON-RPC 客户端（备用路径）
│   │   │   ├── desensitizer.ts    PII 检测（正则 4 类 + AI NER）与脱敏
│   │   │   ├── jsonRepair.ts      IncrementalJsonRepair 状态机
│   │   │   └── schemaValidator.ts AI 输出校验（去角色标签/代码围栏）
│   │   ├── mcp/               MCP 协议层（4 个文件）
│   │   │   ├── server.ts          stdio MCP 服务端（5 tools + 1 resource）
│   │   │   ├── handlers.ts        工具处理器（路径沙箱隔离）
│   │   │   ├── privacyInterceptor.ts  Promise 挂起式隐私拦截器
│   │   │   └── telemetry.ts       NDJSON 审计日志 + RAG 遥测
│   │   ├── search/            搜索引擎（5 个文件）
│   │   │   ├── bm25Index.ts       自研 BM25 倒排索引（jieba 分词）
│   │   │   ├── federatedSearch.ts RRF 跨知识库融合排序
│   │   │   ├── reranker.ts        1B 模型 YES/NO 语义重排序
│   │   │   └── indexBuilder.ts    索引构建器（缓存 + fs.watch 增量）
│   │   ├── ipc/               IPC 处理器（14 模块，218 通道）
│   │   ├── filesystem/        文件操作 + 格式转换（8 种格式）
│   │   └── index.ts           Electron 主进程入口
│   ├── renderer/src/
│   │   ├── store/             Pinia 状态管理（15 个 store）
│   │   ├── pages/             页面（工作区、模型管理、偏好设置）
│   │   └── components/        UI 组件（AI 面板、隐私拦截器、文件树）
│   └── shared/                共享类型（218 IPC 通道 + AI/MCP 接口）
├── lib/muyajs/                MuyaJS 编辑器引擎（本地 vendor）
└── static/locales/            9 种语言 JSON（中/英/日/韩/法/德/西/葡/繁体中文）
```

## 致谢

本项目的 Markdown 编辑器基于 MarkText 的 Muya 引擎开发。感谢 MarkText 社区的贡献。

## 生态

| 项目 | 说明 |
|---|---|
| [AinCore](https://github.com/bzda404/aincore) | 本地 AI 算力平台核心枢纽（llama.cpp 推理 + OAuth 授权 + 隐私哨兵） |
| [@aincore/sdk](https://github.com/bzda404/aincore-cdk) | 开发者客户端 SDK（OAuth 2.0 PKCE + UDS JSON-RPC 封装） |

## 许可证

[MIT](LICENSE) — 部分代码源自 [MarkText](https://github.com/marktext/marktext)。

中文 | [English](./docs/README.en.md)

# demo-flare-blog

基于 **Cloudflare Workers** 的全栈现代化博客<br>
深度集成 D1、R2、KV、Workflows 等 Serverless 服务，开箱即用、可 Fork 部署

[![React](https://img.shields.io/badge/React-19-blue?logo=react&style=flat-square)](https://react.dev)
[![TanStack Start](https://img.shields.io/badge/TanStack%20Start-black?logo=tanstack&style=flat-square)](https://tanstack.com/start)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css&style=flat-square)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)](./LICENSE)

[在线演示](https://blog.qyfy.kdns.fr) · [功能](#核心功能) · [技术栈](#技术栈) · [部署流程](#部署流程) · [环境变量参考](#环境变量参考) · [本地开发](#本地开发) · [常见问题](#常见问题)

---

> **注意**：本项目专为 Cloudflare 生态设计，**仅支持**部署在 Cloudflare Workers。

> 欢迎交流本项目相关问题：[Telegram 群](https://t.me/+Rmtf2Jmx_MUwNWE1) · [QQ 群](https://qun.qq.com/universal-share/share?ac=1&authKey=xfLd%2B0FCPOGjICC7%2BNsCJ7%2BxRngZg%2BWZckIoWTSpvcEaCc1Fyn%2BmB30Wq2z0c1IT&busi_data=eyJncm91cENvZGUiOiI4NzE4NDQ2NjgiLCJ0b2tlbiI6ImhGaXB3Z2xTY2ZCYS9XTVg2UGU1TVpSRnNxVFAvdGljRTVpbGhkNkRpano1U3lteEx6UTcxR0ZCQmxkYW1pZGMiLCJ1aW4iOiIyOTE4MzM2OTI2In0%3D&data=D0JnYq8EXQFBrTS9kPGSsewT1sCGk5xYW65Jd8jXXhDZ2KcUKER1Xrf_qFOUunvqxBU-SM12OA6wS7lsFxU7Og&svctype=4&tempid=h5_group_info)


> **项目来源**：本项目基于 [flare-stack-blog](https://github.com/du2333/flare-stack-blog)（v1.5.2）改造而来，保留 GPL-3.0 协议；部分功能参考 [Rin](https://github.com/openRin/Rin)；图床功能参考[CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed)。部署与日常使用见下文。

## 界面预览

<img src="docs/assets/home.png" alt="首页预览" width="49%">
<img src="docs/assets/admin.png" alt="管理后台预览" width="49%">

## 核心功能

### 内容管理
- **文章管理** — 富文本编辑器（代码高亮 / 表格 / 数学公式 / 目录），图片上传，草稿 / 发布 / 定时发布流程，自动保存
- **版本历史** — 编辑器自动快照与文章版本回溯，误改可一键恢复
- **置顶文章** — 支持将文章置顶到列表顶部
- **批量操作** — 支持批量发布/下架文章
- **前后文章导航** — 文章详情页自动显示上一篇/下一篇导航
- **标签系统** — 灵活的文章归类
- **技能管理** — 文章技能分类（与标签不同维度），支持 Markdown 批量导入
- **动态（Moments）** — 富文本（TipTap）分享即时内容，支持图片上传（最多 9 张）、点赞、评论与删除
- **关于页** — 管理员可直接在页面上内联编辑 Markdown 内容

### 互动与社区
- **评论系统** — 嵌套回复（两层）、邮件通知（支持一键退订）、AI 辅助审核与上下文化审核，违规评论自动拦截并通知管理员；文章、动态、关于页共用同一套评论体系，支持在评论中直接上传图片
- **友情链接** — 访客申请、后台审批（通过/拒绝）、邮件通知、频率限制
- **导航页** — 搜索引擎集合一键搜索；书签卡片（左图标右名称、超宽自动虚化）与文件夹卡片进入式浏览、自适应网格分页（书签数据仅管理员可见）；支持导入 Netscape 格式浏览器书签、服务端 Favicon 代理

### 图床与媒体
- **媒体库** — R2 / S3 / 外部图床统一管理：目录浏览（面包屑 + 文件夹树）、文件夹创建/重命名/删除、文件重命名与移动、多选删除（已引用文件保护）、网格/表格视图、使用状态追踪；可从所有已配置渠道拉取完整远端文件列表（包括非博客上传的文件）
- **7 种图床渠道（单选启用）** — 后台设置 → 图床：
  - **R2 原生** — 兜底方案，自定义存储路径前缀（默认 `images/blog`）
  - **S3 兼容存储** — AWS S3 / Cloudflare R2 / 阿里云 OSS / 腾讯云 COS / 自定义，内置区域预设
  - **API Key 图床** — ImgBB / 幻域图床（ffsky），可配置多个实例，文章走服务端代理上传
  - **Telegram Bot** — 上传到频道，默认上限 20MB，支持代理
  - **Discord Bot** — 频道附件上传，默认 10MB（Nitro 25MB），支持代理
  - **HuggingFace** — 上传到 HF 数据集仓库，支持私有仓库
  - **WebDAV** — 支持自动创建目录与自定义公开 URL
- **分渠道大小限制** — 每个渠道可独立设置单文件上限（Telegram 20MB / Discord 10·25MB / ImgBB 32MB / R2 原生 100MB 默认），超限前端直接拦截
- **客户端压缩与格式转换** — 编辑器图片超过「压缩阈值」（留空则按渠道上限触发）时迭代压缩至「目标大小」，可选转 WebP/JPEG；GIF/SVG 跳过；仅作用于文章/动态/评论/关于页的编辑器上传路径
- **图片内容审核（NSFW）** — Workers AI / ModerateContent / NSFW.js 三种检测方案可选，确认违规自动拒绝并清理远端文件
- **防盗链保护** — 「受保护」链接模式下按 Referer 白名单校验外链（支持通配子域名）；Telegram/Discord 图片始终经 Worker 代理回源，凭证不暴露
- **真实上传进度** — 编辑器进度条/进度提示、媒体库逐文件百分比队列，全部基于 XHR 直传
- 渠道启用后媒体库 R2 上传入口自动关闭；未启用或未配置完整时回退到 R2 媒体库

### 用户与认证
- **用户认证** — GitHub OAuth + 邮箱密码注册/登录，`ADMIN_EMAIL` 自动授予管理员
- **用户管理** — 角色管理（admin/user）、封禁/解封（可附带理由和到期时间）、评论统计

### AI 与自动化
- **AI 辅助** — 内置 Cloudflare Workers AI，也可配置多个第三方 Provider 实例并随时切换（OpenAI / Claude / Gemini 三种兼容协议，DeepSeek、Agnes AI 等 OpenAI 兼容服务均可直接接入），提供：
  - 文章摘要生成（200 字以内）
  - 标签自动提取（1-3 个）
  - AI 一键生文（支持博客/技术文档/通讯三种写作风格 + 自定义写作指令）
  - 评论内容审核（三段式裁决：放行/拦截/人工审核）
- **MCP Server** — 通过 OAuth 连接 AI 客户端（Claude / Cursor 等），暴露 23 个工具和 4 个提示词模板，管理文章、评论、标签、友链、媒体与统计
- **导入导出** — ZIP 打包导出、Markdown / 原生格式导入，通过 Cloudflare Workflow 异步处理

### 通知与安全
- **通知系统** — 邮件（SMTP）+ Webhook（通用 HMAC 签名 / 企业微信）多通道通知，8 种事件类型可按需订阅，支持邮件退订
- **博客订阅通知** — 登录读者在个人中心一键订阅新文章邮件推送（按文章去重，绝不重复发送）；管理员可切换「通知全部用户」模式并自定义邮件模板（`{{articleTitle}}` / `{{articleUrl}}` / `{{siteName}}` 占位符）
- **人机验证** — 支持 ALTCHA PoW（工作量证明）/ Cloudflare Turnstile（应用于登录/注册表单），Turnstile 可自动回退到 PoW 兜底
- **SEO 增强** — Canonical URL、Schema.org 结构化数据、Open Graph、RSS / Atom / JSON Feed / Sitemap / Robots.txt
- **PWA 支持** — 自动生成 Web App Manifest

### 运营与维护
- **数据统计** — 站内浏览量统计（Queue + D1 去重）+ Umami 代理集成（`/stats.js`、`/api/send`），24h / 7d / 30d / 90d 多维度流量分析
- **全文搜索** — 基于 Orama 的高性能站内搜索，支持中文分词、模糊匹配、高亮显示
- **主题系统** — 可扩展主题契约，完整替换页面与布局（内置 `default` / `fuwari` 两套主题）
- **Cloudflare 用量概览** — 管理后台首页内嵌用量仪表盘：Workers / D1 / R2 / KV / Queues / Workflows / Workers AI / Durable Objects 八大服务近 30 天用量卡片（对照免费额度，≥70% 黄色、≥90% 红色预警）+ 各服务百分比对比图表；后台设置 → Cloudflare 可按服务配置告警阈值（默认 80%），开启邮件 / Webhook 告警通道并一键测试发送，超阈值时仪表盘醒目提示；需配置具有 Account Analytics 读取权限的 API Token
- **微信公众号验证** — 后台配置验证文件名和内容
- **版本更新检查** — 对比 GitHub Release，后台提示新版本
- **缓存管理** — KV 缓存 + CDN 缓存清除，后台一键操作
- **搜索索引维护** — 管理员可手动重建 Orama 搜索索引

## 技术栈

### Cloudflare 生态

| 服务            | 用途                           |
| :-------------- | :----------------------------- |
| Workers         | 边缘计算与托管                 |
| D1              | SQLite 数据库                  |
| R2              | 对象存储（媒体文件）           |
| KV              | 缓存层                         |
| Durable Objects | 分布式限流 / Argon2id 密码哈希          |
| Workflows       | 异步任务（内容审核、定时发布） |
| Queues          | 消息队列（邮件通知）           |
| Workers AI      | AI 能力（或接入 OpenAI / Claude / Gemini 兼容接口） |

### 前端

- **框架**：React 19 + TanStack Router / Query / Start
- **样式**：TailwindCSS 4
- **表单**：React Hook Form + Zod
- **图表**：Recharts

### 后端

- **网关层**：Hono（认证路由、媒体服务、缓存控制）
- **业务层**：TanStack Start（SSR、Server Functions）
- **数据库**：Drizzle ORM + drizzle-zod
- **认证**：Better Auth（GitHub OAuth + 邮箱密码）
- **国际化**：Paraglide（inlang），文案 zh / en 双语

### 编辑器

TipTap 富文本 + Shiki 代码高亮

### 目录结构

```
src/
├── features/
│   ├── posts/                  # 文章管理（其他模块结构类似）
│   │   ├── api/                # Server Functions（对外接口）
│   │   ├── data/               # 数据访问层（Drizzle 查询）
│   │   ├── posts.service.ts    # 业务逻辑
│   │   ├── posts.schema.ts     # Zod Schema + 缓存 Key 工厂
│   │   ├── components/         # 功能专属组件
│   │   ├── queries/            # TanStack Query Hooks
│   │   └── workflows/          # Cloudflare Workflows
│   ├── comments/    # 评论、嵌套回复、AI 审核
│   ├── moments/     # 动态（TipTap 编辑器、图床上传）
│   ├── tags/        # 标签管理
│   ├── skills/      # 技能管理（Markdown 批量导入）
│   ├── about/       # 关于页（内联 Markdown 编辑）
│   ├── media/       # 媒体上传、R2 存储
│   ├── search/      # Orama 全文搜索
│   ├── auth/        # 认证、权限控制
│   ├── users/       # 用户管理（角色、封禁）
│   ├── dashboard/   # 管理后台数据统计
│   ├── email/       # 邮件通知（SMTP）
│   ├── notification/# 通知系统（邮件 + Webhook）
│   ├── subscription/# 博客订阅通知（新文章邮件推送）
│   ├── webhook/     # Webhook（HMAC 签名 / 企业微信）
│   ├── cache/       # KV 缓存服务
│   ├── config/      # 博客配置（9 个配置分区）
│   ├── friend-links/# 友情链接（申请、审核）
│   ├── navigation/  # 导航页（搜索引擎、书签管理）
│   ├── import-export/# Markdown 导入导出
│   ├── version/     # 版本更新检查
│   ├── theme/       # 主题系统（契约、注册表、各主题实现）
│   ├── ai/          # AI 集成（Workers AI / Agnes AI / OpenAI·Claude·Gemini 兼容）
│   ├── mcp/         # MCP Server（23 个工具、4 个提示词模板）
│   ├── image-hosting/# 7 种图床方案
│   ├── challenge/   # 人机验证（ALTCHA PoW / Turnstile）
│   ├── pageview/    # 浏览量统计（Queue + D1）
│   ├── site-documents/ # RSS / Atom / Sitemap / Robots / PWA Manifest（Hono 路由）
│   ├── cloudflare-usage/ # Cloudflare 用量监控与告警
│   ├── wechat-verify/  # 微信公众号验证
│   ├── oauth-provider/ # OAuth Provider（MCP 连接）
│   └── oauth-clients/  # OAuth 客户端管理
├── routes/
│   ├── _public/     # 公开页面（首页、文章列表/详情、搜索、友链、动态、导航、关于、邮件退订）
│   ├── _auth/       # 登录/注册/找回密码/重置密码/邮箱验证
│   ├── _user/       # 个人中心、友链申请
│   ├── admin/       # 管理后台（仪表盘、文章、评论、媒体、标签、技能、友链、用户、导航、设置）
│   └── oauth/       # OAuth 授权页（MCP 客户端连接）
├── components/      # UI 组件（ui/, common/, layout/, tiptap-editor/）
├── lib/             # 基础设施（db/, auth/, hono/, middlewares）
└── hooks/           # 自定义 Hooks
```

---

## 部署流程

下面是从 **Fork 仓库** 到 **正式上线** 的完整流程。推荐使用 **GitHub Actions** 自动化部署（步骤 0–6）；也可以选择 Cloudflare Dashboard 手动部署（见 [方案二](#方案二-cloudflare-dashboard-手动部署)）。

> 部署教程：部署流程可参考图文教程 [博客部署图文教程](https://blog.qyfy.kdns.fr/post/demo-flare-blog%E9%83%A8%E7%BD%B2%E6%95%99%E7%A8%8B)，进阶玩法见 [博客部署进阶教程](https://blog.qyfy.kdns.fr/post/demo-flare-blog%E8%BF%9B%E9%98%B6%E6%95%99%E7%A8%8B)。

### 阶段 0：Fork 仓库

1. 打开本仓库，点击右上角 **Fork**，克隆到你自己的 GitHub 账号下（只有 Fork 后才有权限配置 Secrets 并触发自动化部署）。
2. Fork 完成后，进入你的仓库 **Actions** 标签页，点击 **Enable workflows**（GitHub 默认对 Fork 仓库关闭 Actions）。

### 阶段 1：Cloudflare 准备工作

1. **注册 Cloudflare 账号**：[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)。R2 与 Workers AI 需要绑定支付方式（个人博客一般免费额度内完全够用）。
2. **域名 DNS 托管到 Cloudflare**：把博客要用的域名添加为 Cloudflare Zone 并把 Nameserver 指过去。若不想托管 DNS，可直接使用 `*.workers.dev` 域名上线（见 [阶段 4](#阶段-4选择域名绑定模式)）。
3. **创建资源**（在 Dashboard 中逐个创建并记录名称 / ID）：
   - **R2 Bucket** — 存储图片与静态资源（记录 Bucket 名称）
   - **D1 Database** — 存储文章与配置（记录 Database ID）
   - **KV Namespace** — 缓存（记录 Namespace ID；`KV` 与 `OAUTH_KV` 两个绑定共用同一个）
   - **Queue** — 创建名为 `blog-queue` 的队列
4. **获取凭证**：
   - **Account ID**、**Zone ID**：域名概览页右侧可见
   - **部署 API Token**：右上角头像 → My Profile → API Tokens → Create Token，选 **Edit Cloudflare Workers** 模板，再额外添加 **D1 → Edit** 权限，Resource 选你的账号/域名
   - **Purge API Token**（可选）：选 **Edit zone DNS** 模板，加 **Zone → Cache Purge → Purge** 权限，仅当你需要部署后自动清理 CDN 缓存时配置

### 阶段 2：创建 GitHub OAuth App

1. 打开 [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**。
2. 填写（以最终域名 `https://blog.example.com` 为例）：
   - **Homepage URL**：`https://blog.example.com`
   - **Authorization callback URL**：`https://blog.example.com/api/auth/callback/github`
3. 记录 **Client ID**，并生成一份 **Client Secret**。

> 纯 workers.dev 部署时，把上面两处替换为你的 `https://<worker>.workers.dev`。

### 阶段 3：配置 GitHub Secrets 与 Variables

进入你的仓库 **Settings → Secrets and variables → Actions**，按下表配置。

**A. 必填 Secrets（CI/CD 资源）**

| 变量名 | 说明 |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | 阶段 1 的部署 Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `D1_DATABASE_ID` | D1 数据库 ID |
| `KV_NAMESPACE_ID` | KV 命名空间 ID |
| `BUCKET_NAME` | R2 Bucket 名称 |

**B. 必填 Secrets（运行时）**

| 变量名 | 说明 |
| :--- | :--- |
| `BETTER_AUTH_SECRET` | 会话加密密钥，`openssl rand -hex 32` 生成 |
| `BETTER_AUTH_URL` | 应用 URL，如 `https://blog.example.com` |
| `ADMIN_EMAIL` | 管理员邮箱（注册该邮箱即成为管理员） |
| `GH_CLIENT_ID` | GitHub OAuth Client ID |
| `GH_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `DOMAIN` | 博客域名，如 `blog.example.com`；纯 workers.dev 部署时填你的 `xxx.workers.dev` |

**C. 可选 Secrets（运行时）**

| 变量名 | 说明 |
| :--- | :--- |
| `CLOUDFLARE_ZONE_ID` | Zone ID，仅需要部署后自动 Purge CDN 时填写 |
| `CLOUDFLARE_PURGE_API_TOKEN` | Purge Token，同上（可选） |
| `CDN_DOMAIN` | 独立 CDN 域名，purge 时优先使用 |
| `GH_TOKEN` | GitHub API Token，用于版本更新检查；建议创建 [Fine-grained PAT](https://github.com/settings/personal-access-tokens/new) 避免限流 |
| `PAGEVIEW_SALT` | 浏览量匿名化 salt，`openssl rand -hex 16` 生成 |
| `TURNSTILE_SECRET_KEY` | （旧版，可留空）Turnstile Secret Key 已改为在后台「人机验证」设置中配置 |
| `UMAMI_SRC` | Umami 埋点代理 URL |
| `LOCALE` | 默认语言 `zh` / `en`，默认 `zh` |
| `CLOUDFLARE_ANALYTICS_API_TOKEN` | （可选）Analytics API Token，需要 Account Analytics 读取权限，用于用量监控 |

**D. Variables（构建时 / CI/CD）** —— 这些放 **Variables** 标签页

| 变量名 | 说明 |
| :--- | :--- |
| `THEME` | 主题名，默认 `default`，可填 `fuwari` |
| `VITE_UMAMI_WEBSITE_ID` | Umami Website ID |
| `VITE_TURNSTILE_SITE_KEY` | （旧版，可留空）Turnstile Site Key 兜底；推荐在后台「人机验证」设置中配置 |
| `ROUTE` | 设为 `custom_domain` 时改用官方 custom_domain 模式；缺省为 routes 模式 |
| `CUSTOM_DOMAIN` | 设为 `1` 同样切换到 custom_domain 模式 |
| `ZONE_NAME` | 可选，routes 模式下 Zone 与 `DOMAIN` 推导结果不一致时覆盖 |

### 阶段 4：选择域名绑定模式

部署脚本（`bun run wrangler:prepare`）会根据以下规则自动生成 `wrangler.jsonc` 的 `routes`：

| 模式 | 触发条件 | 生成的 routes | 适用场景 |
| :--- | :--- | :--- | :--- |
| **routes（默认，推荐）** | 不设置任何开关 | `[{ pattern: "blog.example.com/*", zone_name: "example.com" }]` | 域名 Zone 已在 Cloudflare 账号内 |
| **custom_domain** | `ROUTE=custom_domain` 或 `CUSTOM_DOMAIN=1` | `[{ pattern: "blog.example.com", custom_domain: true }]` | 已在 Dashboard 中把域名绑定为 Worker 自定义域 |
| **纯 workers.dev** | `DOMAIN` 为空或以 `.workers.dev` 结尾 | `routes: []` | 不绑定自定义域名，直接访问 `xxx.workers.dev` |

> routes 模式下的 `zone_name` 默认从 `DOMAIN` 自动推导（二级域名取注册域），如推导不正确可设置 `ZONE_NAME` 覆盖。例如 `DOMAIN=blog.example.com` 会推导出 `zone_name=example.com`，若你的 Cloudflare Zone 名称不是 `example.com`（如 `example.co.uk`），则必须手动设置 `ZONE_NAME`。

### 阶段 5：触发部署

1. 回到仓库 **Actions** 标签页，选择 **deploy to cloudflare workers** workflow，点击 **Run workflow**。
2. 观察流水线，它会自动依次执行：
   - 安装依赖 → 读取 Secrets → `wrangler:prepare` 生成配置文件
   - `wrangler secret bulk` 写入运行时变量
   - `bun run build` 构建前端与 SSR
   - `bun db:migrate` 安全应用 D1 迁移（校验失败自动回滚）
   - `wrangler deploy` 发布 Worker
   - （可选）Purge CDN 缓存
3. 部署成功后，**之后的每次 `push` 到 `main` 都会自动重新部署**。

### 阶段 6：上线检查清单

部署成功后按以下清单确认，即可正式对外：

- [ ] 访问你的域名，确认首页、文章页、RSS（`/rss.xml`）、Atom Feed、Sitemap（`/sitemap.xml`）、Robots（`/robots.txt`）、PWA Manifest 正常
- [ ] 打开 `/admin`，用 `ADMIN_EMAIL` 注册账号，系统自动赋予管理员权限
- [ ] 在后台 **设置** 中完善站点标题、描述、头像、favicon、社交链接、SEO 信息
- [ ] 上传一张图片验证媒体库（R2）可用
- [ ] （可选）配置第三方图床：后台设置 → 图床，从 R2 原生 / S3 兼容 / API Key 图床 / Telegram / Discord / HuggingFace / WebDAV 中选择一个渠道启用，填好凭证后点「测试连接」，并按需开启评论区上传、压缩与内容审核；详见[常见问题 8](#8-如何配置第三方图床)
- [ ] （可选）配置 SMTP 邮件：后台设置 → 邮箱，即可使用验证码登录与评论回复通知
- [ ] （可选）配置 Webhook 通知：后台设置 → 通知，按事件订阅
- [ ] （可选）开启博客订阅通知：后台设置 → 订阅通知 自定义邮件模板，读者在个人中心开启订阅后即可收到新文章邮件（需先配置 SMTP）
- [ ] （可选）开启人机验证：后台设置 → 人机验证，选择验证方案（不启用 / **ALTCHA PoW** / **Cloudflare Turnstile**）。Turnstile 可在超时或连续失败后自动回退到 ALTCHA PoW 兜底；再配合 Umami 统计
- [ ] （可选）后台设置 → AI 配置 AI 服务：默认 Workers AI，也可添加 OpenAI / Claude / Gemini 兼容的第三方 Provider（填写 Base URL / 模型 / API Key 后点「测试连接」）
- [ ] （可选）后台设置 → Cloudflare：粘贴具有 Account Analytics 读取权限的 API Token，配置用量监控与告警阈值（八大服务用量百分比，支持邮件和 Webhook 告警通道），后台首页即可查看用量仪表盘
- [ ] 若页面样式异常，在后台设置页手动 **清除 CDN 缓存** 或到 Cloudflare Dashboard 清理

### 方案二：Cloudflare Dashboard 手动部署

如果你不使用 GitHub Actions，也可以让 Cloudflare 直接连仓库构建：

1. 复制 `wrangler.example.jsonc` 为 `wrangler.jsonc`，填入 D1 / R2 / KV 的 ID 与名称，并按 [阶段 4](#阶段-4选择域名绑定模式) 配置 `routes` 后提交到仓库。
2. Cloudflare Dashboard → Workers & Pages → **Create application → Pages → Connect to Git**，选择你的仓库。
3. 构建配置：**Framework preset** 选 `None`，**Build command** 填 `bun run build`，**Deploy command** 填 `bun run deploy`；构建变量里加 `BUN_VERSION=1.3.5`。
4. 首次部署完成后，在 Worker **Settings → Variables and Secrets** 中添加运行时变量（名称用完整运行时名，如 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`GITHUB_TOKEN`，无需 `GH_` 前缀）。
5. 此方式没有自动 CDN Purge，每次发布后需手动清缓存。

---

## 环境变量参考

| 文件 | 用途 |
| :---------- | :------------------------------------- |
| `.env`      | 客户端变量（`VITE_*`），Vite 构建时读取 |
| `.dev.vars` | 服务端变量，Wrangler 注入 Worker `env`（本地开发） |

部署用变量清单见 [阶段 3](#阶段-3配置-github-secrets-与-variables)。完整定义见 `src/lib/env/server.env.ts`。

---

## 本地开发

### 前置要求

- [Bun](https://bun.sh) >= 1.3
- Cloudflare 账号（用于远程 D1 / R2 / KV 资源）

### 快速开始

```bash
# 安装依赖
bun install

# 配置环境变量
cp .env.example .env            # 客户端变量
cp .dev.vars.example .dev.vars  # 服务端变量

# 生成 wrangler.jsonc（填入真实资源 ID）
bun run wrangler:prepare

# 启动开发服务器（默认端口 3000）
bun dev
```

### 登录管理后台

**方式一：邮箱密码注册（无需第三方服务）**

1. 访问 `http://localhost:3000` 注册页面，使用 `.dev.vars` 中配置的 `ADMIN_EMAIL` 注册账号
2. 开发环境下验证邮件不会真正发送，验证链接会打印到控制台，复制访问即可完成验证
3. 验证后自动登录，系统根据 `ADMIN_EMAIL` 自动赋予管理员权限

**方式二：GitHub OAuth**

1. 前往 [GitHub Developer Settings](https://github.com/settings/developers) 创建 OAuth App
2. Homepage URL 填 `http://localhost:3000`，Authorization callback URL 填 `http://localhost:3000/api/auth/callback/github`
3. 将 Client ID 和 Client Secret 填入 `.dev.vars`

### 常用命令

| 命令            | 说明                        |
| :-------------- | :-------------------------- |
| `bun dev`       | 启动开发服务器（端口 3000） |
| `bun run build` | 构建生产版本                |
| `bun run test`  | 运行测试                    |
| `bun run test:node` | 运行 Node 环境单元测试   |
| `bun run lint`  | Biome Lint 检查             |
| `bun run typecheck` | TypeScript 类型检查      |
| `bun run check` | 类型检查 + Lint + 格式化    |
| `bun run i18n:verify` | 校验 zh / en 双语文案完整性 |

### 数据库命令

| 命令              | 说明                                |
| :---------------- | :---------------------------------- |
| `bun db:studio`   | 启动 Drizzle Studio（可视化数据库） |
| `bun db:generate` | 生成迁移文件                        |
| `bun db:migrate`  | 安全应用远程 D1 迁移，校验失败自动回滚 |
| `bun db:migrate:local` | 安全应用本地 D1 迁移，校验失败自动恢复 |
| `bun db:migrate:unsafe` | 直接应用远程 D1 迁移，不做校验 |

> `bun db:migrate` 会复用 schema 中的状态常量，迁移前后校验 `posts`、`comments` 的关键计数；远程模式默认记录 D1 Time Travel bookmark，校验失败自动 restore。安全迁移脚本位于 `scripts/safe-d1-migrate/`。

### 本地模拟 Cloudflare 资源

默认配置使用远程 D1 / R2 / KV 资源。如需完全本地开发，在 `wrangler.jsonc` 中移除对应 `remote: true`，Miniflare 会自动模拟：

```jsonc
{
  "d1_databases": [{ "binding": "DB", ... }],  // 移除 "remote": true
  "r2_buckets": [{ "binding": "R2", ... }],    // 移除 "remote": true
  "kv_namespaces": [{ "binding": "KV", ... }]  // 移除 "remote": true
}
```

> 本地模拟数据不会同步到远程，本地数据库迁移推荐 `bun db:migrate:local`。

---

## 维护与更新

### 检查版本更新

后台「设置 → 维护」中点击「检查更新」，会请求本项目源仓库 [cxyqiyue/demo-flare-blog](https://github.com/cxyqiyue/demo-flare-blog) 的 GitHub Release，与当前部署版本比较；检测到新版本时，提示条上的「查看」按钮会跳转到对应 Release 页面。

### 同步更新你的 Fork

本项目更新检测的目标是源仓库（非你的 Fork），提示不会直接改动你的仓库。有新版本时按如下步骤手动同步，你的 Fork 的 Actions 会自动重新部署：

1. 打开你 Fork 仓库首页，点击 **Sync fork → Update branch**。
2. 你的仓库 Actions 会自动检测到更新并重新部署（若配置了 Dashboard 构建则自动触发）。
3. 本项目的个性化配置全部通过环境变量 / 后台设置维护，直接同步上游代码通常不会产生冲突。

> 本项目为自定义改造版本，建议在升级前先阅读更新日志，确认新功能与自定义改动兼容。

---

## 常见问题

### 1. 部署成功但网页打不开 / 报 500？

- **看控制台**：F12 → Console 看报错
- **看实时日志**：Cloudflare Dashboard → 你的 Worker → Observability → Live，报错通常会直接指出缺失或错误的变量
- **检查环境变量**：绝大多数"打不开"都是环境变量配置错误，对照 [阶段 3](#阶段-3配置-github-secrets-与-variables) 逐项核对

### 2. 构建时与运行时变量有什么区别？

- **构建时变量**（`THEME`、`VITE_*`）：打进构建产物，改错必须重新构建/部署才生效
- **运行时变量**：服务端运行时读取（如 `BETTER_AUTH_SECRET`、`DOMAIN`）
- GitHub Actions 方案把所有变量都放进 Secrets/Variables 由流水线分发；Dashboard 方案则分别放在 Build Variables 和 Variables and Secrets

### 3. 我的域名 DNS 不在 Cloudflare，能用吗？

可以。把 `DOMAIN` 设为你的 `xxx.workers.dev`，部署脚本会自动生成空 `routes`，直接访问 workers.dev 地址上线；或先把域名加入 Cloudflare Zone 再使用 routes 模式。

### 4. 发布了文章但前台看不到？

发布按钮只有在状态为 **Published** 且发布时间早于当前时间时才会真正发布；若发布时间在未来，则会在那个时间点由后台任务自动发布。

### 5. 如何下架已发布文章？

把状态从 **Published** 改为 **Draft**，发布按钮会变为下架按钮。

### 6. 后台样式异常 / 发布后前台不更新？

先确认 `CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_PURGE_API_TOKEN` 是否配置（未配置则部署后不会自动 Purge），然后在后台设置页手动 **清除 CDN 缓存**。

### 7. 如何接入 AI 客户端（MCP）？

本仓库内置 MCP Server，通过 OAuth 连接 AI 客户端（如 Claude、Cursor），可管理文章、评论、标签、友链、媒体与统计。访问 `/oauth/consent` 走完授权即可使用。

### 8. 如何配置第三方图床？

后台设置 → 图床。采用「单渠道启用」模型：从 7 种渠道中选择一种作为当前图床，每个渠道均可分别勾选「文章区」「评论区」开关并设置单文件大小上限。

**各渠道配置要点**：

| 渠道 | 关键配置 | 默认上限 |
| :--- | :--- | :--- |
| R2 原生 | 开启文章/评论区即可，可自定义存储路径前缀（默认 `images/blog`） | 100 MB |
| S3 兼容 | Endpoint / Bucket / Region / AccessKey（内置 AWS、R2、OSS、COS 区域预设） | 不限 |
| ImgBB | 在 [imgbb.com](https://imgbb.com) 获取 API Key | 32 MB |
| 幻域图床（ffsky） | ffsky API Key，默认端点 `https://pic.ffsky.net/api/1/upload` 可修改 | 不限 |
| Telegram Bot | @BotFather 创建 Bot 获取 Token；将 Bot 拉入频道并设为管理员后填频道 ID，支持代理 | 20 MB |
| Discord Bot | Bot Token + 频道 ID；勾选 Nitro 后上限提升至 25MB，支持代理 | 10 / 25 MB |
| HuggingFace | `hf_` Token + 仓库名（`用户名/仓库名`），支持私有仓库 | 不限 |
| WebDAV | 服务地址 / 账号密码，可配公开 URL（CDN）与自动建目录 | 不限 |

填写完成后点击「测试连接」（上传一张 1×1 测试图并返回直链）验证可用性。

**配套能力**：

- **评论区传图**：渠道开启评论区后，登录用户可在评论中直接上传图片（20 张/小时限速）；ImgBB 渠道会弹出官方上传窗口
- **压缩与转换**：编辑器图片超过「压缩阈值」（留空则按渠道上限触发）时，浏览器端迭代压缩到「目标大小」（留空则向渠道上限收敛），可选转 WebP/JPEG；GIF/SVG 不处理
- **内容审核（NSFW）**：Workers AI / ModerateContent / NSFW.js 三选一，确认违规的图片自动拒绝并尽力删除远端文件
- **防盗链**：「受保护」链接模式下按 Referer 白名单校验外链访问（支持 `*.example.com` 通配子域名，允许空 Referer 可开关）；Telegram/Discord 图片始终由 Worker 代理回源

**R2 回退规则**：未启用任何渠道或所选渠道未配置完整时，文章/评论图片自动回退到 R2 媒体库；一旦渠道就绪则只走该渠道，上传失败只报错、绝不静默写入 R2。渠道启用期间，媒体库的 R2 上传入口（按钮/拖拽/粘贴）自动禁用，已有 R2 图片仍可浏览与管理。

图床 API Key 与站点其他敏感配置（SMTP、AI Key 等）一样保存在 D1 配置表中，仅服务端读取，不会下发到浏览器。

### 9. 部署报错 "Could not find zone" 怎么办？

这通常是因为 `ZONE_NAME` 推导不正确。例如你使用 `blog.qyfy.kdns.fr` 作为 `DOMAIN`，脚本会自动推导出 `zone_name` 为 `kdns.fr`，但实际 Cloudflare Zone 是 `qyfy.kdns.fr`。

**解决方法**：在仓库 Settings → Secrets and variables → Actions → **Variables** 中添加：

| 变量名 | 值 |
| :--- | :--- |
| `ZONE_NAME` | 你的 Cloudflare Zone 名称（如 `qyfy.kdns.fr`） |

> 判断方法：在 Cloudflare Dashboard → 你的域名概览页，页面标题显示的就是 Zone 名称。

### 10. 如何开启博客订阅通知？

1. **前提**：后台设置 → 邮箱 配置好 SMTP。
2. **读者侧**：登录后在个人中心（`/profile`）打开「博客订阅通知」开关，新文章发布时即会收到邮件（每篇文章只发一次）。
3. **管理员侧**：后台设置 → 订阅通知 可自定义邮件主题/正文模板（占位符 `{{articleTitle}}`、`{{articleUrl}}`、`{{siteName}}`）；打开「通知全部用户」后，新文章会推送给所有未封禁用户而不仅是订阅者。

> 不登录的读者可使用 RSS 订阅：`/rss.xml`、`/atom.xml`、`/feed.json`。

### 11. 如何查看和监控 Cloudflare 用量？

- **查看**：管理后台首页内嵌「Cloudflare 用量概览」仪表盘，展示 Workers / D1 / R2 / KV / Queues / Workflows / Workers AI / Durable Objects 八项服务近 30 天用量（对照免费额度，≥70% 黄色、≥90% 红色），并附各服务用量百分比对比图表。
- **告警**：后台设置 → Cloudflare，粘贴一个具有 **Account → Account Analytics → Read** 权限的 API Token（Account ID 自动读取自部署变量 `CLOUDFLARE_ACCOUNT_ID`），按服务设置阈值（默认 80%），开启邮件 / Webhook 通道并可一键测试发送；打开后台首页时若超阈值会有醒目提示。数据来自 Cloudflare GraphQL Analytics API，结果缓存 1 小时。

---

## 参考项目

本项目基于 [flare-stack-blog](https://github.com/du2333/flare-stack-blog)（v1.5.2，GPL-3.0）改造而来，功能部分参考 [Rin](https://github.com/openRin/Rin)，图床功能参考[CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed)，遵循 **GPL-3.0** 协议开源，详见 [LICENSE](./LICENSE)。

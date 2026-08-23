[中文](../README.md) | English

# demo-flare-blog

A full-stack modern blog built on **Cloudflare Workers**<br>
Deeply integrated with D1, R2, KV, Workflows, and other Serverless services — ready to fork and deploy.

[![React](https://img.shields.io/badge/React-19-blue?logo=react&style=flat-square)](https://react.dev)
[![TanStack Start](https://img.shields.io/badge/TanStack%20Start-black?logo=tanstack&style=flat-square)](https://tanstack.com/start)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css&style=flat-square)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)](../LICENSE)

[Live Demo](https://blog.qyfy.kdns.fr) · [Features](#core-features) · [Tech Stack](#tech-stack) · [Deployment Guide](#deployment-guide) · [Environment Variables](#environment-variables-reference) · [Local Development](#local-development) · [FAQ](#faq)

---

> **Note**: This project is designed exclusively for the Cloudflare ecosystem and **only supports** deployment on Cloudflare Workers.

> Join the community to discuss this project: [Telegram Group](https://t.me/+Rmtf2Jmx_MUwNWE1) · [QQ Group](https://qun.qq.com/universal-share/share?ac=1&authKey=xfLd%2B0FCPOGjICC7%2BNsCJ7%2BxRngZg%2BWZckIoWTSpvcEaCc1Fyn%2BmB30Wq2z0c1IT&busi_data=eyJncm91cENvZGUiOiI4NzE4NDQ2NjgiLCJ0b2tlbiI6ImhGaXB3Z2xTY2ZCYS9XTVg2UGU1TVpSRnNxVFAvdGljRTVpbGhkNkRpano1U3lteEx6UTcxR0ZCQmxkYW1pZGMiLCJ1aW4iOiIyOTE4MzM2OTI2In0%3D&data=D0JnYq8EXQFBrTS9kPGSsewT1sCGk5xYW65Jd8jXXhDZ2KcUKER1Xrf_qFOUunvqxBU-SM12OA6wS7lsFxU7Og&svctype=4&tempid=h5_group_info)

> **Origin**: This project is a fork/customization of [flare-stack-blog](https://github.com/du2333/flare-stack-blog) (v1.5.2) and retains its GPL-3.0 license; some features are inspired by [Rin](https://github.com/openRin/Rin); the image-hosting features reference [CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed). See the deployment and usage guide below.

## Previews

<img src="./assets/home.png" alt="Home Preview" width="49%">
<img src="./assets/admin.png" alt="Admin Preview" width="49%">

## Core Features

### Content Management
- **Post Management** — Rich text editor (syntax highlighting / tables / math formulas / TOC), image uploads, draft / publish / scheduled publishing flow, auto-save
- **Version History** — Automatic editor snapshots and post version rollback for safe recovery
- **Pinned Posts** — Pin posts to the top of listings
- **Batch Operations** — Bulk publish/unpublish posts
- **Adjacent Post Navigation** — Auto-display previous/next post navigation on post detail pages
- **Tagging System** — Flexible post categorization
- **Skills Management** — Article skill classification (different dimension from tags), supports Markdown batch import
- **Moments** — Rich text (TipTap) for sharing instant content, supports image uploads (up to 9), likes, comments, and deletion
- **About Page** — Admin can directly edit Markdown content inline on the page

### Interaction & Community
- **Comment System** — Nested replies (two-level), email notifications (with one-click unsubscribe), AI-assisted and context-aware moderation, violating comments auto-blocked and admin notified; posts, moments, and about page share the same comment infrastructure, with direct image uploads in comments
- **Friend Links** — Visitor applications, admin review (approve/reject), email notifications, frequency limiting
- **Navigation Page** — One-click search across a search-engine collection; bookmark cards (icon left / name right with blur-fade overflow) and folder cards with enter-style browsing and adaptive grid pagination (bookmark data visible to admins only); Netscape bookmark import; server-side Favicon proxy

### Image Hosting & Media
- **Media Library** — Unified management of R2 / S3 / external image-hosting channels: directory browsing (breadcrumbs + folder tree), folder create/rename/delete, file rename and move, multi-select delete with in-use protection, grid/table views, usage tracking; pulls complete remote file lists from all configured channels (including files not uploaded by the blog)
- **7 Image-Hosting Channels (single active provider)** — Settings → Image Hosting:
  - **R2 Native** — Fallback solution with custom storage path prefix (default `images/blog`)
  - **S3-Compatible Storage** — AWS S3 / Cloudflare R2 / Alibaba OSS / Tencent COS / Custom, with built-in region presets
  - **API Key Providers** — ImgBB / ffsky, multiple instances supported, server-side proxy upload for articles
  - **Telegram Bot** — Upload to a channel, 20 MB default limit, proxy supported
  - **Discord Bot** — Channel attachment uploads, 10 MB default (25 MB with Nitro), proxy supported
  - **HuggingFace** — Upload to HF dataset repositories, private repos supported
  - **WebDAV** — Auto directory creation and custom public URL
- **Per-Channel Size Limits** — Each channel has its own max file size (Telegram 20MB / Discord 10·25MB / ImgBB 32MB / R2 Native 100MB by default); oversized files are rejected client-side
- **Client-Side Compression & Conversion** — Editor images above the compression threshold (empty = channel limit) are iteratively compressed toward the target size, with optional WebP/JPEG conversion; GIF/SVG skipped; applies only to editor uploads in posts/moments/comments/about
- **Image Moderation (NSFW)** — Three detection options: Workers AI / ModerateContent / NSFW.js; confirmed violations are auto-rejected and remote files cleaned up
- **Hotlink Protection** — "Protected" link mode validates external access against a Referer allowlist (wildcard subdomains supported); Telegram/Discord images are always proxied through the Worker so credentials never leak
- **Real Upload Progress** — Editor progress bars/toasts and per-file percentage queues in the media library, all via XHR direct upload
- When a channel is enabled, the media library R2 upload entry is automatically disabled; falls back to the R2 media library when no channel is enabled or fully configured

### User & Authentication
- **User Authentication** — GitHub OAuth + email/password registration/login, `ADMIN_EMAIL` auto-grants admin
- **User Management** — Role management (admin/user), ban/unban (with reason and expiry), comment statistics

### AI & Automation
- **AI Integration** — Built-in Cloudflare Workers AI, or multiple third-party Provider instances with instant switching (three compat protocols: OpenAI / Claude / Gemini; any OpenAI-compatible service such as DeepSeek or Agnes AI works out of the box):
  - Article summary generation (200 chars)
  - Tag auto-extraction (1-3 tags)
  - AI one-click article generation (3 writing styles: blog/docs/newsletter + custom instructions)
  - Comment content moderation (three-segment verdict: approve/block/review)
- **MCP Server** — Connect AI clients (Claude / Cursor etc.) via OAuth, exposes 23 tools and 4 prompt templates, manages posts, comments, tags, friend links, media, and analytics
- **Import/Export** — ZIP packaged export, Markdown / native format import, processed asynchronously via Cloudflare Workflows

### Notification & Security
- **Notification System** — Email (SMTP) + Webhook (generic HMAC-signed / WeChat Work) multi-channel notifications, 8 event types with per-event subscription, email unsubscribe support
- **Blog Subscription Notifications** — Logged-in readers can toggle new-post email notifications from their profile (deduplicated per post, never sent twice); admins can switch to an "notify all users" mode and customize the email template (`{{articleTitle}}` / `{{articleUrl}}` / `{{siteName}}` placeholders)
- **Human Verification** — ALTCHA PoW (Proof of Work) / Cloudflare Turnstile applied to login/register forms; Turnstile can auto-fallback to PoW on timeout or repeated failures
- **SEO Enhancements** — Canonical URL, Schema.org structured data, Open Graph, RSS / Atom / JSON Feed / Sitemap / Robots.txt
- **PWA Support** — Auto-generated Web App Manifest

### Operations & Maintenance
- **Analytics** — Built-in pageview stats (Queue + D1 dedup) + Umami proxy integration (`/stats.js`, `/api/send`), 24h / 7d / 30d / 90d multi-range traffic analysis
- **Full-Text Search** — Orama-powered high-performance on-site search, supports Chinese tokenization, fuzzy matching, and highlighted results
- **Theme System** — Extensible theme contracts, complete page and layout replacement (built-in `default` / `fuwari` themes)
- **Cloudflare Usage Overview** — Usage dashboard embedded on the admin home page: cards for 8 services (Workers / D1 / R2 / KV / Queues / Workflows / Workers AI / Durable Objects) over the last 30 days against free-tier quotas (amber at ≥70%, red at ≥90%) plus a percentage comparison chart; Settings → Cloudflare offers per-service alert thresholds (default 80%), email / Webhook alert channels with one-click test sends, and prominent on-dashboard warnings when thresholds are exceeded; requires an API token with Account Analytics read permission
- **WeChat Verification** — Configurable verification file name and content in admin settings
- **Version Update Check** — Compare against GitHub Release, admin panel prompts for new versions
- **Cache Management** — KV cache + CDN cache purge, one-click operation from admin panel
- **Search Index Maintenance** — Admin can manually rebuild Orama search index
- **Safe D1 Migration** — Pre/post validation with automatic rollback on failure

## Tech Stack

### Cloudflare Ecosystem

| Service         | Purpose                                                       |
| :-------------- | :------------------------------------------------------------ |
| Workers         | Edge computing and hosting                                    |
| D1              | SQLite database                                               |
| R2              | Object storage (media files)                                  |
| KV              | Caching layer                                                 |
| Durable Objects | Distributed rate limiting / Argon2id password hashing |
| Workflows       | Asynchronous tasks (content moderation, scheduled publishing) |
| Queues          | Message queues (email notifications)                          |
| Workers AI      | AI capabilities (or OpenAI / Claude / Gemini-compatible endpoints) |

### Frontend

- **Framework**: React 19 + TanStack Router / Query / Start
- **Styling**: TailwindCSS 4
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts

### Backend

- **Gateway Layer**: Hono (auth routes, media services, cache control)
- **Business Layer**: TanStack Start (SSR, Server Functions)
- **Database**: Drizzle ORM + drizzle-zod
- **Authentication**: Better Auth (GitHub OAuth + email/password)
- **i18n**: Paraglide (inlang), bilingual zh / en copy

### Editor

TipTap Rich Text + Shiki Syntax Highlighting

### Directory Structure

```
src/
├── features/
│   ├── posts/                  # Post management (other modules share similar structure)
│   │   ├── api/                # Server Functions (Public APIs)
│   │   ├── data/               # Data access layer (Drizzle queries)
│   │   ├── posts.service.ts    # Business logic
│   │   ├── posts.schema.ts     # Zod Schemas + Cache Key Factories
│   │   ├── components/         # Feature-specific components
│   │   ├── queries/            # TanStack Query Hooks
│   │   └── workflows/          # Cloudflare Workflows
│   ├── comments/    # Comments, nested replies, AI moderation
│   ├── moments/     # Moments (TipTap editor, image hosting uploads)
│   ├── tags/        # Tag management
│   ├── skills/      # Skills management (Markdown batch import)
│   ├── about/       # About page (inline Markdown editor)
│   ├── media/       # Media uploads, R2 storage
│   ├── search/      # Orama full-text search
│   ├── auth/        # Authentication, permission control
│   ├── users/       # User management (roles, ban/unban)
│   ├── dashboard/   # Admin dashboard statistics
│   ├── email/       # Email notifications (SMTP)
│   ├── notification/# Notification system (email + webhook)
│   ├── subscription/# Blog subscription notifications (new-post emails)
│   ├── webhook/     # Webhooks (HMAC-signed / WeChat Work)
│   ├── cache/       # KV caching services
│   ├── config/      # Blog configurations (9 config sections)
│   ├── friend-links/# Friend links (applications, moderation)
│   ├── navigation/  # Navigation page (search engines, bookmarks)
│   ├── import-export/# Markdown importing/exporting
│   ├── version/     # Version update checker
│   ├── theme/       # Theme system (contracts, registry, theme implementations)
│   ├── ai/          # AI integration (Workers AI / Agnes AI / OpenAI·Claude·Gemini compat)
│   ├── mcp/         # MCP Server (23 tools, 4 prompt templates)
│   ├── image-hosting/# 7 image hosting providers
│   ├── challenge/   # Human verification (ALTCHA PoW / Turnstile)
│   ├── pageview/    # Pageview analytics (Queue + D1)
│   ├── site-documents/ # RSS / Atom / Sitemap / Robots / PWA Manifest (Hono routes)
│   ├── cloudflare-usage/ # Cloudflare usage monitoring & alerts
│   ├── wechat-verify/  # WeChat verification
│   ├── oauth-provider/ # OAuth Provider (MCP connection)
│   └── oauth-clients/  # OAuth client management
├── routes/
│   ├── _public/     # Public pages (Home, post lists/details, search, friend links, moments, navigation, about, email unsubscribe)
│   ├── _auth/       # Login/registration/forgot password/reset password/email verification
│   ├── _user/       # Profile, friend-link submission
│   ├── admin/       # Admin backend (dashboard, posts, comments, media, tags, skills, friend links, users, navigation, settings)
│   └── oauth/       # OAuth consent page (MCP client connection)
├── components/      # UI components (ui/, common/, layout/, tiptap-editor/)
├── lib/             # Infrastructure (db/, auth/, hono/, middlewares)
└── hooks/           # Custom React Hooks
```

---

## Deployment Guide

The complete flow from **forking the repository** to **going live**. The **GitHub Actions** automated pipeline is recommended (Steps 0–6); a Cloudflare Dashboard manual alternative is also available ([Option 2](#option-2-deploy-via-cloudflare-dashboard)).

> Deployment tutorials: step-by-step guide at [Blog Deployment Tutorial](https://blog.qyfy.kdns.fr/post/demo-flare-blog%E9%83%A8%E7%BD%B2%E6%95%99%E7%A8%8B) (Chinese), advanced tips at [Blog Deployment Advanced Tutorial](https://blog.qyfy.kdns.fr/post/demo-flare-blog%E8%BF%9B%E9%98%B6%E6%95%99%E7%A8%8B) (Chinese).

### Step 0: Fork the Repository

1. Open this repository and click **Fork** in the top-right corner to clone it into your own GitHub account (only a fork can configure Secrets and trigger automated deployment).
2. After forking, open your repository's **Actions** tab and **Enable workflows** (GitHub disables Actions in forks by default).

### Step 1: Cloudflare Prerequisites

1. **Create a Cloudflare account**: [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up). R2 and Workers AI require adding a payment method (personal blogs generally stay well within the free quotas).
2. **Host your domain's DNS on Cloudflare**: add the domain you want to use as a Cloudflare Zone and point the nameservers there. If you don't want to host DNS, you can go live directly on a `*.workers.dev` subdomain (see [Step 4](#step-4-choose-a-domain-binding-mode)).
3. **Create resources** (create each in the Dashboard and record the name / ID):
   - **R2 Bucket** — store images and static assets (record the bucket name)
   - **D1 Database** — store posts and configs (record the Database ID)
   - **KV Namespace** — caching (record the Namespace ID; the `KV` and `OAUTH_KV` bindings share the same one)
   - **Queue** — create a queue named `blog-queue`
4. **Get credentials**:
   - **Account ID** and **Zone ID**: visible on the right side of your domain's overview page
   - **Deployment API Token**: Avatar (top-right) → My Profile → API Tokens → Create Token. Use the **Edit Cloudflare Workers** template and add **D1 → Edit** permission; scope it to your account/domain
   - **Purge API Token** (optional): use the **Edit zone DNS** template and add **Zone → Cache Purge → Purge**. Only needed if you want automatic CDN cache purging after deploy

### Step 2: Create a GitHub OAuth App

1. Open [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**.
2. Fill in (using the final domain `https://blog.example.com` as an example):
   - **Homepage URL**: `https://blog.example.com`
   - **Authorization callback URL**: `https://blog.example.com/api/auth/callback/github`
3. Record the **Client ID** and generate a **Client Secret**.

> For a pure workers.dev deployment, replace the two URLs above with your `https://<worker>.workers.dev`.

### Step 3: Configure GitHub Secrets and Variables

Open **Settings → Secrets and variables → Actions** in your repository and configure the following.

**A. Required Secrets (CI/CD resources)**

| Variable | Description |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Deployment Token from Step 1 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `D1_DATABASE_ID` | D1 Database ID |
| `KV_NAMESPACE_ID` | KV Namespace ID |
| `BUCKET_NAME` | R2 Bucket name |

**B. Required Secrets (runtime)**

| Variable | Description |
| :--- | :--- |
| `BETTER_AUTH_SECRET` | Session encryption key, generated with `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | App URL, e.g. `https://blog.example.com` |
| `ADMIN_EMAIL` | Admin email (registering this email grants admin) |
| `GH_CLIENT_ID` | GitHub OAuth Client ID |
| `GH_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `DOMAIN` | Blog domain, e.g. `blog.example.com`; use your `xxx.workers.dev` for a pure workers.dev deployment |

**C. Optional Secrets (runtime)**

| Variable | Description |
| :--- | :--- |
| `CLOUDFLARE_ZONE_ID` | Zone ID; only needed for automatic CDN purge after deploy |
| `CLOUDFLARE_PURGE_API_TOKEN` | Purge Token; same as above (optional) |
| `CDN_DOMAIN` | Standalone CDN domain, preferred during purge |
| `GH_TOKEN` | GitHub API Token for version-update checks; create a [Fine-grained PAT](https://github.com/settings/personal-access-tokens/new) to avoid rate limits |
| `PAGEVIEW_SALT` | Salt for anonymizing pageview hashes, generated with `openssl rand -hex 16` |
| `TURNSTILE_SECRET_KEY` | (legacy, can be empty) Turnstile Secret Key is now configured in admin Settings → Challenge |
| `UMAMI_SRC` | Umami tracking proxy URL |
| `LOCALE` | Default language `zh` / `en`, default `zh` |
| `CLOUDFLARE_ANALYTICS_API_TOKEN` | (optional) Analytics API Token with Account Analytics read permission for usage monitoring |

**D. Variables (build-time / CI/CD)** — put these in the **Variables** tab

| Variable | Description |
| :--- | :--- |
| `THEME` | Theme name, default `default`, can be `fuwari` |
| `VITE_UMAMI_WEBSITE_ID` | Umami Website ID |
| `VITE_TURNSTILE_SITE_KEY` | (legacy, can be empty) Turnstile Site Key fallback; prefer configuring it in admin Settings → Challenge |
| `ROUTE` | Set to `custom_domain` to use the official custom_domain binding; default is routes mode |
| `CUSTOM_DOMAIN` | Set to `1` to also switch to custom_domain mode |
| `ZONE_NAME` | Optional; overrides the zone inferred from `DOMAIN` in routes mode |

### Step 4: Choose a Domain Binding Mode

The deployment script (`bun run wrangler:prepare`) generates the `routes` block of `wrangler.jsonc` based on these rules:

| Mode | Trigger | Generated routes | Use case |
| :--- | :--- | :--- | :--- |
| **routes (default, recommended)** | No switch set | `[{ pattern: "blog.example.com/*", zone_name: "example.com" }]` | Domain Zone is already in your Cloudflare account |
| **custom_domain** | `ROUTE=custom_domain` or `CUSTOM_DOMAIN=1` | `[{ pattern: "blog.example.com", custom_domain: true }]` | Domain already bound as a Worker custom domain in the Dashboard |
| **pure workers.dev** | `DOMAIN` empty or ending with `.workers.dev` | `routes: []` | No custom domain, access directly via `xxx.workers.dev` |

> In routes mode, `zone_name` is inferred from `DOMAIN` (the registrable domain). Set `ZONE_NAME` to override when the inference is wrong. For example, `DOMAIN=blog.example.com` infers `zone_name=example.com`. If your Cloudflare Zone name differs (e.g. `example.co.uk`), you must set `ZONE_NAME` manually.

### Step 5: Trigger Deployment

1. In your repository's **Actions** tab, select the **deploy to cloudflare workers** workflow and click **Run workflow**.
2. Watch the pipeline; it automatically runs:
   - Install dependencies → load Secrets → `wrangler:prepare` to generate the config
   - `wrangler secret bulk` to write runtime variables
   - `bun run build` to build the frontend and SSR bundle
   - `bun db:migrate` to safely apply D1 migrations (auto-rollback on failure)
   - `wrangler deploy` to publish the Worker
   - (optional) Purge the CDN cache
3. After a successful deploy, **every subsequent `push` to `main` redeploys automatically**.

### Step 6: Go-Live Checklist

Run through the following after deployment:

- [ ] Visit your domain and confirm the homepage, post pages, RSS (`/rss.xml`), Atom Feed, Sitemap (`/sitemap.xml`), Robots (`/robots.txt`), and PWA Manifest work
- [ ] Open `/admin`, register with `ADMIN_EMAIL`, and the system grants admin automatically
- [ ] In admin **Settings**, fill in site title, description, avatar, favicon, social links, and SEO info
- [ ] Upload an image to verify the media library (R2) works
- [ ] (Optional) Configure third-party image hosting: admin Settings → Image Hosting, enable one channel from R2 Native / S3-compatible / API Key / Telegram / Discord / HuggingFace / WebDAV, fill in the credentials and hit "Test connection", then optionally enable comment uploads, compression and moderation; see [FAQ #8](#8-how-do-i-configure-third-party-image-hosting)
- [ ] (Optional) Configure SMTP email in admin Settings → Email for code login and comment-reply notifications
- [ ] (Optional) Configure webhook notifications in admin Settings → Webhook with per-event subscriptions
- [ ] (Optional) Enable blog subscription notifications: customize the email template in admin Settings → Subscriptions; readers toggle it on their profile to receive new-post emails (SMTP required first)
- [ ] (Optional) Enable human verification in admin Settings → Challenge: pick a provider (None / **ALTCHA PoW** / **Cloudflare Turnstile**). Turnstile can auto-fall back to ALTCHA PoW on timeout or repeated failures. Also enable Umami analytics
- [ ] (Optional) Configure AI in admin Settings → AI: Workers AI by default, or add OpenAI / Claude / Gemini-compatible providers (fill in Base URL / model / API key and hit "Test connection")
- [ ] (Optional) Admin Settings → Cloudflare: paste an API token with Account Analytics read permission, set usage alert thresholds for the 8 services (email and Webhook channels), then monitor the usage dashboard on the admin home page
- [ ] If styles look broken, manually **Clear CDN Cache** from the admin Settings page or the Cloudflare Dashboard

### Option 2: Deploy via Cloudflare Dashboard

If you don't use GitHub Actions, you can let Cloudflare build directly from your repository:

1. Copy `wrangler.example.jsonc` to `wrangler.jsonc`, fill in the D1 / R2 / KV IDs and names, configure `routes` per [Step 4](#step-4-choose-a-domain-binding-mode), and commit.
2. Cloudflare Dashboard → Workers & Pages → **Create application → Pages → Connect to Git**, select your repository.
3. Build settings: **Framework preset** = `None`, **Build command** = `bun run build`, **Deploy command** = `bun run deploy`; add `BUN_VERSION=1.3.5` to build variables.
4. After the first deploy, add runtime variables in the Worker's **Settings → Variables and Secrets** (use full runtime names like `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_TOKEN` — no `GH_` prefix).
5. This option has no automatic CDN purge; clear the cache manually after each release.

---

## Environment Variables Reference

| File        | Purpose                                                       |
| :---------- | :------------------------------------------------------------ |
| `.env`      | Client-side variables (`VITE_*`), read at Vite build time     |
| `.dev.vars` | Server-side variables, injected into Worker `env` by Wrangler (local development) |

The full deployment variable list is in [Step 3](#step-3-configure-github-secrets-and-variables). The authoritative schema lives in `src/lib/env/server.env.ts`.

---

## Local Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.3
- A Cloudflare account (for remote D1 / R2 / KV resources)

### Quick Start

```bash
# Install dependencies
bun install

# Configure environment variables
cp .env.example .env            # Client-side variables
cp .dev.vars.example .dev.vars  # Server-side variables

# Generate wrangler.jsonc (fill in real resource IDs)
bun run wrangler:prepare

# Start development server (default port 3000)
bun dev
```

### Logging into the Admin Backend

**Method 1: Email and Password Registration (No third-party service required)**

1. Visit `http://localhost:3000`'s registration page and register using the `ADMIN_EMAIL` configured in `.dev.vars`.
2. In development, the verification email isn't actually sent — the link is printed in the terminal; copy and visit it to complete verification.
3. After verification you're auto-logged-in, and the system grants admin based on `ADMIN_EMAIL`.

**Method 2: GitHub OAuth**

1. Navigate to [GitHub Developer Settings](https://github.com/settings/developers) and create an OAuth App.
2. Homepage URL: `http://localhost:3000`, Authorization callback URL: `http://localhost:3000/api/auth/callback/github`.
3. Put the Client ID and Client Secret into `.dev.vars`.

### Common Commands

| Command            | Definition                                       |
| :----------------- | :----------------------------------------------- |
| `bun dev`          | Starts local dev server (default port 3000)      |
| `bun run build`    | Builds the production bundle                     |
| `bun run test`     | Runs the test suites                             |
| `bun run test:node`| Runs Node-environment unit tests                 |
| `bun run lint`     | Runs the Biome linter                            |
| `bun run typecheck`| Runs TypeScript type checking                    |
| `bun run check`    | Type checking + Lint + formatting                |
| `bun run i18n:verify` | Verifies zh / en copy completeness           |

### Database Commands

| Command                | Definition                                                  |
| :--------------------- | :---------------------------------------------------------- |
| `bun db:studio`        | Invokes the Drizzle Studio visual database interface        |
| `bun db:generate`      | Generates schema migration files                            |
| `bun db:migrate`       | Safely applies remote D1 migrations, auto-rollback on failure |
| `bun db:migrate:local` | Safely applies local D1 migrations, auto-restores local state |
| `bun db:migrate:unsafe`| Applies remote D1 migrations directly without verification |

> `bun db:migrate` validates `posts` and `comments` key counts before and after migration; in remote mode it records a D1 Time Travel bookmark and auto-restores on failure. The safe migration script is located at `scripts/safe-d1-migrate/`.

### Simulating Cloudflare Resources Locally

The default setup connects to remote D1 / R2 / KV resources. For a fully local setup, remove `remote: true` from `wrangler.jsonc` and Miniflare will simulate them:

```jsonc
{
  "d1_databases": [{ "binding": "DB", ... }],  // remove "remote": true
  "r2_buckets": [{ "binding": "R2", ... }],    // remove "remote": true
  "kv_namespaces": [{ "binding": "KV", ... }]  // remove "remote": true
}
```

> Locally simulated data is not synced to remote. For local migrations, prefer `bun db:migrate:local`.

---

## Maintenance & Updates

### Checking for Updates

In the admin panel, **Settings → Maintenance**, click **Check for updates**. It queries the GitHub Release of the source repository [cxyqiyue/demo-flare-blog](https://github.com/cxyqiyue/demo-flare-blog) and compares it with the currently deployed version. When a new version is detected, the **View** action in the notification jumps to the corresponding Release page.

### Syncing Updates to Your Fork

The update check targets the source repository (not your fork); the notification does not modify your repository. When a new version is available, sync manually as follows and your fork's Actions will redeploy automatically:

1. Open your fork's homepage and click **Sync fork → Update branch**.
2. Your repository's Actions will detect the update and redeploy automatically (or the Dashboard build triggers).
3. All personalization here lives in environment variables / the admin Settings, so syncing upstream usually won't cause merge conflicts.

> Since this is a customized fork, review the changelog before upgrading to confirm new features are compatible with your local changes.

---

## FAQ

### 1. Deployment succeeded but the site won't load / returns 500?

- **Check the console**: F12 → Console for errors.
- **Check live logs**: Cloudflare Dashboard → your Worker → Observability → Live. Errors usually point directly to a missing or wrong variable.
- **Check environment variables**: most "won't load" issues are misconfigured variables — cross-check against [Step 3](#step-3-configure-github-secrets-and-variables).

### 2. What's the difference between build-time and runtime variables?

- **Build-time variables** (`THEME`, `VITE_*`): baked into the build output; changes require a rebuild/redeploy.
- **Runtime variables**: read by the server at runtime (e.g., `BETTER_AUTH_SECRET`, `DOMAIN`).
- With GitHub Actions, everything goes into Secrets/Variables and the pipeline distributes them; with the Dashboard, put them in Build Variables vs. Variables and Secrets.

### 3. My domain's DNS isn't on Cloudflare. Can I still use it?

Yes. Set `DOMAIN` to your `xxx.workers.dev` and the deploy script emits an empty `routes` block — go live on the workers.dev address directly. Or add the domain to a Cloudflare Zone and use routes mode.

### 4. I published a post but it's not showing on the frontend?

The publish action only truly publishes when the status is **Published** AND the publish time is earlier than now; if it's in the future, a background task publishes it at that time.

### 5. How do I unpublish a post?

Change its status from **Published** to **Draft**; the publish button becomes an unpublish button.

### 6. Admin styles look broken / frontend doesn't update after publish?

Make sure `CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_PURGE_API_TOKEN` are configured (without them there's no automatic purge after deploy), then manually **Clear CDN Cache** in the admin Settings page.

### 7. How do I connect an AI client (MCP)?

This repo ships a built-in MCP Server that connects AI clients (e.g., Claude, Cursor) via OAuth to manage posts, comments, tags, friend links, media, and analytics. Visit `/oauth/consent` and complete the authorization flow.

### 8. How do I configure third-party image hosting?

Admin Settings → Image Hosting uses a "single active channel" model: pick one of the 7 channels as the current image host; every channel has independent "Articles" / "Comments" toggles and its own max file size.

**Channel setup notes**:

| Channel | Key configuration | Default limit |
| :--- | :--- | :--- |
| R2 Native | Just toggle articles/comments on; custom storage path prefix available (default `images/blog`) | 100 MB |
| S3-compatible | Endpoint / Bucket / Region / AccessKey (built-in AWS, R2, OSS, COS region presets) | Unlimited |
| ImgBB | Get an API key at [imgbb.com](https://imgbb.com) | 32 MB |
| ffsky | ffsky API key; default endpoint `https://pic.ffsky.net/api/1/upload` is editable | Unlimited |
| Telegram Bot | Create a bot via @BotFather for the token; add it to a channel as admin and fill in the channel ID; proxy supported | 20 MB |
| Discord Bot | Bot token + channel ID; check Nitro to raise the limit to 25MB; proxy supported | 10 / 25 MB |
| HuggingFace | `hf_` token + repository (`username/repo-name`), private repos supported | Unlimited |
| WebDAV | Server URL / credentials, optional public URL (CDN) and auto directory creation | Unlimited |

After filling in the credentials, click "Test connection" (uploads a 1×1 test image and returns the direct link).

**Companion capabilities**:

- **Comment uploads**: once the channel's Comments toggle is on, logged-in users can upload images directly in comments (rate-limited per user to 200/hour); the ImgBB channel opens its official upload popup
- **Compression & conversion**: editor images above the compression threshold (empty = trigger at the channel limit) are iteratively compressed in the browser toward the target size (empty = converge toward the channel limit), with optional WebP/JPEG conversion; GIF/SVG untouched
- **Content moderation (NSFW)**: pick one of Workers AI / ModerateContent / NSFW.js; confirmed violations are auto-rejected and remote files deleted best-effort
- **Hotlink protection**: "Protected" link mode validates external access against a Referer allowlist (supports `*.example.com` wildcard subdomains, empty-Referer toggle); Telegram/Discord images are always proxied through the Worker

**R2 fallback rules**: when no channel is enabled or the selected one isn't fully configured, article/comment images fall back to the R2 media library automatically; once a channel is ready it is used exclusively — failed uploads just error out and never silently write into R2. While a channel is enabled, the media library R2 upload entry (button/drag/paste) is disabled automatically; existing R2 images remain browsable and manageable.

Image-hosting API keys are stored like other sensitive settings (SMTP, AI keys) in the D1 config table, read server-side only and never sent to the browser.

### 9. Deployment fails with "Could not find zone" — what do I do?

This happens when `ZONE_NAME` is inferred incorrectly. For example, if your `DOMAIN` is `blog.qyfy.kdns.fr`, the script infers `zone_name` as `kdns.fr`, but the actual Cloudflare Zone is `qyfy.kdns.fr`.

**Fix**: Go to your repository Settings → Secrets and variables → Actions → **Variables** and add:

| Variable | Value |
| :--- | :--- |
| `ZONE_NAME` | Your Cloudflare Zone name (e.g. `qyfy.kdns.fr`) |

> How to find it: In the Cloudflare Dashboard, open your domain — the Zone name is shown in the page title.

### 10. How do I enable blog subscription notifications?

1. **Prerequisite**: configure SMTP under admin Settings → Email.
2. **Reader side**: log in and toggle "Blog subscription notifications" on your profile page (`/profile`); you'll receive an email whenever a new post is published (once per post).
3. **Admin side**: admin Settings → Subscriptions lets you customize the email subject/body template (placeholders `{{articleTitle}}`, `{{articleUrl}}`, `{{siteName}}`); enabling "notify all users" pushes new posts to every non-banned user instead of subscribers only.

> Readers who prefer not to log in can use RSS: `/rss.xml`, `/atom.xml`, `/feed.json`.

### 11. How do I view and monitor Cloudflare usage?

- **Viewing**: the admin home page embeds a "Cloudflare Usage Overview" dashboard showing the last 30 days of usage for Workers / D1 / R2 / KV / Queues / Workflows / Workers AI / Durable Objects against free-tier quotas (amber at ≥70%, red at ≥90%), plus a per-service percentage comparison chart.
- **Alerting**: admin Settings → Cloudflare — paste an API token with **Account → Account Analytics → Read** permission (the Account ID is read automatically from the `CLOUDFLARE_ACCOUNT_ID` deploy variable), set per-service thresholds (default 80%), enable email / Webhook channels and send test alerts; opening the admin home page highlights any exceeded thresholds. Data comes from the Cloudflare GraphQL Analytics API and is cached for 1 hour.

---

## Reference Projects

This project is a customization of [flare-stack-blog](https://github.com/du2333/flare-stack-blog) (v1.5.2, GPL-3.0); some features are inspired by [Rin](https://github.com/openRin/Rin); the image-hosting features reference [CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed). It is open-sourced under the **GPL-3.0** license — see [LICENSE](../LICENSE).

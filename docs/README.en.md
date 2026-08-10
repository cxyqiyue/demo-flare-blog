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

> Join the Telegram group to discuss this project: [Telegram Group](https://t.me/+Rmtf2Jmx_MUwNWE1)

> **Origin**: This project is a fork/customization of [flare-stack-blog](https://github.com/du2333/flare-stack-blog) (v1.5.2) and retains its GPL-3.0 license; some features are inspired by [Rin](https://github.com/openRin/Rin). See the [Reference Projects](#reference-projects) below.

## Previews

<img src="./assets/home.png" alt="Home Preview" width="49%">
<img src="./assets/admin.png" alt="Admin Preview" width="49%">

## Core Features

- **Post Management** — Rich text editor (syntax highlighting / tables / math / TOC), image uploads, draft / publish / scheduled publishing, auto-save.
- **Version History** — Automatic editor snapshots and post version rollback for safe recovery.
- **Tagging System** — Flexible post categorization.
- **Comment System** — Nested replies, email notifications, AI-assisted and context-aware moderation; violating comments are auto-blocked and reported to admins.
- **Friend Links** — Visitor applications, admin moderation, email notifications.
- **Notification System** — Email + webhook channels with per-event subscriptions.
- **Full-Text Search** — High-performance on-site search powered by Orama.
- **Media Library** — R2 object storage for image upload and optimization.
- **Authentication** — GitHub OAuth + email/password registration and login; `ADMIN_EMAIL` is granted admin automatically.
- **MCP Server** — Connect AI clients (Claude, Cursor, etc.) via OAuth to manage posts, comments, tags, friend links, media, and analytics.
- **Analytics** — Built-in pageview stats (Queue + D1) with optional Umami integration.
- **SEO Enhancements** — Canonical URLs, Schema.org structured data, RSS / Sitemap / Robots.txt.
- **AI Integration** — Cloudflare Workers AI or any OpenAI-compatible endpoint (custom Base URL / model / API key), powering summarization, comment moderation, tag suggestions, and one-click article generation.
- **Theme System** — Extensible theme contracts that fully replace pages and layouts (`default` and `fuwari` built in).
- **Import / Export** — Markdown import/export preserving images and frontmatter.

## Tech Stack

### Cloudflare Ecosystem

| Service         | Purpose                                                       |
| :-------------- | :------------------------------------------------------------ |
| Workers         | Edge computing and hosting                                    |
| D1              | SQLite database                                               |
| R2              | Object storage (media files)                                  |
| KV              | Caching layer                                                 |
| Durable Objects | Distributed rate limiting / password hashing                  |
| Workflows       | Asynchronous tasks (content moderation, scheduled publishing) |
| Queues          | Message queues (email notifications)                          |
| Workers AI      | AI capabilities (or a compatible OpenAI endpoint)             |
| Images          | Image optimization (optional)                                 |

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
│   ├── comments/    # Comments, nested replies, moderation
│   ├── tags/        # Tag management
│   ├── media/       # Media uploads, R2 storage
│   ├── search/      # Orama full-text search
│   ├── auth/        # Authentication, permission control
│   ├── dashboard/   # Admin dashboard statistics
│   ├── email/       # Email notifications (SMTP)
│   ├── cache/       # KV caching services
│   ├── config/      # Blog configurations
│   ├── friend-links/# Friend links (applications, moderation)
│   ├── import-export/# Markdown importing/exporting
│   ├── version/     # Version update checker
│   ├── theme/       # Theme system (Contracts, registry, theme implementations)
│   └── ai/          # AI integration (Workers AI / OpenAI-compatible)
├── routes/
│   ├── _public/     # Public pages (Home, post lists/details, search, friend links)
│   ├── _auth/       # Login/registration/password reset
│   ├── _user/       # Profile, friend-link submission
│   ├── admin/       # Admin backend (dashboard, posts, comments, media, tags, friend links, settings)
│   ├── rss[.]xml.ts     # RSS Feed
│   ├── sitemap[.]xml.ts # Sitemap
│   └── robots[.]txt.ts  # Robots.txt
├── components/      # UI components (ui/, common/, layout/, tiptap-editor/)
├── lib/             # Infrastructure (db/, auth/, hono/, middlewares)
└── hooks/           # Custom React Hooks
```

---

## Deployment Guide

The complete flow from **forking the repository** to **going live**. The **GitHub Actions** automated pipeline is recommended (Steps 0–6); a Cloudflare Dashboard manual alternative is also available ([Option 2](#option-2-deploy-via-cloudflare-dashboard)).

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

- [ ] Visit your domain and confirm the homepage, post pages, RSS (`/rss.xml`), Sitemap (`/sitemap.xml`), and Robots (`/robots.txt`) work
- [ ] Open `/admin`, register with `ADMIN_EMAIL`, and the system grants admin automatically
- [ ] In admin **Settings**, fill in site title, description, avatar, favicon, social links, and SEO info
- [ ] Upload an image to verify the media library (R2) works
- [ ] (Optional) Configure SMTP email in admin Settings → Email for code login and comment-reply notifications
- [ ] (Optional) Configure webhook notifications in admin Settings → Webhook with per-event subscriptions
- [ ] (Optional) Enable human verification in admin Settings → Challenge: pick a provider (None / **ALTCHA PoW** / **Cloudflare Turnstile**). Turnstile can auto-fall back to ALTCHA PoW on timeout or repeated failures. Also enable Umami analytics
- [ ] (Optional) Configure AI in admin Settings → AI: Workers AI by default, or switch to an OpenAI-compatible endpoint (fill in Base URL / model / API key and hit "Test connection")
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

> `bun db:migrate` validates `posts` and `comments` key counts before and after migration; in remote mode it records a D1 Time Travel bookmark and auto-restores on failure.

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

### 8. Deployment fails with "Could not find zone" — what do I do?

This happens when `ZONE_NAME` is inferred incorrectly. For example, if your `DOMAIN` is `blog.qyfy.kdns.fr`, the script infers `zone_name` as `kdns.fr`, but the actual Cloudflare Zone is `qyfy.kdns.fr`.

**Fix**: Go to your repository Settings → Secrets and variables → Actions → **Variables** and add:

| Variable | Value |
| :--- | :--- |
| `ZONE_NAME` | Your Cloudflare Zone name (e.g. `qyfy.kdns.fr`) |

> How to find it: In the Cloudflare Dashboard, open your domain — the Zone name is shown in the page title.

---

## Reference Projects

This project is a customization of [flare-stack-blog](https://github.com/du2333/flare-stack-blog) (v1.5.2, GPL-3.0); some features are inspired by [Rin](https://github.com/openRin/Rin). It is open-sourced under the **GPL-3.0** license — see [LICENSE](../LICENSE).

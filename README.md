# Note App

A fast, offline-first **personal notes workspace** that stores your notes as Markdown files in your own **GitHub repositories**. Sign in with GitHub, write in Markdown, and your notes are committed straight to a workspace repo — no proprietary store, you own your data.

Built as an installable **PWA**, so it runs like a native app on iOS, Android, Windows, Linux, and Chrome OS, and keeps working offline.

---

## Features

### 📝 Writing & notes
- **Markdown editor** with live split-pane preview (GitHub-Flavored Markdown via `remark-gfm`, heading slugs via `rehype-slug`).
- **Table of contents** auto-generated from headings, with click-to-scroll.
- **Autosave** — edits to existing notes persist automatically ~1.5s after you stop typing; a quiet `Saving… / Unsaved changes / Saved` indicator keeps you informed. Manual save is still available.
- **Voice typing** — dictate notes using the browser's Speech Recognition (where supported).
- **Inline note creation** — new notes open in place and stay in the editor on first save (no page reload).

### 🗂️ Workspace & files
- **GitHub-backed storage** — every note is a Markdown file committed to a dedicated workspace repo. Personal profile *and* organization workspaces are supported.
- **File tree** with create / rename / delete for both files and folders, plus folder create-in-place.
- **Command palette** (`⌘K` / `Ctrl+K`) — fuzzy search, quick commands (new note/folder, settings, toggle theme), and recently-viewed notes.
- **Hybrid search**:
  - **Name & path search** — instant, local-first over a cached recursive repo index.
  - **Content search** — searches *inside* note bodies. Local cache (instant, offline) merged with GitHub Code Search for notes you haven't opened yet (online), with highlighted snippets.
  - Note bodies are **background-prefetched** into the cache so local/offline content search trends toward exhaustive.

### 📡 Offline-first & sync
- **Installable PWA** — add to home screen / install as an app on iOS, Android, Windows, Linux, and Chrome OS.
- **Works offline** — a service worker caches the app shell (network-first navigation, cache-first static assets) with an offline fallback page.
- **Offline editing** — create and edit notes with no connection. Saves are queued in IndexedDB and sync to GitHub automatically when you reconnect.
- **Conflict resolution** — if a note changed on GitHub while you edited offline, you're prompted to keep your version or GitHub's.
- **Live sync status** in the header — *offline / pending / syncing / conflict / synced*, with click-to-retry.
- **Instant client-side routing** — opening or creating a note swaps the editor pane immediately (no blocking server navigation), while staying deep-linkable and supporting browser back/forward.
- **Update prompt** — when a new version deploys, a non-disruptive "Reload" prompt appears instead of breaking your session.

### 🎨 UI
- **Light / dark theme** (`next-themes`), with persisted preference.
- Built on **shadcn/ui** + **Radix** + **Tailwind CSS v4**.
- Resizable editor/preview panes.

---

## Tech stack

| Area | Tech |
|------|------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Auth | better-auth (GitHub OAuth) |
| Data store (notes) | GitHub repos via Octokit |
| Database (auth/cache) | PostgreSQL + Drizzle ORM |
| Client state / cache | TanStack Query + IndexedDB persistence (`idb-keyval`) |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI |
| Markdown | react-markdown, remark-gfm, rehype-slug |
| PWA | Native Next.js manifest + hand-written service worker |

---

## Getting started

### Prerequisites
- Node.js 20+ and **pnpm**
- A PostgreSQL database (a `docker-compose.yml` is included for local Postgres)
- A **GitHub OAuth App** (for sign-in)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start a database

Use the bundled Postgres, or point at your own:

```bash
docker compose up -d
```

### 3. Configure environment

Create a `.env` (or `.env.local`) with:

```bash
DATABASE_URL=postgres://postgres:password@localhost:5432/note_app
BETTER_AUTH_SECRET=your-random-secret
BETTER_AUTH_URL=http://localhost:4400
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret

# Public base URL the auth client points at (defaults to http://localhost:4400).
# Set this to your deployed origin in production.
NEXT_PUBLIC_APP_URL=http://localhost:4400
```

> Create the GitHub OAuth App under **GitHub → Settings → Developer settings → OAuth Apps**, with the callback URL set to `http://localhost:4400/api/auth/callback/github`.

### 4. Run database migrations

```bash
pnpm db:push      # or: pnpm db:migrate
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:4400](http://localhost:4400).

---

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start the dev server (Turbopack, port 4400) |
| `pnpm build` | Production build |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Type-check with `tsc` |
| `pnpm format` | Format with Prettier |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:push` | Push schema to the database |
| `pnpm db:studio` | Open Drizzle Studio |

---

## Installing as an app (PWA)

- **Android / Chrome OS / Windows / Linux (Chrome/Edge):** an install prompt appears automatically, or use the **Install** button in the app header.
- **iOS / iPadOS (Safari):** tap **Share → Add to Home Screen**.

> PWA install + the service worker require **HTTPS** in production (the service worker is disabled in local dev). Deploy behind HTTPS to test the full install/offline experience.

---

## Notes on data ownership

Your notes never live in a proprietary database — they are plain Markdown files committed to your own GitHub repository. The included Postgres database stores only authentication/session data and a small owner-login cache. You can read, edit, or move your notes with any tool that speaks Git.

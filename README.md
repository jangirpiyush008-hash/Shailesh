# SBJ Technical Works — JobCard Dashboard

AI-ready project management, expense tracking and Job Card generation for **SBJ Technical Works LLC**. Replaces the Excel-based Job Card workflow with a live, collaborative dashboard, and exports back to the exact same Excel template.

## Stack
- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **TailwindCSS** with a minimal in-house UI kit
- **Supabase** (Postgres, Auth, Storage, Row Level Security)
- **ExcelJS** for Job Card export
- **Recharts** for dashboard analytics
- **lucide-react** for icons

## What's shipped in Phase 1
- Auth with 3 roles (`admin`, `coordinator`, `employee`) — RLS enforced in Postgres
- Dashboard with 6 KPIs, revenue-vs-expense trend, category pie, status bar, recent projects, latest expenses
- Projects CRUD with full Job Card metadata (client, LPO, stand, exhibition, dates, coordinator, priority, status)
- Expense management split across the same two columns as your Excel:
  - **Left:** Materials / Transport / Food
  - **Right:** Labour / Vehicle / Food
- Automatic totals (generated `amount` column with the exact formula from the template)
- Activity log (project.created, expense.added, export.excel, etc.)
- Reports tab with category breakdown
- **Excel Job Card export** that reproduces your template pixel-for-pixel: company header, project meta rows 5–10, two-column tables, live SUM formulas at F55/M55, grand total at J57, A4 landscape print setup
- SBJ branding: logo in sidebar and login, favicon, page title

## What's stubbed for Phase 2
- PDF Job Card generator
- Document upload UI (bucket + RLS ready — just needs the client-side upload form)
- Presentation Generator (Gamma API) — needs your API key
- AI content (OpenAI / Claude / Gemini) — needs your API keys
- Excel → Presentation converter
- Admin user management screen
- Mobile PWA offline entry

## Setup

### 1. Install
```bash
cd jobcard-app
npm install
```

### 2. Supabase project
1. Create a free project at https://supabase.com/dashboard
2. Open the SQL editor
3. Paste and run **[supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)** — this creates all tables, RLS policies, auth trigger, expense-category seed data, and the `documents` storage bucket
4. In **Settings → API**, copy the Project URL, `anon` key, and `service_role` key

### 3. Environment
```bash
cp .env.local.example .env.local
```
Edit `.env.local` with your Supabase values:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
COMPANY_NAME="SBJ Technical Works LLC"
COMPANY_ADDRESS="Dubai Industrial City"
```

### 4. Run
```bash
npm run dev
```
Open http://localhost:3000. Create your first user via the **Create account** tab — pick the `Admin` role for yourself.

### 5. First project
1. Log in → **New project**
2. Fill out client, job card number (e.g. `SBJ-JC-26-415`), dates, coordinator
3. Open the project → **Materials / Transport / Food** tab → add expenses
4. Switch to **Labour / Vehicle / Food** → add labour rows with `Total hours` and rate
5. Click **Export Excel** in the header → downloads a Job Card that matches your template

## Excel export — matches your template
The generator writes to the **exact cell coordinates** of your existing template:

| Cell | Content |
|---|---|
| A2 | Company name (merged A2:M2, bold, 18pt) |
| A3 | Company address (merged, italic) |
| A4 | JOB CARD title (merged, gold background) |
| A5–A10 / G5–G10 | Project meta labels |
| D5–F10 / J5–M10 | Project meta values |
| A16:F16 | "Material / Transport / Food Costs" header |
| G16:M16 | "Labour / Transportation Costs" header |
| A17–F17 | Left column headers: Date, Description, UNIT, Quantity, Unit Price, Total |
| G17–M17 | Right column headers: Date, Description, UNIT, Quantity, Total Hours, Unit Price, Total |
| A18–M54 | Line items with live formulas (`=D18*E18` and `=K18*L18` or `=J18*L18`) |
| F55 | `=SUM(F18:F53)` |
| M55 | `=SUM(M18:M54)` |
| J57 | `=F55+M55` — Final Total |

### Adding a raster logo to the Excel
Drop a PNG at `public/sbj-logo.png` (roughly 360×120px). The exporter auto-embeds it in the top-left corner of every Job Card. No code changes needed.

## Roles

| Action | Admin | Coordinator | Employee |
|---|---|---|---|
| Create project | ✅ | ✅ | ❌ |
| Edit project | ✅ | ✅ | ❌ |
| Delete project | ✅ | ❌ | ❌ |
| Add expense | ✅ | ✅ | ✅ (assigned only) |
| Edit/delete expense | ✅ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Configure integrations | ✅ | ❌ | ❌ |
| Export | ✅ | ✅ | ✅ (read-only) |

RLS enforces this at the Postgres level — even a direct API call cannot bypass it.

## Directory
```
jobcard-app/
  app/
    (auth)/login/         — login + register (single page, tabbed)
    (app)/
      dashboard/          — KPIs + charts + recent activity
      projects/           — list, [id]/ detail with tabs, [id]/export → xlsx
      settings/           — integration status (API key manager Phase 2)
    layout.tsx            — root, sets SBJ metadata + favicon
    page.tsx              — redirect to /login or /dashboard
  components/
    ui/                   — Button, Card, Input, Table, Badge, Select
    sidebar.tsx           — SBJ logo + nav + user
    kpi-card.tsx          — reusable KPI tile
    dashboard-charts.tsx  — Recharts wrappers
  lib/
    supabase/{client,server}.ts
    excel.ts              — Job Card workbook builder (matches template exactly)
    utils.ts              — money(), shortDate(), cn()
  supabase/
    migrations/0001_init.sql
  public/
    sbj-logo.svg          — SBJ mark + wordmark (sidebar/login)
    sbj-mark.svg          — mark only (favicon)
  middleware.ts           — auth guard
```

## Deploy to Railway

This repo is Railway-ready. Two ways to deploy:

### Option A — Railway dashboard (easiest)
1. Sign in at https://railway.app
2. **New Project → Deploy from GitHub repo** → pick `jangirpiyush008-hash/Shailesh`
3. Railway auto-detects Next.js via Nixpacks (config pinned in [nixpacks.toml](nixpacks.toml) and [railway.json](railway.json))
4. Open the project → **Variables** tab → add:
   ```
   NEXT_PUBLIC_SUPABASE_URL       = https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = ...
   SUPABASE_SERVICE_ROLE_KEY      = ...
   COMPANY_NAME                   = SBJ Technical Works LLC
   COMPANY_ADDRESS                = Dubai Industrial City
   ```
   (Skip `PORT` — Railway injects it.)
5. **Settings → Networking → Generate Domain** to get a public URL
6. Deploys re-run on every push to `main`

### Option B — Railway CLI
```bash
npm i -g @railway/cli
railway login
railway link          # pick the project
railway up            # deploy from current directory
```

### Health check
Railway pings `/api/health` — the route ships at [app/api/health/route.ts](app/api/health/route.ts) and returns `{ ok: true }`. Configured in [railway.json](railway.json).

### Custom domain
**Settings → Networking → Custom Domain** → point a CNAME to the target Railway shows.

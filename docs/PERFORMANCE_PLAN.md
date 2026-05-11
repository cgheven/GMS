# Pulse GMS — Performance & Hosting Plan

Last reviewed: 2026-05-11

This document captures the diagnosis and recommended path for improving Pulse GMS performance, especially perceived page-navigation speed for Pakistani gym owners on mobile/4G connections.

---

## Current architecture (PRODUCTION as of 2026-05-11)

| Layer | Provider | Tier | Region | Project Ref |
|-------|----------|------|--------|-------------|
| Frontend | Vercel | Hobby | `sin1` (Singapore) | — |
| **Database (PROD)** | Supabase (Postgres) | Free | `ap-southeast-1` (Singapore) | `lefkwupvcdatrgmnefua` |
| Auth | Supabase Auth | Free | Same as DB (Singapore) | — |
| API | Supabase REST (PostgREST) + Next.js Server Actions | Free | Singapore | — |
| Storage | Supabase Storage (if used) | Free | Singapore | — |

**Primary user audience:** Gym owners in Pakistan, mostly mobile, mostly 4G/3G.

**Vercel env vars point to:** Singapore project (`lefkwupvcdatrgmnefua`).

---

## Legacy project (kept for backup)

| Layer | Provider | Region | Project Ref | Status |
|-------|----------|--------|-------------|--------|
| Database | Supabase | `ap-northeast-1` (Tokyo) | `bywainqjiuyqykqdmqut` | **LEGACY — not in use, kept as backup** |

The Tokyo project was the original production database. All data was migrated to Singapore on 2026-05-10 (real customers, real auth users with bcrypt-preserved passwords). Vercel env vars switched to Singapore.

**Decommission plan:** Pause Tokyo project after 14 days of Singapore stability (backups remain available 90 days post-pause). Schedule: ~2026-05-25.

**Do NOT use Tokyo for any new operations.** All migrations, queries, mutations target Singapore.

---

## Where latency actually comes from

User in Pakistan → Vercel edge → Vercel function → Supabase → Postgres → response back.

| Hop | Typical latency | Notes |
|-----|----------------|-------|
| User → Vercel edge | 30–100 ms | Edge auto-routes |
| Vercel edge → Vercel function | 0–50 ms | Depends on function region |
| Vercel function → Supabase | **50–300 ms** | **Massive if regions don't match** |
| Supabase REST API (PostgREST) | 30–100 ms per query | Per-request overhead |
| Postgres query execution | 5–50 ms | Actual SQL work |
| Response back | mirror of above | |

**Concrete example — Dashboard with 17 queries:**
- 17 × ~250 ms (region mismatch + PostgREST overhead) = **4+ seconds of pure network/middleware** before any rendering.
- This is why pages "feel like full reloads" — the server can't send HTML until all data resolves.

---

## Diagnosis of the 3 hosting concerns

### 1. Vercel free tier — mostly fine

- Cold starts (1–3 s) on rarely-hit routes; warm functions are fast.
- 10 s function timeout (acceptable for current workload).
- Not a primary bottleneck.

### 2. Supabase NOT in Singapore region — **major issue** 🔴

If Supabase is in `us-east-1` (US East) and users + Vercel are in/near Asia, every query has 200–300 ms transit each way.

**Fix:** Migrate Supabase project to `ap-southeast-1` (Singapore). Free tier supports this.

**Expected gain alone: 2–3x** for Pakistani users.

### 3. Supabase REST API (PostgREST) overhead — **real but addressable** 🟡

PostgREST adds ~30–100 ms middleware overhead per query. For Dashboard's 17 queries, that's 500–1700 ms of pure overhead.

**Fixes:**
- Bundle multiple queries into Postgres RPC functions (1 round-trip vs N).
- Use Supabase connection pooler (Supavisor) for direct SQL where appropriate.
- Server actions with admin client already bypass some overhead — keep that pattern.

**Expected gain: 1.5–2x** on heavy pages.

---

## The "self-host on same server" question

User asked: "What if we host the website on Vercel like now, and use server for backend API + DB on same server? Performance will boost 10x?"

### Critical insight

**Frontend on Vercel + backend on your VPS = STILL cross-region latency.** Vercel functions don't run on your server — they call your VPS over the internet. The slow leg moves but doesn't disappear.

The ONLY way to get the full localhost-DB win is: **drop Vercel entirely**, run Next.js + Postgres on the same VPS. Then DB calls are localhost (~1 ms instead of 50–200 ms).

### Self-host pros (if dropping Vercel too)

- DB → app latency: 0–2 ms (vs 50–200 ms)
- No PostgREST middleware: skip 30–100 ms per query
- Full control over Postgres tuning, indexes, connection pool
- No artificial rate limits

### Self-host cons (cumulative pain)

| What | Pain level |
|------|-----------|
| Rebuild Supabase Auth (NextAuth.js or Clerk) | 🔴 1–2 weeks |
| Rebuild RLS multi-tenancy in app layer | 🔴 HIGH security regression risk |
| Rebuild Storage / Realtime / cron (if used) | 🟡 1 week each |
| Backups, monitoring, uptime alerts, security patches | 🟡 Ongoing weekly burden |
| DevOps time | 🔴 Steals from product/feature work |
| Predictable cost | 🟡 VPS scales = $$ scales |

### "10x" realistic? — No, **2–5x is realistic**

Why not 10x:
- Browser → server roundtrip still happens (network).
- Geographic distance still matters.
- Frontend bundle parse + browser render + hydration = 500 ms–1 s regardless of backend.
- Most perf wins are from **caching + Suspense + region match**, not infra rewrites.

---

## Options ranked by ROI

### 🥇 Option A — Move Supabase to Singapore + match Vercel region

| | |
|--|--|
| Cost | $0 (free tier supports region change) |
| Effort | 2–3 hours (data migration + DNS swap) |
| Expected gain | **2–3x** for Pakistani users |
| Risk | Low (rollback by reverting env vars) |

**Steps:**
1. Create new Supabase project in `ap-southeast-1`.
2. `pg_dump` from old project, `pg_restore` into new.
3. Re-apply RLS policies, RPC functions, edge functions, custom roles.
4. Update env vars in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
5. Add `vercel.json` with `"regions": ["sin1"]` to pin functions to Singapore.
6. Verify: load app, check `/dashboard`, confirm queries return correct data.
7. Update DNS / Supabase Auth callback URLs if changed.
8. Keep old project running for 1 week as rollback.

**Watch for:** broken edge functions, custom database roles, storage bucket policies, scheduled jobs.

### 🥈 Option B — Bundle queries into Postgres RPC functions

| | |
|--|--|
| Cost | $0 |
| Effort | 1–2 days for top 5 heavy pages |
| Expected gain | **1.5–2x** on pages with many queries |
| Risk | Low (testable per RPC) |

**Approach:** Replace N separate `.from(...)` calls with 1 RPC returning JSON. Pattern already used by `record_inventory_sale`.

**Top targets:**
- `getDashboardData()` — 17 queries → 1 RPC
- `getReportsData()` — 8 queries + processing → 1 RPC
- `getMembers()` — 5 queries + 2 RPC side-effects → 1 unified RPC

### 🥉 Option C — Self-host EVERYTHING on Singapore VPS

| | |
|--|--|
| Cost | $20–50/month (Hetzner / DigitalOcean / Linode) |
| Effort | **2–3 weeks** (auth rewrite, deploy pipeline, backups, monitoring) |
| Expected gain | **3–5x** in best case |
| Risk | HIGH — security regression risk if RLS replacement isn't airtight |

Drop Vercel + Supabase. Run Next.js + Postgres on one VPS. Cloudflare in front for CDN/SSL.

**Required to ship:**
- Auth replacement (NextAuth.js + Postgres adapter, or Clerk)
- RLS replacement (enforce gym_id checks in every query — bug-prone)
- Backup automation (daily `pg_dump` to S3/B2)
- Monitoring (Uptime Robot, Sentry, Grafana)
- TLS cert renewal (Caddy or Certbot)
- CI/CD (GitHub Actions → SSH deploy)

### ❌ Option D — Vercel + self-host backend (the user's original idea as stated)

| | |
|--|--|
| Cost | $20–50/month VPS + Vercel |
| Effort | 1 week |
| Expected gain | **1.5–2x** only — Vercel→VPS hop kills most savings |
| Verdict | **Worst ROI** |

Don't do this unless also dropping Vercel.

---

## Recommended path

### Phase 1 — This week (free, biggest win)

1. **Move Supabase to Singapore** (Option A) — ~3 hours.
2. **Pin Vercel functions to `sin1`** (config change, 5 min).
3. **Measure** before/after: TTFB, FCP, LCP on `/dashboard`, `/members`, `/smart-earn`.
4. Tell users; collect feedback.

**Decision gate:** if perceived speed satisfies users → stop here.

### Phase 2 — If still not enough (1–2 weeks)

1. **Bundle heavy pages into RPC functions** (Option B): dashboard, reports, members.
2. **Continue cache rollout** — wrap remaining read fetchers in `unstable_cache` with proper tag invalidation.
3. **Suspense streaming** on remaining heavy pages.
4. Re-measure.

### Phase 3 — Only if business demands it

Migrate to self-hosted (Option C). Triggers:
- Paying customer count > 50 with multiple per-day complaints
- Supabase free tier limits hit consistently
- Specific compliance requirement (data residency in Pakistan)
- Need features Supabase doesn't offer (custom Postgres extensions, etc.)

**Don't migrate prematurely.** Self-hosting steals owner attention from product work.

---

## What's slow on Pulse right now (impact ranking)

| # | Bottleneck | Impact | Fix path |
|---|-----------|--------|----------|
| 1 | Region mismatch (Supabase not in Singapore) | ~50% of slowness | Option A |
| 2 | 17-query dashboards (PostgREST overhead) | ~20% of slowness | Option B |
| 3 | No data cache on most fetchers | ~15% of slowness | unstable_cache rollout (in progress) |
| 4 | Large client bundles on heavy pages | ~10% of slowness | Code-split, dynamic imports, tree-shake |
| 5 | Cold starts on Vercel free tier | ~5% of slowness | Paid tier or self-host |

**Compounded fix (Phases 1+2): ~3–5x perceived speedup with zero infra change.**

---

## What's already done

- ✅ DB safety + index limits applied (Phase A earlier this session)
- ✅ Dead npm deps removed (~1.1 MB node_modules saved)
- ✅ Inventory v1 module shipped with proper caching
- ✅ 10 new `loading.tsx` skeletons added
- ✅ Suspense streaming on `/dashboard`, `/reports`, `/members`
- ✅ Suspense streaming + `unstable_cache` on `/smart-earn`
- ✅ `revalidateSmartEarn()` server action wired into staff mutations
- ✅ Auth profile cache (`pulse_profiles` + `pulse_gyms` cached 5 min, tagged per user)
- ✅ Dashboard cache (60s TTL, full mutation invalidation wiring)
- ✅ Sidebar prefetch reduced from 17 → 5 most-used routes
- ✅ **Singapore migration COMPLETED** (2026-05-10) — full data + auth users copied from Tokyo
- ✅ **Vercel functions pinned to `sin1`** via `vercel.json`
- ✅ **Vercel env vars switched to Singapore project** — live prod runs on SG
- ✅ RBAC v1 shipped (Phase E) — granular permissions on `pulse_staff`, page guards, sidebar filtering, server-action checks

## What's pending

- [ ] Bundle dashboard 17 queries into 1 RPC (Phase 2 of plan)
- [ ] Bundle reports queries into 1 RPC
- [ ] Roll out Suspense + cache to remaining pages (`/social-media`, `/payments`, `/leads`, `/staff`, `/referrers`, `/bills`, `/expenses`, `/inventory`, `/classes`)
- [ ] Image optimization (no `next/image` usage detected — replace any raw `<img>` in social-media)
- [ ] Font weight pruning (Inter loads unused 300/800)
- [ ] Cache-Control headers for `/public` static assets
- [ ] Decommission Tokyo project after 14 days of SG stability (target: ~2026-05-25)
- [ ] RBAC polish: hide delete/edit buttons in members-client based on permission (UX, not security)

---

## Tracking notes

- Free-tier Vercel function cold starts: acceptable for current scale; revisit at 100+ DAU.
- Supabase free tier limits: 500 MB DB, 50 K monthly active users — verify against real usage before paid upgrade.
- Pakistani 4G median latency to Singapore: ~80–120 ms; to US-East: ~250–350 ms.
- Pulse's heaviest page is `/dashboard` (17 queries, ~250 ms each on cold cache).

---

## 🔒 Migration policy (CRITICAL — read before any DB change)

**All future migrations target SINGAPORE only. Tokyo is legacy.**

### Why this matters

The Supabase MCP server is currently configured to point at the **Tokyo** project (`bywainqjiuyqykqdmqut`). Migrations applied via `mcp__supabase__apply_migration` will land on Tokyo, NOT Singapore. This caused a real incident on 2026-05-11 — RBAC migrations went to Tokyo instead of Singapore, and the production app (which hits Singapore) errored with "column does not exist in schema cache."

### Safe migration procedure

For ALL schema changes (CREATE/ALTER TABLE, CREATE POLICY, CREATE FUNCTION, etc.):

**Step 1.** Write SQL to a file in `supabase/migrations/YYYY-MM-DD-description.sql`. Include header comment listing both target projects.

**Step 2.** Apply directly to **Singapore** via Docker psql:

```bash
docker run --rm -i \
  -v /path/to/supabase/migrations/YYYY-MM-DD-description.sql:/migration.sql \
  postgres:17 psql \
  "postgresql://postgres.lefkwupvcdatrgmnefua:<SG_DB_PASSWORD>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" \
  -v ON_ERROR_STOP=1 -f /migration.sql
```

**Step 3.** Verify on Singapore via psql or direct REST API:

```bash
curl -s "https://lefkwupvcdatrgmnefua.supabase.co/rest/v1/<table>?select=<new_column>&limit=1" \
  -H "apikey: <SG_ANON_KEY>"
```

If returns data or `[]` (instead of "column does not exist") → cache fresh, migration live.

**Step 4.** If PostgREST cache stale (rare on Pro tier, common on Free tier):
```sql
NOTIFY pgrst, 'reload schema';
```
If that doesn't work after ~30s: pause + restore Singapore project from dashboard.

**Step 5.** DO NOT apply to Tokyo unless explicitly decommissioning legacy or syncing as backup.

### What NOT to do

❌ Don't use `mcp__supabase__apply_migration` — it goes to Tokyo (wrong project). Until the MCP server config is updated to point at Singapore, always use Docker psql + connection string with Singapore credentials.

❌ Don't use `supabase db push` linked to the Tokyo project ref.

❌ Don't trust Supabase Dashboard "Run SQL" without confirming you're on the Singapore project page (URL contains `lefkwupvcdatrgmnefua`).

### Credentials (rotate after Tokyo decommission)

- **Singapore DB password:** stored in 1Password (NEVER paste in repo, chat, or docs — rotate immediately if leaked)
- **Singapore project ref:** `lefkwupvcdatrgmnefua`
- **Singapore pooler host:** `aws-1-ap-southeast-1.pooler.supabase.com`
- **Singapore service role key:** in `.env.local.singapore` and Vercel env vars

### Existing migrations applied to Singapore (verified)

- `pulse_inventory_v1` — 3 tables + indexes + RLS (applied during inventory feature ship)
- `pulse_inventory_record_sale_fn_v2` — atomic FIFO RPC
- `pulse_staff_add_permissions_column` — RBAC v1 column (2026-05-11)
- `rbac_rls_tighten_gym_scope` — `pulse_members_owner_delete` + `pulse_payments_staff_insert` policies (2026-05-11)

### Cleanup task — switch MCP to Singapore

To eliminate the wrong-project risk, update the Supabase MCP server configuration in Claude Desktop / `~/.claude/.mcp.json` to point at Singapore project ref `lefkwupvcdatrgmnefua` instead of Tokyo. After switching, future `apply_migration` and `execute_sql` calls will target the right project.

---

## Risks & rollback

For each option, the rollback path:

- **Option A (region migration):** keep old Supabase project alive for 1 week. Revert Vercel env vars to point back. DNS unchanged.
- **Option B (RPC bundling):** add new RPC alongside existing query path. Switch fetcher to RPC. Revert one-line if buggy.
- **Option C (self-host):** can't easily rollback once migrated; treat as one-way door. Run both stacks in parallel for 2 weeks before cutover.

---

## When to revisit this plan

- After Phase 1 measurement → update with real numbers.
- After 100 paying customers → re-evaluate Option C.
- If Supabase pricing changes materially → re-evaluate.
- If business adds requirement Supabase can't meet (e.g., on-prem deploys for enterprise gym chains) → Option C becomes mandatory.

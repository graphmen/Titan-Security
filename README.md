# Titan Protection Security

Guard and security operations platform — web command centre plus mobile guard app.

| App | Folder | Stack |
|-----|--------|-------|
| **Command Centre** | `web/` | Next.js 16, Supabase |
| **Guard Mobile App** | `mobile/` | React, Vite, Capacitor |

## Deploy to Vercel (web dashboard)

1. Import [graphmen/Titan-Security](https://github.com/graphmen/Titan-Security) in [Vercel](https://vercel.com/new).
2. Set **Root Directory** to `web`.
3. Add these **Environment Variables** (Production + Preview):

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon / publishable key |
| `DATABASE_URL` | Yes | Postgres connection string (Supabase → Database → URI) |
| `FORCE_SUPABASE` | Yes | Set to `1` |
| `WHATSAPP_PHONE_NUMBER_ID` | No | Meta WhatsApp Cloud API |
| `WHATSAPP_CLOUD_TOKEN` | No | Meta WhatsApp Cloud API |
| `WHATSAPP_API_VERSION` | No | e.g. `v21.0` |

4. Deploy. Vercel will run `npm install` and `npm run build` inside `web/`.

Copy variable names from `web/.env.example`. **Do not commit** `.env.local`.

### Database migrations

Run SQL in the Supabase SQL editor (in order):

- `web/supabase/002_relational_schema.sql`
- `web/supabase/003_guards_next_of_kin_columns.sql`

### Mobile app after deploy

Point guards to your Vercel URL in the mobile app **Server** field, e.g. `https://your-project.vercel.app`.

## Local development

```bash
cd web && npm install && npm run dev -- -p 3001
cd mobile && npm install && npm run dev
```

## Self-host (Windows server)

```powershell
cd web
.\scripts\start-production.ps1
```

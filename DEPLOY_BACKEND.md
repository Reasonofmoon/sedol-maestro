# Deploying the Analysis Backend (Render) + connecting the Vercel frontend

The deployed frontend (https://baduck-coding.vercel.app) shows **"analysis server connection required"** because it calls a backend that isn't hosted yet:

```ts
// frontend/src/api/client.ts
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
//   GET  ${API_BASE}/api/health    ← liveness probe (3s timeout)
//   POST ${API_BASE}/api/analyze   ← real analysis
```

Because the frontend is HTTPS, the backend **must also be HTTPS** (browsers block HTTP "mixed content"). Render gives you a free HTTPS URL.

---

## Step 1 — Deploy the backend to Render (Blueprint)

1. Push `render.yaml` (repo root) to `main` — already committed.
2. Go to **https://render.com → New → Blueprint**.
3. **Connect** the `Reasonofmoon/sedol-maestro` repo. Render reads `render.yaml` and proposes a web service `sedol-maestro-backend`.
4. When prompted, set the secret **`ANTHROPIC_API_KEY`** = your Anthropic key. (Without it the API still runs but returns heuristic candidates, not real 묘수.)
5. Click **Apply / Create**. First build runs `npm install && npm run build`, then `npm start`.
6. When it's live you get a URL like **`https://sedol-maestro-backend.onrender.com`**.

**Verify the backend by itself:**
```bash
curl https://sedol-maestro-backend.onrender.com/api/health
# → expect HTTP 200 with a small JSON body
```

---

## Step 2 — Point the frontend at the backend (Vercel)

The frontend is a separate Vercel project (repo `Reasonofmoon/baduck-coding`).

1. **Vercel dashboard → the baduck-coding project → Settings → Environment Variables.**
2. Add: **`VITE_API_URL`** = `https://sedol-maestro-backend.onrender.com` (Production scope; Vite needs the `VITE_` prefix to expose it to the browser).
3. **Redeploy** the frontend (Deployments → ⋯ → Redeploy) so the new env var is baked into the build.
4. Open https://baduck-coding.vercel.app — the "connection required" banner should clear and analysis should work.

---

## Step 3 — Keep it awake for judging (important on free tier)

Render's **free plan sleeps after ~15 min idle**, and waking takes ~50s. The frontend's health probe times out at **3 seconds**, so a sleeping backend looks dead even though it's fine.

Pick one:
- **Easiest:** before recording the demo (and before judges look), open `https://sedol-maestro-backend.onrender.com/api/health` once and wait ~1 min until it's warm.
- **Hands-off:** create a free ping at **cron-job.org** (or UptimeRobot) hitting `/api/health` every **10 minutes** so it never sleeps during the judging window.
- **Robust:** upgrade that Render service to a paid always-on instance for the duration of judging.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Render rejects `runtime: node` in the Blueprint | Change it to `env: node` in `render.yaml`. |
| Build fails on `npm run build` | Confirm `backend/package.json` has `"build": "tsc"`; check the Render build log for the failing file. |
| Frontend still says "connection required" after redeploy | Confirm `VITE_API_URL` is set in **Production** scope and you **redeployed** (Vite inlines env at build time, not runtime). Hit `/api/health` directly to rule out cold start. |
| `Mixed Content` error in browser console | The backend URL must be **https**, not http. |
| CORS error | Backend defaults to `origin: '*'`. If you set `FRONTEND_URL`, it must exactly match the Vercel origin. |
| 429 / rate limited | `backend/src/rate-limiter.ts` is active; wait or relax the limit for the demo. |

---

## Result
Once Steps 1–2 are done and the service is warm, https://baduck-coding.vercel.app is a **judge-clickable live demo** — add it to the Devpost "Try it out" field.

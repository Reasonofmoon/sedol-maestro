# Sedol Maestro — UiPath Maestro Case + Action Center Integration Guide

**Track:** UiPath AgentHack 2026 · Track 1 — Maestro Case
**Goal:** Make the "Atari → suspend → human plays the 78th move → resume" loop a **real** UiPath Maestro agentic process with an Action Center Human-in-the-Loop (HITL) task, wired to the existing Express backend.

This guide gives: (1) the end-to-end architecture, (2) the BPMN process you build in Studio Web, (3) the Action Center task form, (4) the `uipath/` folder layout, (5) concrete backend code to add, and (6) a step-by-step build + auth checklist.

> Maestro models processes with **BPMN**, decisions with **DMN**, calls external systems with **Service Tasks**, and pauses for humans with **User Tasks** (surfaced in **Action Center**). We use exactly those four primitives.

---

## 1. End-to-end architecture

```
  Express backend (existing)                      UiPath Automation Cloud
  ──────────────────────────                      ────────────────────────
  candidates.ts → entropy H                        Maestro Agentic Process
        │                                          "SedolMaestro.RescueCase" (BPMN)
        │  H < 1.2  (Atari!)                                │
        ▼                                                   │
  POST /atari  ─────── (1) start case via API ────────────▶ ● Start
   uipath-client.ts                                         │
   (OAuth2 client-creds token → start Maestro process,      ▼
    pass {caseId, repo, file, diff, winRate, entropy})   ┌─ Service Task: "FetchProposedMove"
                                                          │     → GET backend /case/{id}/move
                                                          ▼
                                                       ◇ Gateway / DMN: "Is Atari? (H<1.2)"
                                                          │ yes
                                                          ▼
                                                       ⬛ User Task: "Approve the 78th Move"
                                                          │  (Action Center — process PAUSES)
                                                          │  human reviews express.json→express.raw
                                                          │  → Approve / Reject
                                                          ▼
                                                       ┌─ Service Task: "ApplyVerdict"
   POST /maestro/callback ◀── (2) resume callback ─────┘     → POST backend /maestro/callback
   backend applies patch, reruns tests (7/7),               {approved, decision, taskId}
   appends to Kifu (SGF)                                     ▼
                                                          ● End
```

Two HTTP hops, both real:
1. **Backend → UiPath** starts the Maestro case when entropy collapses.
2. **UiPath → Backend** calls back after the human approves, so the backend applies the fix and records the Kifu.

---

## 2. The Maestro agentic process (build in Studio Web)

Process name: **`SedolMaestro.RescueCase`** · Type: **Agentic process (BPMN)** · Track: Maestro Case.

| # | BPMN element | Type | Configuration |
|---|---|---|---|
| 1 | **Start** | Start event | Inputs (process arguments): `caseId` (String), `repoUrl` (String), `targetFile` (String), `diff` (String), `winRate` (Int), `entropy` (Double). |
| 2 | **FetchProposedMove** | **Service Task** | `GET {BackendBaseUrl}/case/{caseId}/move`. Stores the agent's proposed patch + reasons into process variables. (Optional if you already pass `diff` at Start.) |
| 3 | **Is Atari?** | **Gateway** (+ optional **DMN** table) | Condition `entropy < 1.2`. DMN table maps entropy→severity (`>3.5 healthy`, `1.2–3.5 watch`, `<1.2 ATARI`). Only ATARI routes to the human task. |
| 4 | **Approve the 78th Move** | **User Task** (Action Center) | Assignee = reviewer/group. Form = `MyosuApprovalForm` (see §3). Inputs: file, diff, winRate, entropy, reasons. Outputs: `approved` (Boolean), `decisionNote` (String). **Process pauses here until completed.** Add an **escalation/timeout** (e.g., 30 min → auto-reject) so the case never hangs. |
| 5 | **ApplyVerdict** | **Service Task** | `POST {BackendBaseUrl}/maestro/callback` with `{ caseId, taskId, approved, decisionNote }`. Backend applies (or aborts) the patch and reruns tests. |
| 6 | **End** | End event | Output `caseStatus` = `Resolved` / `Rejected`. |

**Why this scores:** the suspend/resume, the exception gateway, and the human approval are all *inside the Maestro BPMN* — judges see orchestration, not just a script calling an API.

---

## 3. Action Center HITL task — `MyosuApprovalForm`

A Form/App task that shows the human everything needed to play the 78th move. Suggested fields:

```jsonc
// uipath/forms/MyosuApprovalForm.json  (logical schema — recreate in the Studio Web form designer)
{
  "title": "Sedol Maestro — Approve the 78th Move",
  "readOnly": [
    { "label": "Case ID",            "key": "caseId" },
    { "label": "File in Atari",      "key": "targetFile" },
    { "label": "MCTS Win-Rate",      "key": "winRate",  "suffix": "%" },
    { "label": "Shannon Entropy",    "key": "entropy",  "suffix": " bits", "highlightIf": "< 1.2" },
    { "label": "Why the agent is stuck", "key": "atariReason", "type": "textarea" },
    { "label": "Proposed patch (diff)",  "key": "diff",        "type": "code", "language": "diff" }
  ],
  "input": [
    { "label": "Decision", "key": "approved", "type": "radio",
      "options": [ { "value": true, "label": "Approve 묘수 (apply express.raw patch)" },
                   { "value": false, "label": "Reject (send back to agent)" } ] },
    { "label": "Reviewer note", "key": "decisionNote", "type": "textarea", "required": false }
  ]
}
```

The demo's canonical content: `targetFile = server.ts`, `entropy = 0.58`, `diff` = the `express.json()` → `express.raw({ type: 'application/json' })` change that restores the raw-body buffer for Stripe signature verification.

---

## 4. `uipath/` folder layout (commit this to the repo)

```bash
uipath/
├── README.md                         # import + configure instructions (point judges here)
├── SedolMaestro.RescueCase/          # the Studio Web project (export/publish output)
│   ├── project.json                  # UiPath project descriptor
│   ├── process.bpmn                  # the agentic process (Maestro BPMN)
│   ├── decisions/
│   │   └── AtariSeverity.dmn         # entropy → severity decision table
│   └── forms/
│       └── MyosuApprovalForm.json    # Action Center task form
├── workflows/                        # (if any reusable .xaml invoked by service tasks)
├── assets/
│   └── orchestrator-assets.json      # asset names: BackendBaseUrl, ReviewerQueue, etc.
├── config/
│   └── env.sample                    # UIPATH_* values needed by the backend (no secrets)
└── api/
    └── sedol-maestro.http            # ready-to-run REST calls: get token, start case
```

> If Studio Web exports a `.nupkg`, also commit it under `uipath/dist/` so the artifact is reproducible. Keep the **source** (`process.bpmn`, `.dmn`, form json) in git so the README's claims are verifiable.

---

## 5. Backend changes (TypeScript / Express)

Node 20+ has global `fetch`, so no new dependency is required. Add one client + two endpoints.

### 5.1 `backend/src/uipath-client.ts` (new)

```ts
// UiPath Automation Cloud client — OAuth2 client-credentials + start a Maestro process.
// Falls back to a local simulator when UIPATH_* env vars are absent (demo never stalls).

const {
  UIPATH_ORG, UIPATH_TENANT, UIPATH_CLIENT_ID, UIPATH_CLIENT_SECRET,
  UIPATH_FOLDER_ID, UIPATH_PROCESS_KEY,
} = process.env;

const CLOUD = 'https://cloud.uipath.com';
export const isUiPathLive = Boolean(UIPATH_CLIENT_ID && UIPATH_CLIENT_SECRET && UIPATH_ORG);

async function getToken(): Promise<string> {
  const res = await fetch(`${CLOUD}/identity_/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: UIPATH_CLIENT_ID!,
      client_secret: UIPATH_CLIENT_SECRET!,
      // scope must match the External Application's granted scopes:
      scope: 'OR.Jobs OR.Folders OR.Execution OR.Tasks',
    }),
  });
  if (!res.ok) throw new Error(`UiPath token failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export interface AtariContext {
  caseId: string; repoUrl: string; targetFile: string;
  diff: string; winRate: number; entropy: number; atariReason: string;
}

// Start the Maestro agentic process, passing the Atari context as input arguments.
export async function startRescueCase(ctx: AtariContext): Promise<{ live: boolean; jobId?: string }> {
  if (!isUiPathLive) {
    console.log('[UiPath] Simulator fallback — no credentials. Would start RescueCase:', ctx.caseId);
    return { live: false };
  }
  const token = await getToken();
  const base = `${CLOUD}/${UIPATH_ORG}/${UIPATH_TENANT}/orchestrator_`;
  const res = await fetch(`${base}/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-UIPATH-OrganizationUnitId': String(UIPATH_FOLDER_ID),
    },
    body: JSON.stringify({
      startInfo: {
        ReleaseKey: UIPATH_PROCESS_KEY,            // the published RescueCase release
        Strategy: 'ModernJobsCount',
        JobsCount: 1,
        InputArguments: JSON.stringify({
          caseId: ctx.caseId, repoUrl: ctx.repoUrl, targetFile: ctx.targetFile,
          diff: ctx.diff, winRate: ctx.winRate, entropy: ctx.entropy, atariReason: ctx.atariReason,
        }),
      },
    }),
  });
  if (!res.ok) throw new Error(`StartJobs failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { value: Array<{ Id: number }> };
  return { live: true, jobId: String(data.value?.[0]?.Id) };
}
```

### 5.2 `backend/src/server.ts` (add two endpoints)

```ts
import { startRescueCase, isUiPathLive } from './uipath-client';

// Pending cases the UI/Action Center can read (in-memory for the demo).
const cases = new Map<string, any>();

// (1) Backend detects Atari → trigger the Maestro case.
app.post('/atari', async (req, res) => {
  const { repoUrl, targetFile, diff, winRate, entropy, atariReason } = req.body;
  const caseId = `CASE-${Date.now().toString(36).toUpperCase()}`;
  cases.set(caseId, { status: 'SUSPENDED', targetFile, diff, winRate, entropy });
  const r = await startRescueCase({ caseId, repoUrl, targetFile, diff, winRate, entropy, atariReason });
  res.json({ caseId, dispatched: r.live ? 'uipath' : 'simulator', jobId: r.jobId });
});

// Service Task reads the proposed move (step 2 of the BPMN, optional).
app.get('/case/:id/move', (req, res) => {
  const c = cases.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'unknown case' });
  res.json(c);
});

// (2) Maestro calls back after the human approves/rejects → apply verdict.
app.post('/maestro/callback', async (req, res) => {
  const { caseId, taskId, approved, decisionNote } = req.body;
  const c = cases.get(caseId);
  if (!c) return res.status(404).json({ error: 'unknown case' });
  if (approved) {
    // apply the express.raw patch, rerun tests, append SGF Kifu...
    c.status = 'RESOLVED'; c.taskId = taskId; c.decisionNote = decisionNote;
  } else {
    c.status = 'REJECTED'; c.decisionNote = decisionNote;
  }
  res.json({ caseId, status: c.status });
});
```

### 5.3 Environment (`backend/.env`)

```bash
ANTHROPIC_API_KEY=sk-ant-...
# UiPath live dispatch (omit all to use simulator fallback)
UIPATH_ORG=your-org
UIPATH_TENANT=DefaultTenant
UIPATH_CLIENT_ID=...
UIPATH_CLIENT_SECRET=...
UIPATH_FOLDER_ID=123456          # Orchestrator folder (X-UIPATH-OrganizationUnitId)
UIPATH_PROCESS_KEY=...           # ReleaseKey of the published RescueCase
```

---

## 6. Step-by-step build (do this in order)

### A. Author the process in Studio Web
1. Open **UiPath Automation Cloud → Studio Web → New → Agentic process**. Name it `SedolMaestro.RescueCase`.
2. Drag a **Start** event; define the input arguments from §2 row 1.
3. Add a **Service Task** `FetchProposedMove` (optional) → HTTP `GET` to `BackendBaseUrl/case/{caseId}/move`. Store `BackendBaseUrl` as an **Orchestrator Asset**, not hard-coded.
4. Add a **Gateway** (optionally backed by a **DMN** table `AtariSeverity.dmn`) with condition `entropy < 1.2`.
5. Add a **User Task** `Approve the 78th Move`; build the form per §3; set assignee + a timeout/escalation.
6. Add a **Service Task** `ApplyVerdict` → HTTP `POST` to `BackendBaseUrl/maestro/callback` with the task outputs.
7. Add an **End** event. **Validate** and **Publish** the process.

### B. Wire authentication (so the backend can start it)
8. **Admin → External Applications → Add Application** → *Confidential* → grant scopes `OR.Jobs`, `OR.Folders`, `OR.Execution`, `OR.Tasks`. Copy **Client ID / Secret**.
9. Find the **Folder ID** and the published process **Release Key** in Orchestrator; put all values in `backend/.env`.

### C. Wire the backend
10. Add `uipath-client.ts` and the three endpoints (§5). `npm run dev:backend`.
11. Trigger a test: `POST http://localhost:3001/atari` with the Stripe-deadlock body. Confirm a job starts in Orchestrator and a task appears in **Action Center**.
12. Approve the task in Action Center → confirm `POST /maestro/callback` fires and the case flips to `RESOLVED`.

### D. Commit the artifacts
13. Export/publish the Studio Web project into `uipath/SedolMaestro.RescueCase/` (keep `process.bpmn`, `.dmn`, form json in git). Commit with the `uipath/README.md`.

---

## 7. Acceptance checklist (maps to the rules + judging)

- [ ] A **real** Maestro agentic process exists in Studio Web and is **published** (Track 1 requirement: "new app using UiPath Studio Web").
- [ ] The process contains a **User Task** that pauses for a human and resumes (the 78th move).
- [ ] `uipath/` in the repo holds the **source** artifacts (BPMN, DMN, form) — README claims are now verifiable.
- [ ] Backend `/atari` starts the case live when `UIPATH_*` is set; **simulator fallback** logs the same flow when it isn't.
- [ ] The demo video (1:38–2:18) shows the **Action Center approval** end-to-end.
- [ ] README "UiPath components used" list matches what's actually in `uipath/`.

---

## 8. If you run out of time (minimum viable, still compliant)

Cut the Service Tasks and DMN. Keep the smallest real Maestro process that still satisfies Track 1:
**Start → User Task (Approve 78th Move, Action Center) → End**, started by the backend `/atari` call, with the human approval visibly pausing/resuming the case. That alone gives you a genuine Studio Web app + a real HITL task — enough to be eligible — and you can narrate the rest.

---

*Sources for UiPath primitives:* Maestro User task & Service task docs, Maestro publishing docs (docs.uipath.com/maestro). Confirm exact scope names, Release Key, and Folder ID in **your** tenant — they are tenant-specific.

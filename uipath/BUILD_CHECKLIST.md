# RescueCase — Studio Web Build Checklist (click-by-click)

Granular breakdown of `uipath/README.md` §6. Tick each box. **UI labels can vary slightly by Maestro/Studio Web version** — where a label differs, match by *meaning* (the canonical reference is [Maestro User task](https://docs.uipath.com/maestro/automation-cloud/latest/user-guide/user-task)).

Target: a published Maestro agentic process **`SedolMaestro.RescueCase`** with one Action Center approval task that pauses and resumes.

---

## Phase A — Create the process

- [ ] A1. Go to **cloud.uipath.com** → open **Studio Web**.
- [ ] A2. Click **New** → **Agentic process** (a.k.a. *Process* / *Maestro process* depending on version).
- [ ] A3. Name it `SedolMaestro.RescueCase`. Pick the folder you'll publish to (note this folder — you need its **Folder ID** in Phase B).
- [ ] A4. You now see the **BPMN canvas** with a **Start** node.

## Phase B — Define process inputs (arguments at Start)

- [ ] B1. Open the process **Arguments** / **Variables** panel (right side or via the Start node).
- [ ] B2. Using **Add new → Add Variable**, create these **Input** arguments (name · type):
  - [ ] `caseId` · String
  - [ ] `repoUrl` · String
  - [ ] `targetFile` · String
  - [ ] `diff` · String
  - [ ] `winRate` · Int32
  - [ ] `entropy` · Double
  - [ ] `atariReason` · String
- [ ] B3. These names **must match** the `InputArguments` JSON the backend sends (see `uipath/api/sedol-maestro.http` request #2).

## Phase C — (Optional) Service Task: fetch the proposed move

> Skip C entirely if you pass `diff` at Start (simplest). Add it only if you want the process to pull the move itself.

- [ ] C1. Drag a **Service Task** onto the canvas after Start. Name it `FetchProposedMove`.
- [ ] C2. In its **Action** dropdown, choose the HTTP/Connector option (e.g. **HTTP Request**).
- [ ] C3. Method `GET`, URL `{BackendBaseUrl}/case/{caseId}/move`.
- [ ] C4. Store `BackendBaseUrl` as an **Orchestrator Asset**, not hard-coded; bind `caseId` from the argument.
- [ ] C5. Map the response into process variables (e.g. `diff`, `winRate`, `entropy`).

## Phase D — Gateway: only escalate on Atari

- [ ] D1. Drag an **Exclusive Gateway** after Start (or after C).
- [ ] D2. Condition on the path to the human task: `entropy < 1.2`.
- [ ] D3. The "else" path goes straight to **End** (no human needed when the agent is healthy).
- [ ] D4. *(Optional)* Replace the raw condition with a **DMN** decision (`AtariSeverity`): input `entropy` → output `severity` (healthy / watch / atari); route on `severity == "atari"`.

## Phase E — User Task: the 78th-move approval (the key step)

- [ ] E1. Drag a **User Task** onto the Atari branch. Name it `Approve the 78th Move`.
- [ ] E2. In its **Action** dropdown, select **Create Action App task** (this is the Action Center task).
- [ ] E3. **Design the form** to match `uipath/forms/MyosuApprovalForm.json`:
  - [ ] Read-only fields: `caseId`, `targetFile`, `winRate` (%), `entropy` (bits, highlight if < 1.2), `atariReason`, `diff` (code/diff display).
  - [ ] Input control: `approved` (radio: Approve / Reject) — **required**.
  - [ ] Input control: `decisionNote` (multi-line text) — optional.
- [ ] E4. **Map inputs** (process variable → form field): `caseId, targetFile, winRate, entropy, atariReason, diff`.
- [ ] E5. **Map outputs** (form → process variable) via **Add new → Add Variable**: `approved` (Boolean), `decisionNote` (String).
- [ ] E6. Set the **Assignee** (a user or group that will see it in Action Center).
- [ ] E7. Set **Priority = High**; add an **escalation/SLA** (e.g. 30 min → auto-reject) so the case can't hang forever.
- [ ] E8. Confirm: the process **pauses automatically** at this task until the assignee submits — no extra "wait" node needed.

## Phase F — Service Task: apply the verdict (resume → backend)

- [ ] F1. Drag a **Service Task** after the User Task. Name it `ApplyVerdict`.
- [ ] F2. **Action** = HTTP Request. Method `POST`, URL `{BackendBaseUrl}/maestro/callback`.
- [ ] F3. Body (JSON): `{ "caseId": caseId, "taskId": <taskId>, "approved": approved, "decisionNote": decisionNote }` — bind from variables.
- [ ] F4. Add an **End** event after it. Set output `caseStatus` = Resolved/Rejected if desired.

## Phase G — Validate & Publish

- [ ] G1. Click **Validate** (or **Analyze**) — fix any unbound variable / missing-mapping errors.
- [ ] G2. Click **Publish**. Choose the same folder from A3.
- [ ] G3. In **Orchestrator → Automations → Processes**, confirm `SedolMaestro.RescueCase` appears. Open it → copy the **Release Key** → put in `backend/.env` as `UIPATH_PROCESS_KEY`.

## Phase H — Auth (so the backend can start it)

- [ ] H1. **Admin → External Applications → Add Application** → type **Confidential**.
- [ ] H2. Add **Application Scopes**: `OR.Jobs`, `OR.Folders`, `OR.Execution`, `OR.Tasks`.
- [ ] H3. Copy **Client ID** and **Client Secret** → `backend/.env` (`UIPATH_CLIENT_ID`, `UIPATH_CLIENT_SECRET`).
- [ ] H4. Find the **Folder ID** (Orchestrator → folder settings, or the API) → `UIPATH_FOLDER_ID`.
- [ ] H5. Fill `UIPATH_ORG`, `UIPATH_TENANT` from your cloud URL `cloud.uipath.com/{ORG}/{TENANT}`.

## Phase I — End-to-end test

- [ ] I1. Run request #1 in `uipath/api/sedol-maestro.http` → you get an `access_token` (auth works).
- [ ] I2. Run request #2 (StartJobs) → a job starts; check **Orchestrator → Jobs**.
- [ ] I3. Open **Action Center** → the `Approve the 78th Move` task is waiting → it shows the diff/entropy.
- [ ] I4. Click **Approve** → the case resumes → `ApplyVerdict` fires `POST /maestro/callback` to your backend.
- [ ] I5. Backend flips the case to `RESOLVED` (watch the backend log). ✅ Round-trip proven.

## Phase J — Commit the artifacts

- [ ] J1. Export/publish the project source into `uipath/SedolMaestro.RescueCase/` (keep `process.bpmn`, any `.dmn`, the form).
- [ ] J2. `git add uipath/ && git commit -m "feat(uipath): add published RescueCase Maestro process" && git push`.
- [ ] J3. Re-read the main `README.md` "UiPath components used" list — every item should now exist in the repo.

---

### Minimum viable (if time runs out)
Do **A → B → E → G → H → I** only. Skip C, D, F. That gives: `Start → User Task (Action Center approval) → End`, started by the backend, with a real pause/resume. It's enough to satisfy Track 1 (a real Studio Web app + a real HITL task) — narrate the Service Tasks/DMN as "next."

### Record while you build
Phases **I3–I4** (the Action Center approval) are exactly the demo video's 1:38–2:18 beat. Screen-record them once they work — that's your strongest footage.

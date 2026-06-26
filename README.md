# 棋 Sedol Maestro (세돌 마에스트로)

### An AI–Human collaborative coding governance platform — detect when a coding agent spirals, and let a human play the decisive *"78th move"* through UiPath orchestration.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![UiPath](https://img.shields.io/badge/UiPath-Maestro%20Case%20(Track%201)-orange.svg)](https://uipath.com)
[![Agent Type](https://img.shields.io/badge/Agent%20Type-Coded%20%2B%20Low--code-success.svg)](#-agent-type)
[![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Express%20%7C%20TypeScript%20%7C%20Python-teal.svg)](#-repository-structure)

> Built for **UiPath AgentHack 2026** · **Track 1 — UiPath Maestro Case**
> Demo video: **[▶ Watch the 5-min demo](#)** _(replace with public YouTube/Vimeo link before submission)_

---

## 🎯 The Problem (Business Context)

Modern AI coding agents (Claude Code, Cursor, Gemini CLI) write code fast — but on edge cases they **hallucinate and fall into catastrophic build loops**, retrying the *same* failing patch over and over. There is no enterprise-grade governance layer that:

1. **Detects** the moment an agent loses its way — objectively, not by gut feel.
2. **Pauses** the runaway process safely instead of burning compute and corrupting the codebase.
3. **Escalates** the decision to a human and resumes only after an approved, high-leverage fix.

For any organization running autonomous coding agents at scale, an unsupervised agent loop is a **direct cost, security, and reliability risk**. Sedol Maestro is the missing **Human-in-the-Loop control plane** for that risk.

---

## 💡 The Solution (What It Does)

Sedol Maestro models the entire software-development process as **one game of Baduk (바둑 / Go)**. A codebase becomes a 19×19 board; each file is a stone; each refactor is a "move" with a calculated win-rate.

The core innovation is treating agent runaway as a **measurable signal**:

```
H(X) = -Σ pᵢ · log₂(pᵢ)        # Shannon entropy of the MCTS candidate-move distribution
```

- **H ≈ 4.25 bits** → healthy exploration diversity.
- **H < 1.2 bits** → the agent keeps proposing the same move → diversity has collapsed → we declare **"Atari (단수)"** and **suspend the process**.

At Atari, control passes to **UiPath Maestro Case**, which publishes a **Human-in-the-Loop task to UiPath Action Center**. A human plays the decisive **"78th move" (묘수)** — inspired by Lee Sedol's legendary Move 78 vs. AlphaGo — the case resumes, tests re-run, and every decision is archived as a **Kifu (기보 / game record)**.

---

## 🏆 Challenge Track

| | |
|---|---|
| **Track** | **Track 1 — UiPath Maestro Case** |
| **Why** | The use case is a *dynamic, exception-heavy* process: an agent pipeline that must pause on unpredictable build failures, route to a human, and resume with full context — exactly what Maestro Case Management is built for. |

---

## 🤖 Agent Type

**Both (Coded + Low-code).**

| Layer | Agent type | Where |
|---|---|---|
| **Orchestration / governance** | **Low-code** | UiPath **Maestro Case** authored in **UiPath Studio Web** — drives the exception-handling state machine and Action Center HITL tasks. |
| **Strategy / reasoning** | **Coded** | TypeScript MCTS search engine + Claude-powered move generator (`backend/`, `frontend/packages/mcts`, `frontend/packages/cli`). |

---

## 🧩 UiPath Components Used

| Component | Role in Sedol Maestro |
|---|---|
| **UiPath Studio Web** | Authoring environment for the Maestro Case project and the orchestration agent. |
| **UiPath Maestro (Case Management)** | Control plane. Receives the `Atari` signal from the backend, suspends the coding pipeline, and manages the long-running case instance across fast terminal states. |
| **UiPath Action Center** | Human-in-the-Loop. Publishes the **"78th move" approval task** (App/Form task) to a human reviewer; the case resumes on submission. |
| **UiPath Automation Cloud** | Hosts the tenant, Action Center, and OAuth 2.0 confidential app used for live dispatch. |
| **OAuth 2.0 (Cloud app credentials)** | Authenticates REST dispatch from the backend bridge to Action Center. When credentials are absent, the system falls back to a built-in **simulator** so the demo never stalls. |

> ⚠️ **Reviewer note:** The Maestro Case project and orchestration agent live in `/uipath` (see structure below). Live dispatch to Action Center activates when the `UIPATH_*` environment variables are set; otherwise the documented **simulator fallback** runs the identical flow locally.

---

## 🏗️ Architecture

```
        [ Perception ]                 maestro-bridge.py
        (codebase scan)   ───────────▶ scans repo → board_state.json
                                        (file metrics → 19×19 stones)
                │
                ▼
        [ Strategy ]                   frontend/ (React Workbench)
        (MCTS + Claude)  ───────────▶  candidate moves, win-rate,
                │                       live Shannon-entropy telemetry
                ▼
        [ Orchestration ]              uipath/ (UiPath Maestro Case)
        (Atari → suspend) ──────────▶  Action Center HITL task
                │                       ("78th move" human approval)
                ▼
        [ Governance ]                 Kifu / SGF archive
        (record + resume) ──────────▶  every decision logged as a game record
```

**Runtime backend:** Node.js / Express + `simple-git` clones and probes a target repo, runs the MCTS/Claude policy, and emits the `Atari` signal that drives the UiPath case.

---

## 📂 Repository Structure

```bash
sedol-maestro/
├── package.json          # npm workspaces monorepo root (frontend, backend)
├── maestro-bridge.py     # Perception: scans a codebase → board_state.json (19×19 encoding)
├── board_state.json      # Sample encoded board state (output of the bridge)
├── backend/              # Express API · simple-git probes · Claude (Anthropic SDK) policy engine
│   └── src/
│       ├── server.ts         # REST API + Atari/suspend signaling
│       ├── analyzer.ts       # AST / complexity / PageRank metrics
│       ├── candidates.ts     # MCTS candidate distribution + entropy
│       └── llm.ts            # Claude integration for 묘수 (move) generation
├── frontend/             # React "Maestro Workbench" — Board UI, win-rate meters,
│   │                     #   entropy telemetry, Kifu replayer, CLI packages
│   └── packages/         # mcts · encoder · kifu · cli (coded agent internals)
└── uipath/               # ⬅ UiPath Maestro Case project + orchestration agent
                          #   (import into UiPath Studio Web — see setup §4)
```

> **Heads-up for contributors:** the `uipath/` directory holds the exported Maestro Case project. If you cloned before it was added, pull the latest `main`.

---

## 🛠️ Setup & Run

### Prerequisites
- **Node.js ≥ 20** and **npm ≥ 10**
- **Python ≥ 3.10** (for the codebase scanner)
- An **Anthropic API key** (`ANTHROPIC_API_KEY`)
- *(Optional, for live UiPath dispatch)* a **UiPath Automation Cloud** tenant with an Action Center license and an OAuth 2.0 confidential app

### 1. Install dependencies
```bash
npm install            # installs frontend + backend workspaces
```

### 2. Configure environment
Create `backend/.env`:
```bash
# Required — LLM policy engine (move generation)
ANTHROPIC_API_KEY=sk-ant-...

# Optional — live UiPath Action Center dispatch.
# If omitted, Sedol Maestro runs the built-in simulator fallback.
UIPATH_CLIENT_ID=...
UIPATH_CLIENT_SECRET=...
UIPATH_ORG=...
UIPATH_TENANT=...
UIPATH_FOLDER=Shared
```

### 3. Run the platform (frontend + backend)
```bash
npm run dev:backend     # Express API  → http://localhost:3001
npm run dev:frontend    # React UI     → http://localhost:5173
```

### 4. Set up the UiPath Maestro Case (orchestration)
1. Sign in to **UiPath Automation Cloud** and open **Studio Web**.
2. **Import** the Maestro Case project from `uipath/` (or open it directly in Studio Web).
3. Publish the process and enable the **Action Center** App/Form task ("78th move" approval).
4. Create an **OAuth 2.0 confidential app**, grant Orchestrator + Action Center scopes, and copy the client ID/secret into `backend/.env` (step 2).
5. With credentials set, an `Atari` event now publishes a **real** HITL task to Action Center; without them, the simulator reproduces the identical flow.

### 5. Scan any codebase into a board (optional, standalone)
```bash
python maestro-bridge.py /path/to/target/repo -o board_state.json
```

---

## 🎬 Demo Flow (what the video shows)

1. A buggy Stripe-webhook server (`express.json()` destroys the raw-body Buffer → signature fails → DB deadlock).
2. The agent loops; **entropy drops below 1.2 bits → Atari is declared → the case suspends.**
3. UiPath Action Center surfaces the **"78th move"** approval; a human approves the `express.raw()` fix.
4. The case **resumes**, tests go green, and the run is archived as an SGF **Kifu**.

> 📺 **Demo video (required for judging):** _add your public YouTube/Vimeo/Youku link here — must be < 5 min and in English (or English-subtitled)._
> 🖥️ **Presentation deck:** _add your deck link here._

---

## 📄 License

Released under the **MIT License** — see [`LICENSE`](LICENSE). Open source and free to use, modify, and distribute.

---

**棋 Built with intuition + computation for UiPath AgentHack 2026.**
*Every crisis becomes a game record; every brilliant move becomes an asset.*

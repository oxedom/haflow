# Agent Orchestration System — Refined High-Level Spec (v0)

## Overview

A local-first orchestration dashboard for running autonomous coding missions in isolated Docker containers. Each mission progresses through a configured workflow of **agent steps** and **human gates**. All state is derived from the filesystem + a small mission metadata fileד; agent execution is transparent via persisted logs and artifacts.

**Core philosophy**

* Filesystem is the source of truth (markdown artifacts+logs) are just files
* Running containers/processes represent live state.
* Host Artifacts are ordinary `.md/.json,.txt` files on the host.
* Claude Code  happens inside a container (so it's sandboxs) and generate code and pr's there
---

## Core Entities

### Mission

A unit of work (feature/fix/bugfix) with an isolated env and a dedicated mission folder on the host.

**Mission guarantees**

* **Stable mission folder** stored on the host and preserved after completion.
* **Isolated sandboxed enviroment** created per mission when reaching code generation stage.
* **Deterministic workflow**: a linear sequence of steps (agent or human gate).
* **Immutable history**: steps append logs; artifacts evolve only via gates or agent outputs.

**Mission fields (conceptual)**

* `mission_id` (stable, unique; not only “title”)
* `title` (human readable and camelCase no spaces)
* `type` (`feature|fix|bugfix|...`)
* `workflowId`
* `currentStep`
* `status` (`active|waiting_human|running_agent|failed|completed`)
* `createdAt`, `updatedAt`
* `lastError` (optional summary)

> **Important tweak:** use a separate `mission_id` for uniqueness, keep `title` as display + branch slug.

---

### Workflow

A JSON config defining the ordered steps and artifact conventions.

* Single workflow for v0; later multiple selectable.
* Each step declares:

  * type: `agent` or `human-gate`
  * required inputs and expected outputs
  * display metadata (name/description)

---

### Agent Step

A step executed inside an **ephemeral Docker container** that runs your **wrapper** around Claude Code and writes results to the mounted mission.

**Properties**

* Container starts → runs command → exits.
* No interactive exec requirement (removes need for `docker exec`).
* All stdout/stderr captured to a per-step log file.
* Network: always enabled (v0).

**Inputs/outputs**

* Inputs are file paths (mounted) + bash linux terminal commmand to run when ready (eg inside container claude -p @fix-freezeUser.json)
* Outputs are either:
* code changes in container dev enviroment and when finished commited and PR

---

### Human Gate

A step where a human reviews/edits artifacts before continuing.

**Rules**

* Shows artifact in appropriate in the web editor (md/json/code).
* **Save** writes to disk.
* **Continue** advances to the next step.
* Flow is forward-only, 

---

## System Components


## Frontend (Already built but needs to be revived to align with plan)

## Backend (Express Server)

### Filesystem Operations

* Create mission folder structure.
* Read/write artifacts.
* Move mission to `/completed`.
* Load workflow config on startup.

### Container/Process Management

* Spawn agent containers (one per step run).
* Track running container ID per mission step run (while active).
* Persist exit status + timestamps.
* Docker process info and stdinoutput and predefind docker exec commands to check status




### Polling

* Frontend polls every ~1–2 seconds:

  * missions list + current running status
  * for a running mission detail view, poll log tail

---

## Folder Structure (v0)

```
/missions
  /active
    /<mission-id>--<slug-title>/
      mission.json
      /artifacts
        raw-input.md
        structured-text.md
        research-output.md
        implementation-plan.md
        ...
      /logs
        step-01-cleanup.<runId>.log
        step-03-research.<runId>.log
        ...
      /runs
        step-01-cleanup.<runId>.json   # metadata (exitCode, startedAt, finishedAt, containerId)
        ...
  /completed
    /<mission-id>--<slug-title>/
      (frozen snapshot)
      
/config
  workflows.json
  agents.json (optional mapping of agent name -> command template)
```

**Why add `/runs`?**

* Keeps “process state” durable without a DB.
* Lets you show history (and supports re-run later without changing the model).

---

## Workflow Example (Standard Feature)

1. **[Agent] Cleanup**

   * in: `raw-input.md`
   * out: `structured-text.md`
2. **[Gate] Review Structured**
3. **[Agent] Research**

   * in: `structured-text.md`
   * out: `research-output.md`
4. **[Gate] Review Research**
5. **[Agent] Planning**

   * in: `research-output.md`
   * out: `implementation-plan.md`
6. **[Gate] Review Plan**
7. **[Agent] Implementation**

   * in: `implementation-plan.md`
   * out: code changes in worktree + test results in logs (+ optional `implementation-result.json`)
8. **[Gate] Review Implementation**

   * artifact: `git diff` + summary notes
9. **[Complete]**

   * move mission to `/completed`
   * PR is manual

---

## State Management (filesystem-first)

State is derived from:

1. `mission.json` (only minimal pointers: current step index, status, lastError)
2. presence of expected artifacts
3. presence + contents of `/runs/*.json`
4. whether a container for the current step run is still active (optional; you can trust `/runs` + a lightweight in-memory check)

**Recommendation:** treat `mission.json` as *the pointer* (current step + status), and everything else as evidence/audit trail.

---

## Error Handling (v0)

If an agent step fails:

* Container exits.
* Backend writes a `runs/...json` with `exitCode != 0` and sets mission status to `failed`.
* Mission stays in `/active`.
* UI shows:

  * failed badge
  * last log tail
  * a single action: **“Mark as Completed”** (manual override) or **“Retry Step”** (optional v0+)

**Re-run policy (resolves your contradiction)**

* Workflow is forward-only across *gates*, but agent steps may be re-run from the current step **without rewinding gates**.
* If you want to keep it super strict for v0: no retry button—just “failed” and user edits artifacts then hits “Continue” to re-run the same agent step.

---

## Applied Answers to Open Questions

### 1) Agent CLI specifics

Each agent step runs **your wrapper**. Workflow step references `agent` by name, backend expands into a command like:

* `agent: 'research-agent'`
* backend resolves → wrapper invocation using **mounted file paths** for inputs/outputs.

**Suggestion (small but high leverage):** standardize each agent run to also emit a tiny `result.json`:

* `{ 'ok': true|false, 'summary': '...', 'outputs': ['...'], 'notes': '...' }`
  This makes the UI smarter without parsing logs.

### 3) Docker networking

v0: always on. Remove toggle and related complexity entirely (for now).

### 4) Log streaming

Logs are file-based and polled:

* backend provides `?tail=4000` bytes option
* UI polls log tail while running

### 5) Crashes / invalid output

v0: fail-and-stop.

* no rollback
* mission marked `failed`
* human can inspect logs + artifacts and decide next action

### 6) Concurrency

No hard limit; missions run as resources allow.

* optional “max parallel missions” setting later

### 7) Auth secrets

Credentials are provided via mounted file paths that wrapper reads.

* keep secrets out of logs
* mount read-only where possible



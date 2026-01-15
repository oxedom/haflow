1. Overview
Ralphy is a local "Mission Control" for AI-driven development. It orchestrates Claude Code to generate PRDs, breakdown tasks, and execute code within sandboxed environments.

Stack:

Monorepo: pnpm + Turborepo (optional)

Runtime: Node.js (Express or Fastify)

Database: better-sqlite3 (Single file: ~/.ralphy/ralphy.sqlite)

Execution: Docker (Sandboxing) + Node Child Processes

Communication: REST API + Server-Sent Events (SSE) for live logs

2. Architecture & Data Strategy
Directory Structure:

Plaintext

packages/
  shared/   # Types, Zod schemas, Enums (MissionStatus, etc.)
  cli/      # "ralphy" global command (init, link, start)
  backend/  # Express API + Orchestrator + Docker Logic
  web/      # (Future) React/Next.js Dashboard
Data Model (SQLite):

projects: id, path, name, config_json

missions: id, project_id, feature_name, status, branch_name, worktree_path

processes: id, mission_id, type (claude|test|docker), pid, container_id, status

logs: id, process_id, timestamp, content (Also streamed to .ralphy/missions/[id]/logs/)

Isolation Strategy:

Host: Git operations, Claude API calls, Orchestration.

Docker: Untrusted code execution (tests, builds, dev server). Mounts the specific mission worktree.

3. Implementation Phases
Phase 1: Monorepo & Shared Types
Goal: Setup workspace and define the "Language" of Ralphy.

Init: pnpm init in root, setup pnpm-workspace.yaml.

@ralphy/shared:

Define MissionStatus Enum: DRAFT, GENERATING_PRD, PRD_REVIEW, PREPARING_TASKS, IN_PROGRESS, COMPLETED.

Define Mission and Task interfaces.

Export Zod schemas for API validation.

Phase 2: CLI & Local Setup
Goal: Allow registering projects and initializing the global DB.

@ralphy/cli:

ralphy init: Creates ~/.ralphy, initializes SQLite DB schema.

ralphy link: Adds current directory to projects table.

ralphy start: Launches the Backend server.

Config: Implement loadConfig to read ralphy.json from project roots.

Phase 3: Backend Core & API
Goal: API server that handles Projects and Mission creation.

@ralphy/backend: Setup Express with better-sqlite3.

Endpoints:

GET /projects, POST /projects

POST /missions (Create draft)

GET /missions/:id (Get state)

State Machine: Implement the logic to transition missions (e.g., Draft -> Preparing PRD).

Phase 4: Orchestrator & Logging (The Hard Part)
Goal: executing Claude and capturing live output.

Process Manager: Create a service to spawn processes.

Implementation: Use child_process.spawn.

Piping: Pipe stdout/stderr -> Write to file (.ralphy/missions/...) AND push to SSE stream.

Docker Integration:

Use dockerode or docker CLI.

Implement runInSandbox(missionId, command) which spins up a container mounting the mission's worktree.

SSE Endpoint: /api/missions/:id/logs to stream real-time terminal output to the client.

Phase 5: Mission Logic (Claude Integration)
Goal: The actual AI work.

Git Worktrees: Helper to create ralphy/feature/x worktrees so main branch is untouched.

Agent Wrappers:

generatePRD(): Runs Claude with prompt -> Saves PRD.md.

generateTasks(): Claude reads PRD -> Outputs tasks.json.

executeTask(): Runs the coding loop in Docker.

4. Testing Strategy
Unit Testing (Vitest):

Shared: Validate Zod schemas and state transitions.

Backend: Mock spawn and better-sqlite3 to test orchestration logic without actually running Claude or Docker.

Integration Testing:

Create a "Hello World" mission manually via API.

Verify log files are created on disk.

Verify Docker container spins up and tears down.

5. Verification Checklist
[ ] ralphy link successfully adds a project to SQLite.

[ ] ralphy start spins up server on port 3847.

[ ] Creating a mission creates a folder in .ralphy/missions/[id].

[ ] Critical: Triggering a dummy process (e.g., ping) streams logs via SSE to curl.

[ ] Docker container mounts worktree and can write a file to it.
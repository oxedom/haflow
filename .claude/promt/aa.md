
@. @./ this entire repo
Architecture Ralphy
Orchestration & Process Control
1) Opinionated One-Page Recommendation
Recommended Architecture: Use a Node.js TypeScript server as the central hub orchestrator, combined
with a durable job queue backed by SQLite for persistence, and leverage Docker containers for
sandboxed execution of mission steps. This approach balances simplicity, reliability, and safety for running
multiple long-lived AI-driven tasks.
Node.js Orchestrator + SQLite Persistence: The hub will manage missions in-memory but record
all mission, process, and state data in a local SQLite database. On a hub restart, the server can
recover mission states from the DB and reconcile with any running processes. This avoids an
external message broker while still ensuring jobs “survive” crashes or restarts . SQLite is
lightweight, file-based, and ACID-compliant, offering durability without the complexity of a separate
Redis or RabbitMQ service.
Child Processes + Docker Sandbox: For each mission step that involves executing code or
commands, the hub will spawn a Docker container (per mission by default) to run those commands
in an isolated environment. The Node orchestrator will track these containers and capture their
outputs. Using Docker provides OS-level isolation and resource controls, protecting the host and
ensuring consistent environments across Linux/macOS (with Windows support via Docker Desktop).
Git operations (creating worktrees, commits, etc.) and external API calls (Claude, GitHub) run outside
the container in the Node process for direct host access, while potentially risky code (tests, servers,
AI-written scripts) run inside the sandbox.
In-Process Job Management: The hub will launch and monitor subprocesses (like git , pnpm , or
Claude CLI) using Node’s child_process.spawn (or the higher-level execa library). Each
mission’s tasks can be executed sequentially or in parallel within its container. The hub’s orchestrator
will maintain a process table (in DB and memory) mapping mission steps to OS PIDs or container
IDs. For reliability, the hub should spawn processes in a way that they can be terminated as a group
(on Linux, spawn in a process group to kill entire trees; on Windows, use taskkill to clean up).
Docker containers are managed via Docker Engine APIs or CLI – the hub can start containers in
detached mode and attach to their logs.
Live Logging & Observability: The architecture prioritizes capturing and streaming logs for each
mission. The hub will stream stdout/stderr from each process live to the client via Server-Sent
Events (SSE). SSE is ideal for one-way real-time updates like logs, offering simplicity and automatic
reconnection . All logs are also persisted to disk (per process) for retention and later review.
The hub provides an observability layer: tracking mission progress, step durations, resource usage
(CPU/RAM per container or PID), and AI context usage. A structured logging library (e.g. Pino) is used
for hub’s own logs and can be configured to rotate files to avoid disk overflow.
•
1
•
•
•
2 3
1
Safety & Concurrency: By using Docker for execution, potentially harmful commands remain
isolated. The hub enforces a single-user API token and by default binds to localhost (for LAN/
Tailscale use only) to prevent unauthorized access. Concurrency is limited (~10 missions at once) to
balance load; missions beyond that can be queued in the SQLite job table and started when
resources free up. Each mission’s container is given limited CPU/RAM (configurable via Docker) to
prevent one mission from starving others. Backpressure on log streaming is handled by streaming
outputs to file and network incrementally – the hub reads from process pipes continuously to
prevent buffer blockage.
Why this fits best: This architecture uses minimal new infrastructure (just SQLite and Docker, which are
ubiquitous) and leverages Node’s built-in capabilities. It is durable (state in SQLite, processes in Docker
survive hub restarts), observable (complete logging and metrics), and relatively simple to implement for a
single-user environment. By avoiding an external message broker (Redis) or heavy orchestration
frameworks, we keep the system understandable and easier to maintain. At the same time, using Docker
and persistent storage gives us reliability close to more complex solutions. This design cleanly maps to
Ralphy’s needs: multiple projects, long-running AI “missions,” safe execution, and full history of actions.
Viable Alternatives:
1. In-Memory Process Management: Simply spawn child processes and track them in memory. This is simplest
but not durable (all state lost on restart, running tasks die if hub crashes). Not recommended for Ralphy,
since missions are long-running and we need crash recovery.
2. External Supervisor (e.g. systemd or PM2): Delegate process management to an OS-level service manager.
For example, the hub could ask systemd to run each mission step as a service, or use PM2’s programmatic
API to manage processes. While tools like PM2 offer log rotation and auto-restart features , they add
complexity and make it harder to map processes to missions in a custom way. This approach is robust but
overkill for a single-user dev tool (and not easily cross-platform).
3. Heavy Job Orchestrators: Using a full-fledged job queue (BullMQ + Redis, or Temporal, etc.) would provide
reliability (jobs persist and survive crashes ) and advanced features, but introduces more dependencies
and setup (Redis, worker processes). For ~10 concurrent jobs on a personal server, this is unnecessary
complexity.
4. Kubernetes or Docker Swarm: Not considered due to “simplicity over platform engineering” – running a k8s
cluster or swarm for a handful of local tasks is not justified.
In summary, the recommended Node+SQLite+Docker approach gives Ralphy Hub a self-contained,
resilient core. It minimizes custom code by utilizing existing solutions (OS processes, Docker, SQLite)
without introducing large new moving parts. This design will be easier to develop and operate, yet still meet
the durability, concurrency, and safety requirements.
2) Decision Matrix Table
Below is a comparison of the main approaches considered, against key criteria:
•
4
1
2
Approach Complexity Reliability
Restart
Recovery
Observability
Security/
Isolation
Portability Dev Effort In-Memory
Spawn (no
DB)
Very low –
simple code
using
Node’s
spawn .
Low – no
persistence;
state lost on
crash.
Poor –
Running
processes
die with
hub;
cannot
resume.
Basic – Can
stream logs
while
running, but
no history
after restart
unless saved
manually.
Low –
Runs on
host with
full
access;
no
isolation
beyond
OS user
perms.
High –
Works on
all OS, but
Windows
process
handling
tricky (no
PGIDs).
Lowest –
Minimal
coding
(use Node
APIs).
Durable Job
Queue
(SQLite DB)
Medium –
need to
implement
job
persistence
& state
machine.
High – Jobs
persisted,
survive
crashes .
Good –
Hub can
reload DB,
reattach
or restart
tasks if
possible.
High – Full
logs stored
per job; can
provide live
streaming +
history.
Medium –
Can
integrate
Docker
for
isolation;
DB itself
not a risk.
High –
Node +
SQLite
works on
Linux/
macOS;
Windows
supported
(with
Docker
Desktop).
Moderate –
Use
libraries
( bettersqlite3
,
etc.) to
reduce
boilerplate.
Supervisor/
Daemon
Agent
High – twolayer
system
(hub +
agent
processes).
High – Agent
can keep
processes
running even
if hub
restarts.
Good –
Hub
reconnects
to agent;
agent
ensures
processes
live.
Medium –
Agent could
stream logs
to hub; extra
complexity to
collect after
hub restart.
Medium –
Agent
could run
processes
under
separate
user or
container,
but not
inherent.
Medium –
systemd
(Linux
only),
custom
agent
(need
adaptation
for each
OS).
High –
Significant
design to
coordinate
hub ↔
agent.
1
3
Approach Complexity Reliability
Restart
Recovery
Observability
Security/
Isolation
Portability Dev Effort Existing
Supervisor
(PM2/
systemd)
Medium –
use existing
tool config.
High – These
are built for
reliability
(auto-restart,
etc.).
Fair –
Processes
survive
hub crash
because
managed
externally,
but hub
must
reconnect
via tool
APIs.
Medium –
PM2 provides
CLI/HTTP for
logs; systemd
logs via
journal –
requires
integration.
Low/
Medium –
No
container
by default
(unless
combined
with
Docker);
PM2 no
isolation
beyond
process.
Low – PM2
crossplatform
(Win not
fully),
systemd
Linux only.
Medium –
Less
custom
code, but
learning
curve to
integrate
API.
Docker-
Orchestrated
Tasks
Medium –
need to
manage
Docker API
usage.
High – Docker
containers
run
independently
of hub
process.
Good –
Containers
continue if
hub
restarts;
hub can
query
container
status on
boot.
High – Can
get container
logs (even
after restart)
and stats;
unified log
retention via
Docker driver.
High –
Strong
isolation
(separate
FS,
network,
CPU
limits)
.
Medium –
Docker on
Linux/
macOS
native; on
Windows
requires
Docker
Desktop/
WSL2.
Moderate –
Use
Docker
SDK or CLI;
must
handle
volumes &
cleanup.
Key: The recommended solution (Durable Queue + Docker) scores well across criteria – it’s a bit more
complex than a naive approach, but greatly improves reliability and isolation, without the heavy ops burden
of external services.
3) API Design (Exact Endpoints)
The Ralphy Hub is API-first, exposing a RESTful API (with JSON payloads) for all operations. An optional
React SPA can consume this API. The design uses resource-oriented endpoints for Projects, Missions, and
Processes. Authentication is via a simple token (e.g. an Authorization: Bearer <token> header) for
LAN exposure, unless the service is kept localhost only.
Projects API
Projects represent linked repositories that Ralphy can work on.
POST /projects – Link a project
Description: Register a new project (repository) with the hub. The request body might include a local
path and optional project name.
5
•
4
Request:
{ "path": "/home/user/my-repo", "name": "My Repo" }
Response:
201 Created with JSON:
{ "id": 1, "name": "My Repo", "path": "/home/user/my-repo", "createdAt":
"...", "status": "linked" }
Idempotency: linking the same path twice returns the existing project (or 409 Conflict if already
linked).
DELETE /projects/:id – Unlink a project
Unregisters the project. This could fail if missions are in progress on that project (then return 400
Bad Request ). On success, 204 No Content . (All data in that project’s .ralphy/ folder could
be left or optionally cleaned if safe.)
GET /projects – List projects
Returns an array of projects with basic info. Supports filtering (e.g. ?status=linked ).
Response example:
[
{ "id": 1, "name": "My Repo", "path": "/home/user/my-repo",
"missionsCount": 3 },
{ "id": 2, "name": "OtherProj", "path": "/code/other", "missionsCount":
0 }
]
GET /projects/:id – Get project metadata
Returns details about the project: path, name, creation time, and possibly configuration (e.g. stored
in config.ts ). Could also include stats like number of missions, last mission timestamp, etc.
Missions API
Missions model the AI-driven development loops. They have a lifecycle (state machine) from draft through
execution to completion.
POST /missions – Create mission from draft
Description: Starts a new mission for a given project. Initially, the mission is in Draft state with raw
input text. The hub will immediately transition it to Preparing PRD by launching the Claude agent
process.
Request Body:
•
•
•
•
5
{ "projectId": 1, "featureName": "add-login", "description": "Implement a
login page...", "draft": "User story or raw text prompt..." }
featureName will determine the worktree/branch name ( ralphy/feature/add-login ).
Response: 201 Created with mission resource:
{
"id": 42,
"projectId": 1,
"featureName": "add-login",
"state": "Preparing PRD",
"createdAt": "...",
"currentStep": { "name": "Preparing PRD", "startedAt": "..." },
"logsUrl": "/missions/42/logs/stream"
}
The mission is now running the PRD generation step. (Alternatively, one could create as Draft and
require an explicit start, but here we assume immediate start.) Idempotency: the server could guard
against duplicate featureName on the same project or allow it if needed. If a similar draft is
submitted twice, it likely creates two missions unless client provides an idempotencyKey .
GET /missions – List missions
Returns missions, possibly filtered by project ( ?projectId=1 ) or state ( ?state=Completed ).
Supports pagination ( ?limit=20&offset=0 ). Missions include basic metadata: id, projectId,
featureName, current state, start/end times, success/failure flag. This helps to render a dashboard of
missions per project.
GET /missions/:id – Get mission status & timeline
Returns detailed info on a mission: all states it went through, timestamps, any user notes on
rejections, etc.
Example Response:
{
"id": 42,
"projectId": 1,
"featureName": "add-login",
"state": "Tasks Review",
"states": [
{ "name": "Draft", "enteredAt": "...", "exitedAt": "..." },
{ "name": "Preparing PRD", "startedAt": "...", "endedAt": "...",
"agentRunId": 101 },
{ "name": "PRD Review", "enteredAt": "...", "prdVersion": 2, "notes":
"Adjusted acceptance criteria." },
{ "name": "Preparing Tasks", "startedAt": "...", "endedAt": "..." },
•
•
6
{ "name": "Tasks Review", "enteredAt": "...", "tasksVersion": 1 }
],
"result": null,
"createdAt": "...", "updatedAt": "..."
}
This shows the mission is currently in Tasks Review. Each state entry can include relevant data: for
review states, the current PRD or tasks version and any feedback notes; for running states, maybe an
identifier to the process that ran (e.g. agentRunId ). If mission completed, result could have
"success" or "failed" and a reason.
POST /missions/:id/prd/approve – Approve PRD
When in PRD Review, the client calls this to accept the PRD and proceed. The hub transitions the
mission to Preparing Tasks (Claude agent runs to generate tasks). Response: 200 OK with
updated mission state.
POST /missions/:id/prd/reject – Reject PRD with feedback
Allows the user to request changes to the PRD. The body may include a note or revised instructions:
{ "notes": "The PRD is missing edge cases, please refine." }
The hub records the note and transitions back to Preparing PRD (with a new Claude run to revise
the PRD). The mission’s prdVersion increments and the new draft is stored. Response: 200 OK ,
mission state = Preparing PRD (again). This loop can repeat multiple times.
POST /missions/:id/tasks/approve – Approve Tasks
Similar to PRD approval: when in Tasks Review, accept the task list and move to In Progress (start
executing tasks).
POST /missions/:id/tasks/reject – Reject Tasks with feedback
Body might contain notes on what to adjust. The mission goes back to Preparing Tasks (Claude
regenerates or fixes the task breakdown), incrementing a tasks version counter, etc.
POST /missions/:id/start – Start/Resume mission
If missions were created as Drafts without auto-start, this endpoint could trigger moving from Draft
to Preparing PRD. Also, if a mission was paused or waiting (for example, awaiting user approval), this
could resume the mission (e.g. after PRD or tasks approved, you could require an explicit call to
actually run the code – but likely approve already triggers it). In many cases this might not be
needed if approvals auto-advance the state machine.
POST /missions/:id/cancel – Cancel/Stop mission
Terminates a mission early. This will stop any running processes (kill the container or processes) and
mark the mission state as Completed Failed (or a distinct Canceled state). The request can include a
reason. Idempotent: calling cancel on an already finished or canceled mission just returns its current
state.
•
•
•
•
•
•
7
POST /missions/:id/complete – Create PR / mark complete
After a mission finishes successfully (code changes are applied and tested), the client may call an
endpoint to finalize it: push the branch to remote and possibly create a Pull Request on the VCS. The
config.ts for the project might hold remote repo info or auth for this. The endpoint would
perform git push and PR creation via GitHub/GitLab API. Alternatively, this could be part of mission
completion automatically if configured, but exposing it gives manual control. Response could include
PR URL, etc.
Processes API
Processes are the low-level executions (Claude runs, test runs, etc.) associated with missions. While users
mostly interact with Missions, exposing Processes can be useful for detailed monitoring or debugging.
POST /processes – Start a new process
This could be an internal endpoint (or admin-only) where the client can request running an arbitrary
allowed command in a project context. For instance, to manually run a test or re-run a step. The
body might specify the project/mission context and the command:
{ "projectId": 1, "missionId": 42, "command": "pnpm test", "cwd": "/path/
to/worktree" }
The hub will spawn the process (possibly inside the project’s Docker sandbox container if isolation is
desired) and return a process ID.
Response:
{ "processId": 99, "status": "running", "startedAt": "...", "command":
"pnpm test", "missionId": 42 }
Use case: advanced usage or debugging – e.g., user wants to run a specific script via the hub.
GET /processes – List processes
Lists all recorded processes, with optional filters: by mission ( ?missionId=42 ), by project, by
status (running/completed). Useful for an overview or if building an admin panel.
Example Response:
[
{ "id": 98, "missionId": 42, "command": "claude -p ...", "status":
"succeeded", "exitCode": 0, "startedAt": "...", "endedAt": "..." },
{ "id": 99, "missionId": 42, "command": "pnpm test", "status":
"running", "startedAt": "..." }
]
•
•
•
8
GET /processes/:id – Get process status
Returns details of a specific process: associated mission/project, command, PID or container info,
start time, current status, exit code if finished, and maybe resource usage stats (if collected).
If running, it could include a small buffer of recent log output or a pointer to live stream.
GET /processes/:id/logs – Get complete logs
Returns the full log output of the process (could be large). Supports pagination or range queries (e.g.
?offset=1000 or ?tail=true to get last N lines). This is for historical logs after process
completion or on demand. For live logs, see SSE below.
GET /processes/:id/logs/stream – Live log stream (SSE)
Server-Sent Events endpoint that streams log output in real-time. The client would connect with
EventSource . Each log line or chunk is sent as an SSE data: message. The server may tag
events with incremental IDs to support auto-reconnect continuing from last event . This allows a
live mission console view. SSE was chosen because it’s simpler than WebSockets for one-way streams
like logs .
POST /processes/:id/signal – Send signal to process
Allows sending OS signals to the process (if permitted). For example, {"signal": "SIGTERM"} or
SIGINT to gracefully stop, or SIGKILL for force kill. On Windows, where POSIX signals are not
the same, the hub can emulate by process.kill or other means. This endpoint needs to validate
signals (only allow certain safe signals). It returns 200 OK if signal delivered (or 400 if invalid
signal or process already ended).
POST /processes/:id/cleanup – Cleanup process resources
After a process (especially a container) completes, this can remove any lingering resources. E.g.,
remove a Docker container (if not auto-removed), delete temporary files, etc. The hub might do this
automatically, but this endpoint gives manual control if needed. Returns 200 when cleanup is done
or resource already gone.
Claude Context Usage API
Capturing AI context usage is important for monitoring token limits.
GET /missions/:id/context-usage – Context usage timeline
Provides data on how the AI (Claude) context was used during the mission. This could be a series of
events or a summary:
{
"missionId": 42,
"model": "Claude-v1",
"steps": [
{ "phase": "PRD generation", "promptTokens": 8000, "responseTokens":
2000, "contextUsed": 10000, "maxContext": 90000 },
{ "phase": "Task generation", "promptTokens": 5000, "responseTokens":
1500, "contextUsed": 6500, "maxContext": 90000 }
•
•
•
6
2
•
•
•
9
],
"totalTokens": 12000
}
Each phase (Claude run) could log how many tokens were used. If Claude provides a status line like
"Using 10k of 100k tokens", the hub can record those as events. This endpoint surfaces that, or it
might just be part of the mission detail in /missions/:id (under each agent step). Structured
logging of context usage allows building a chart or verifying no context overflow occurred.
Alternatively, context usage could be included in the process logs and parsed. But a dedicated
endpoint (or field in mission details) makes it easier to programmatically monitor AI usage per
mission.
Idempotency & Pagination:
All GET endpoints are naturally idempotent. For POST endpoints like approvals or rejections, the server
should handle duplicate submissions gracefully (e.g., if PRD already approved, a second approve could be a
no-op or return the same state). Missions and processes have unique IDs; creating a mission with the same
featureName could be prevented or handled via an idempotency key header if needed. Listing endpoints
( /missions , /projects , etc.) support pagination via limit and offset or cursor. Filtering by fields
(projectId, state, status) is included to narrow results for UI use.
4) Data Model & Persistence (SQLite Default)
Using SQLite for persistence, we design a schema to capture all core entities and their relationships. The
database is a single file (e.g. db.sqlite in backend/ ). We use a minimal schema with normalized tables
for projects, missions, processes, and related data. (If we prefer an ORM or query builder, we might use it,
but given performance needs are modest, direct SQL or lightweight wrappers suffice. Migrations can be
done via SQL files or a tool, but since the schema should be persistent and fairly static, manual updates are
acceptable.)
Tables:
Projects – Registry of linked repositories.
Fields: id (PK), name (text), path (text, unique), createdAt (datetime), status (e.g. "linked"
or "removed"), config (JSON or text for any project-specific config).
This table keeps track of which repositories are managed. It might also store default settings (like
default dev server port, etc., extracted from config.ts if we parse it).
Missions – Each row is a mission (feature development loop).
Fields:
id (PK, could be a UUID or integer),
projectId (FK to Projects),
featureName (text, used for branch naming),
state (text enum: Draft, Preparing PRD, PRD Review, Preparing Tasks, Tasks Review, In Progress,
Completed Success, Completed Failed),
•
•
•
•
•
•
•
10
createdAt , updatedAt (timestamps),
startedAt (when execution actually began), endedAt ,
result (nullable text for “success”/“failed”/“canceled”),
failureReason (text, if failed),
worktreePath (text, path to the mission’s git worktree on disk).
We also store pointers to key artifact files: e.g., prdPath (path to PRD.md), tasksPath (path to
tasks.json). These artifacts reside in the project’s .ralphy/missions/<id>/ folder. Alternatively,
we store these in separate tables, but keeping file paths here is simple.
MissionRevisions – Track the revision history for PRDs and tasks.
Columns: id (PK), missionId (FK), type (TEXT: "PRD" or "Tasks"), version (int), content
(TEXT or path to file), notes (TEXT for rejection notes, if any), createdAt .
Each time a PRD is generated, we insert a new row with type="PRD" and incremented version. If
the user rejects a PRD, we capture their note in that row. The new PRD after rejection gets version+1.
Similarly for tasks. Storing full content in the DB (TEXT) is possible if they are short, but PRD could be
large. Instead, we might store a file path (since we have PRD.md in the mission folder for the latest
version, and perhaps keep old versions as PRD.v1.md, etc.). For quick lookup, storing content might
be okay, but likely not necessary if files exist. Alternative: Keep only the latest in files and store
notes and diffs in DB. This design is flexible – choose based on convenience.
Processes – Each process (subprocess or container) launched by the hub.
Fields:
id (PK),
missionId (FK, nullable if process not tied to a mission – e.g., a general project process),
type (TEXT, e.g. "Claude", "TypeCheck", "Test", "DevServer", "GitOp"),
command (TEXT, the full command executed),
cwd (TEXT, working directory used),
env (TEXT or JSON of environment variables used, with sensitive values redacted or not stored),
pid (INTEGER, for local processes; might be null if run in container),
pgid (INTEGER, process group ID if applicable, for killing entire group),
containerId (TEXT, if executed in Docker),
status (TEXT enum: "queued", "running", "success", "error", "canceled"),
exitCode (INTEGER, null if not finished),
startedAt , endedAt ,
heartbeatAt (DATETIME, periodically updated to indicate liveness; could be null if not used).
This table is central for tracking all subprocesses. By including missionId , we can query all
processes for a given mission (e.g., Claude runs, test runs, etc.). For each, we know how to map logs
and results. The type field can help identify which step of the mission it was. If needed, we could
have a separate table for Claude-specific metrics (but storing them in logs or a usage table might
suffice).
Artifacts – (Optional) A table to list artifact files produced by missions. Fields: id , missionId ,
type (TEXT: e.g., "file", "commit", "PR"), path (TEXT), description (TEXT), createdAt .
Example entries: the patch file or diff that was applied, the commit hash created, the pull request
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
11
URL, test reports, etc. This gives a historical record of outputs. This table isn’t strictly required but
could be useful for audit trails or UI (to list what a mission produced).
AuditLog – Record of significant events (for single-user but helpful for debugging).
Fields: id , timestamp , event (TEXT), details (JSON). For example: "MISSION_CREATED",
"MISSION_STATE_CHANGED", "PROCESS_STARTED", "PROCESS_EXIT", "GIT_COMMIT", etc. The details
might contain IDs or text about the event. This is essentially a chronological log that can be queried
to reconstruct what happened when. It’s useful for observability and diagnosing issues (“what was
the sequence of actions leading to failure?”).
Relations & Indices:
Missions have index on projectId (to query missions per project quickly) and on state (to find
all running missions on startup, for instance).
Processes index on missionId and status (to query running processes easily).
MissionRevisions index on missionId and maybe (missionId, type, version) unique to
avoid duplicates.
Mission State Machine (Allowed Transitions):
The mission state in the DB must follow the defined lifecycle. Enforceable via application logic (not
necessarily via DB constraints):
Draft – initial state right after creation (if we don’t auto-start). From Draft, can go to Preparing PRD
(when mission is launched).
Preparing PRD – running Claude to generate PRD. Upon completion:
PRD Review – awaiting user input. Transitions:
If user approves -> go to Preparing Tasks.
If user rejects -> back to Preparing PRD (with new revision).
Preparing Tasks – running Claude to break down tasks. Then:
Tasks Review – awaiting user input:
Approve -> go to In Progress.
Reject -> back to Preparing Tasks (new tasks revision).
In Progress – executing the planned tasks (coding, testing, etc.). This may involve multiple
processes. Outcome:
If all steps succeed -> Completed Success.
If something fails (test fails, etc.) -> Completed Failed (with failureReason recorded).
If user cancels -> Completed Failed (or “Canceled”).
Completed Success/Failed – terminal states. Once here, only possible action might be to start a new
mission (no further transitions; one could possibly “retry” a failed mission which would actually
create a new mission or go back to a previous review state depending on design, but that
complicates state machine – simpler: treat it as done, have user create a fresh mission or manually
intervene).
We must ensure invalid transitions are not allowed: e.g., can’t approve PRD if not in PRD Review, etc. This
can be enforced by checks in API handlers.
•
•
•
•
1.
2.
3.
4.
5.
6.
7.
8.
9.
10.
11.
12.
13.
14.
12
Process State Machine:
Processes table status field values:
queued: (if we implement queuing) – the process is created but not yet started because of
concurrency limits or scheduling. From queued -> running when started.
running: the process is active. Could also have a sub-status like “starting” but usually the transition
from queued to running is instantaneous when spawned.
success: process exited with code 0 (or a code considered success).
error: process exited with non-zero code indicating failure.
canceled: process was intentionally killed or stopped before completion.
Additionally, we might mark timeout separately if a process exceeded a time limit and was killed, though
that could be represented as error with a special reason.
No complex transitions: basically one-way from queued -> running -> one of (success/error/canceled). We
ensure to update these atomically (within a transaction, update on process exit, etc.). If a process is
canceled, we set status and record that before or after killing.
Data Redaction & Security:
The env field in Processes might contain sensitive info (like API keys for Claude). We should avoid storing
raw secrets. Options: don’t store environment variables at all (just reference a profile or config), or store
with values like <redacted> for known secrets. The hub could maintain a separate secure store in
memory or file for the actual values. Since it’s single-user, an environment config file might hold the Claude
API key instead of passing via env. In any case, ensure the DB doesn’t inadvertently leak secrets.
Optional mission.sqlite in project .ralphy:
We note that an optional mission.sqlite in each mission folder was mentioned. We likely do not need
a separate SQLite per mission, since the central DB covers it. One might consider a per-mission DB if
missions were completely independent or needed to be portable, but that adds overhead. It’s more
straightforward to keep all state in the central hub DB. We can justify not using per-mission sqlite: simpler
to query across missions and less duplication. If needed for extremely long missions to reduce memory,
one could offload some logs or data to a file in the mission folder (which is effectively what we do with log
files and PRD.md). So we will not use mission.sqlite unless a specific offline use-case arises.
5) Log Capture & Streaming
Logging is critical for observability of AI dev loops. We implement a robust logging pipeline for all
processes:
Non-blocking Capture of stdout/stderr: When spawning child processes (or attaching to Docker
containers), we immediately pipe their stdout and stderr streams to prevent any OS buffer from
filling up. In Node, using child_process.spawn , we set stdio: 'pipe' and attach
child.stdout.on('data', ...) and child.stderr.on('data', ...) handlers. This
•
•
•
•
•
•
13
ensures we read data as it comes. If we did not consume it, a child writing a lot could block
(backpressure). We also consider maxBuffer limits (if using exec or spawn with capture). By
streaming to file and network, we avoid building large in-memory buffers, preventing backpressure
issues or memory bloat.
Stream to File (Persistent Logs): Each process will have its own log file on disk, stored under the
project’s .ralphy/missions/<id>/ directory (or a central logs directory with naming convention
like <missionId>_<processId>.log ). We create a writable file stream and pipe the child’s output
into it (or write manually in the data handlers). This acts as a ring buffer sink where we could
implement rotation if needed. For example, we might allow a log file to reach, say, 100MB, then close
and start a new file (with sequence number) to avoid any single file getting too large. Since we
intend to “keep everything,” we won’t delete logs, but we can compress or segment older logs to
relieve disk. We can also use a logging library’s features: for instance, Pino or Winston could be
configured to write logs to rotating files.
Live SSE Streaming: As we write logs to file, we also push them to any live SSE clients. We maintain a
mapping of processId -> set of SSE response objects for clients who subscribed. As new data arrives
(stdout/stderr chunks), we res.write( data: ...\n\n ) to each SSE connection. SSE is ideal for this
scenario (logs updates) due to its simplicity and built-in reconnection . If a client disconnects, they
can reconnect and perhaps use a Last-Event-Id to catch up on missed logs (we could store an
incremental byte offset or line count as SSE IDs). We’ll likely send newline-terminated log lines as
individual SSE events to keep it line-oriented for easier UI display.
Preventing Deadlocks: In cases where both stdout and stderr are being written heavily, Node will
handle each in its own buffer. We must read both. If we only read one and the other fills, the process
might still block. Our implementation attaches readers to both stdout and stderr. They can be
written to the same combined log or separate logs. Typically, we combine them (with markers or
interleaving as they come) to preserve timeline. Alternatively, we could prefix lines with STDOUT /
STDERR in the log or store separate files. Combining is simpler for now, since sequence is more
important than source for a linear narrative.
Ring Buffer for UI: For efficiency, we might keep a small in-memory ring buffer of the last N lines
per process to serve quick status or allow the UI to fetch recent output without reading large files.
For example, store last 100 lines in memory. This helps when a user opens the mission view to
immediately show recent output, then they can scroll or request older logs via paging.
Rotation & Retention: Even though we “keep everything,” we must avoid unlimited growth breaking
the system. We implement log rotation policies:
Rotate per file: e.g., 10MB or 100k lines per file. When threshold exceeded, close current file (rename
it with an index or timestamp) and open a new one. The older files remain on disk. We can compress
older files (gzip) to save space since logs text compresses well.
Global retention: optionally, keep logs for the last X missions or delete logs older than Y days if the
user configures it. By default, we won’t delete (to meet requirement of keeping everything), but we
will provide monitoring (in the UI or audit log) if disk usage gets high.
•
•
6
•
•
•
•
•
14
Preventing “silent disk fill”: We might implement a check – e.g., if disk free falls below some
percentage, emit warnings or halt new missions to avoid crashing the system. Admin can then clean
up old logs manually.
Log Correlation: We ensure logs are easily traceable by context:
Each log file name encodes mission and process ID.
Within a mission’s combined narrative (if we produce a mission-level summary), we might annotate
which step a log line came from. For instance, logs from the Claude PRD generation vs logs from
pnpm test . We could either keep separate logs per process (most clear) and then in the UI collate
them by timeline, or have one mission log that streams everything in chronological order. A hybrid:
separate process logs, and the hub also writes a high-level mission log that inserts events like
“Starting Claude for PRD” and “Claude completed (8000 tokens used)” etc., and possibly tailing some
of Claude’s key outputs. This mission narrative log would be great for quick review without diving
into each sub-log. It could be stored as progress.txt in the mission folder (noted in layout). We
will implement this by writing important events to progress.txt (like state changes, decisions,
results of tests).
Structured Logging: The hub’s own logs (system logs) will use a structured format (JSON) via Pino or
similar. This is separate from process logs, which are raw outputs. The structured logs include things
like
{ event: "MISSION_STATE_CHANGED", mission: 42, from: "Preparing Tasks", to:
"Tasks Review" } for easier programmatic analysis or debugging. We don’t structure the actual
process output (that remains text), but we do parse certain lines for metrics.
Claude Status Line & Context Usage: Claude’s CLI (or whatever mechanism) presumably emits a
status line indicating context usage (e.g., “Context: 50% (50k/100k tokens)”). We capture these lines
from Claude’s stdout. Possibly, Claude has a mode to output usage stats as JSON or to a specific
stream. If not, we parse the known format. We then log it in two ways:
In the raw log (so it’s visible to user in context).
In a structured form to a context usage log or the database (ContextUsage table or similar).
For example, if Claude prints “94k/200k tokens (47%)” , we extract numbers and update a
contextUsage record for that mission step. This allows us to populate the /missions/:id/contextusage
data. We also might emit an SSE event specifically for context usage updates (so the UI could show a
progress bar of context in real-time separate from the text log).
In summary, our logging strategy ensures no output is lost and everything is accessible live and later. We
carefully handle stream consumption to avoid Node event loop stalling. The combination of file storage +
SSE streaming covers both persistence and real-time monitoring. By designing logs per process and
correlated by mission, we make debugging easier (you can drill into a single step’s output or view the whole
mission’s story).
•
•
•
•
•
•
•
•
7
15
6) Monitoring & Observability
Beyond logs, Ralphy Hub will monitor system and process health to provide a rich observability experience:
Resource Usage per Process/Container: The hub will track CPU and memory usage for each
running mission process, especially long-lived ones like a dev server or a lengthy test. We can use
libraries like pidusage (for OS processes) to get CPU% and RSS memory of a PID. For Docker
containers, we can query Docker stats (via API or docker stats --no-stream for a one-time
snapshot) for CPU, memory, and I/O. This data can be periodically polled (say every few seconds) and
stored or made available via an endpoint ( GET /processes/:id might include current CPU/mem
if running). It can also be visualized in the UI – e.g., show a small chart or at least the current
numbers. This helps detect if a job is hung (CPU 0 for long time) or thrashing memory.
Hub Health & Heartbeat: The hub itself should have a health check (e.g., GET /health returning
OK). Internally, if the hub has any asynchronous loops or background tasks (like a scheduler for
queued jobs, or monitoring threads), it can report their status. If the hub is exposed to monitoring
(like through Tailscale, perhaps one can use an external uptime check), this is standard. The hub can
also emit its own CPU/memory usage and uptime in this health endpoint.
Mission Heartbeat: Each mission in running state (Preparing PRD, Preparing Tasks, In Progress) will
have an activity indicator. The heartbeatAt field in Processes can be updated whenever the process
outputs something or at least every N seconds for long tasks. If a process is running but produces
no output for, say, 60 seconds, the hub could poke it (if possible) or at least flag it in UI as
“unresponsive?”. For example, if Claude hasn’t printed anything in a while, maybe it’s still working or
maybe stuck – we might not know, but we can surface lack of activity. Similarly, in In Progress, if tests
are running but no output, we track how long they’ve been running versus an expected range.
OpenTelemetry (Minimal): Given the scope, full OTEL tracing might be overkill. We likely skip
automatic distributed tracing since this is a single service. However, instrumenting a few metrics (like
number of missions run, average duration, etc.) could be done. We might integrate a lightweight
metrics library or even just log them. If we wanted, we could expose a /metrics endpoint
(Prometheus format) for those running the hub on a server to scrape. This would include counters
(missions_started_total, missions_failed_total), gauges (running_missions, running_processes), and
histograms (mission_duration_seconds). This is a “nice-to-have” – not critical for single-user, but
useful for debugging performance.
Mission Observability UI Requirements: The React SPA (if enabled) will provide a dashboard per
mission:
Timeline view: Show each state of the mission (as listed in mission.states in the API). E.g., a vertical
timeline or a list with timestamps: PRD generation started at X, finished at Y; PRD Review from Y to Z;
etc. This gives a quick sense of how long each phase took. We can highlight if a phase is unusually
long (maybe stuck).
Step durations: Display the duration of each Claude run and each execution step. Possibly a
progress bar during execution with estimated time if available.
•
•
•
•
•
•
•
16
Live Output: A console view that streams logs (via SSE) for the current running step. The user can
scroll back. We might separate logs by step – e.g., tabs or expandable sections for “Claude output”,
“Typecheck output”, “Test output”. Since we have per-process logs, the UI can fetch each and allow
the user to switch or view merged.
Failure Reason: If a mission fails, prominently show why – e.g., “Tests failed on X” or “Build timed out
after 5m”. This comes from the mission failureReason field. Also possibly link to the exact log
line or error (we could store a reference to where in log the error occurred, or simply let user search
the logs).
Artifacts & Results: List any artifacts: e.g., “Commit abc123 created”, “Branch pushed to origin”, “PR
#10 opened”. Provide links if applicable. If tests produce a report (like a coverage file or HTML
report), perhaps note its path. Artifacts table aids this.
Git Status: Show the git branch name (like ralphy/feature/add-login ) and whether it’s
pushed. Maybe show diff stats (e.g., “5 files changed, +200 -10”). We can get this from a git diff
--stat or track files modified via our knowledge. This helps the user see the scope of changes
before creating the PR.
Context Usage Visualization: If we capture context usage, show a bar or numeric info for each
Claude run (e.g., “Used 50% of context window” perhaps as a bar chart or just text).
Notifications: Possibly indicate if a mission requires attention (in PRD/Tasks review states, waiting
for user). This can tie into notifications (phase 4 of implementation plan).
In addition to the UI, observability for the developer running Ralphy includes the ability to inspect logs and
DB: - We can provide a CLI or just instruct that logs are in files and the DB can be queried with SQLite
browser for advanced troubleshooting. - If something goes wrong (hub crash), a look at the AuditLog
table or hub’s own console log will assist.
Summation: Monitoring in Ralphy Hub is about ensuring each mission and process can be observed in realtime
and retrospect. Combining metrics (resource usage) and events (state changes) with the detailed
logs gives a comprehensive picture. The single-user scope allows us to keep this lightweight (no complex
distributed tracing), focusing on direct introspection of the processes we spawn.
7) Reliability & Restart Behavior
Reliability and correct behavior on restarts are paramount. Here we address explicitly:
What happens to running processes if the hub restarts?
- If the hub process crashes or is restarted (intentionally or due to host reboot), any child processes it
spawned (not in Docker) will typically be terminated by the OS. Child processes inherit the parent’s process
group, so when the Node process dies, on Unix a SIGHUP/SIGTERM may be sent to children (though not
always – in many cases they become orphans adopted by init). In practice, without special measures, we
should assume non-Docker children will not continue meaningfully if the hub is gone. Therefore, for critical
long-running tasks, we prefer Docker containers or a detached approach. - Docker containers continue to
run independently of the Node process (the Docker daemon is their parent). So any mission step running in
a container will keep running even if the hub goes down. This is a key benefit of our Docker strategy for
reliability. - Upon hub restart, it will consult the SQLite DB to see which missions were in a running state and
which processes were marked running but not finished.
•
•
•
•
•
•
17
Can the hub reattach to containers/processes? How?
- Reattaching to Docker: Yes. On startup, the hub will list any Docker containers that belong to it. We can
give containers identifiable names or labels (e.g., label ralphyMission=42 ). Using Docker’s API, filter by
that label to get all relevant containers. For each running container, we determine which mission and
process it corresponds to. Then: - We can attach to the container’s stdout/stderr to resume live log
streaming. Docker’s API allows attaching to running containers. Also, we can retrieve logs from the
container since start ( docker logs ) to get any output produced while the hub was offline. Combining
these, we can fill any gap and then continue streaming new output. - Update the process record in DB with
a current status (still running) and possibly a new pid or connection info if needed (for containers, the
containerId remains same). - If a container has finished while the hub was down, Docker still has an exit
code. The hub can detect that (container state Exited) and update the DB: mark process as completed
(success/fail based on exit code) and move mission state accordingly. For example, if tests were running and
finished, the hub on restart sees container exited with non-zero -> mark that mission failed with that info. -
Reattaching to OS processes: If we had any critical processes not in Docker, reattachment is harder. Unless
they were spawned as detached processes (so they survive), but then we lost direct pipe to them. We could
potentially have those processes also write to log files and then tail those files after restart. However,
detached processes would become orphans (adopted by init). Without an external supervisor, it’s tricky to
find them unless we recorded PIDs and they are still running. We could attempt to send a signal or monitor
those PIDs. This is unreliable as PIDs may have changed or reused. - Simpler: we do not rely on reattaching to
bare processes. For any long or important task, use Docker. For short tasks (like a git commit), losing it is not
a big deal (it probably finished or can be redone). - Git operations are usually quick and done outside
containers. If the hub died in the middle of a git operation, the worst case is a lock file left. On restart, we
can clean stale git locks (e.g., remove .git/index.lock if present and no associated process). - Claude
processes: If these were running and hub died, likely they died too (unless they were in Docker). The
mission would be left in a running state without completion. On restart, the hub should mark such missions
as failed due to crash, or potentially resumable. However, resuming an AI generation mid-way isn’t really
possible. So, we’d likely mark it failed and let the user re-run that phase. Alternatively, we could
automatically restart that step (especially if it was idempotent to call Claude again). To keep things
deterministic, better to mark failed and notify user.
Should the hub own process lifetimes or delegate to a supervisor?
- In our design, the hub owns the lifetimes. We do not introduce a separate persistent agent process. The
hub is itself the orchestrator. This means if the hub goes down, processes will either die or run detached (in
Docker). We rely on recovery logic rather than having another always-running component. The simpler
single-process design fits our single-user requirement and reduces complexity. - We chose not to use
systemd/PM2 to manage each mission task because that adds layers and our own recovery covers most
issues. Delegating to a supervisor could let processes run completely independently, but then reattaching
logs and controlling them requires integration with that supervisor’s API. Given the moderate concurrency,
the hub can handle it directly.
Reconciling DB state vs OS/Docker state at startup:
On startup, the hub will perform a reconciliation routine: 1. Mark all missions that were in a “running”
state (Preparing..., In Progress) as suspect until verified. Possibly set them to a temporary state like
“Recovering” internally (not exposed). 2. Check the Processes table for any status="running" or
queued . For each: - If it has a containerId , query Docker: - If container is running: great, reattach as
discussed. - If container is exited: collect its exit code and logs. Update process status to success/failed.
Advance mission state accordingly (e.g., if this was the only process in In Progress and it succeeded, mission
18
can be marked Completed Success; if failed, mission Completed Failed). - If container is not found: it might
have been removed or never started. Treat as failed and log a warning. - If it’s an OS process (pid not null
and no container): - Use OS to check if that pid is alive. On Linux, e.g., /proc/<pid> exists and the
process name matches what we expect. On Windows, use tasklist. - If alive (surprising but possible if
detached): we could try to reconnect (maybe not feasible to reattach stdout). At minimum, we know it’s still
running. We might kill it because we can’t capture output, to avoid orphan runaway. Or leave it and mark
mission in uncertain state. - If not alive: mark process as failed (since hub crashed, likely it died too). 3. For
missions in “suspect” state after checking processes: - If all their associated processes are now completed
(some possibly failed), then conclude the mission. E.g., mission was In Progress and had test process, which
finished with fail; we update mission to Completed Failed. - If some processes are still running (only possible
via Docker), set mission state back to the appropriate running state and continue monitoring. - If a mission
was in a review state (PRD Review or Tasks Review) at crash, that’s fine (no running processes; it was
waiting). It remains in that state. - If a mission was in Draft or had not started, no issue. 4. Cleanup: If any
processes were left in DB as running but we determined they’re not (e.g., a non-container process that
died), mark them failed and update mission. Also ensure no stray containers or processes from old missions
are left: - Possibly list Docker containers with our label that correspond to missions already completed and
remove them (they might have been left if auto-remove wasn’t on). - Kill any stray OS processes if found
(rare). 5. The hub should log this reconciliation result (e.g., “Recovered 1 running mission (id=5), 1 process
resumed, 2 processes marked failed”).
Crash Consistency Guarantees:
- SQLite transactions will ensure that mission state changes and process records are committed atomically
with launching a process. We should use transactions when transitioning states: e.g., when a mission goes
from Preparing Tasks (running Claude) to Tasks Review, update mission state and insert the
MissionRevisions entry in one commit. If the hub crashes mid-operation, either the DB has the old state
(and maybe an orphan process) or the new state fully. To minimize issues: - We can use a pattern: set up the
DB entry for process before spawning it (marking it “running” or “queued”), then spawn. If the spawn fails to
start, we update the DB accordingly. If the hub crashes after spawn but before updating something else, on
restart we still find a running process record and can reconcile. - Use WAL mode on SQLite for resilience and
maybe set synchronous=FULL for safety (slightly slower but ensures transactions are truly flushed). - Log
files: If the hub crashes, some logs may not be flushed from OS buffers. We can mitigate by periodically
flushing file streams (e.g., calling fsync or using line-buffered writes). Also SSE clients would lose
connection – they will reconnect and can fetch missing logs via the /logs endpoint which reads from file.
If the crash happened, last few log lines might be missing if not flushed, but since processes might also die,
that might be moot. Using Docker’s log driver (which writes to JSON files or systemd) could be an alternative
to ensure logs aren’t lost (Docker flushes logs of containers even if our app is gone).
Concurrency Limits & Backpressure:
- We will enforce a cap of ~10 concurrent missions via a simple check: if a new mission comes in and there
are already N running, we can choose to queue it (mission stays in Draft or Queued state until others finish).
Or, allow it but warn the user. Since 10 is a soft target, we might make it configurable. The Processes queue
can also throttle certain types of processes (for example, maybe only 1 Claude process at a time if we want
to conserve AI context or API quotas, but that’s a policy choice). - Backpressure on the system: if too many
processes produce logs simultaneously, the hub’s event loop might be pressured by I/O. Node can generally
handle 10 streams, but if each is spamming output, writing to file and SSE might become slow. We might
use Node’s asynchronous stream writes which handle their own internal buffering. If the writer can’t keep
up, Node will apply backpressure on the readable stream (child.stdout.pause()) – the pipe mechanism can
19
do this automatically. We should test under load. We could also offload log processing to a worker thread if
needed (e.g., pass log chunks to a worker for disk I/O), leaving the main thread to orchestrate. - If mission
tasks themselves create backpressure (like waiting on an external API), that’s outside hub control, but not
an issue for event loop.
Resource Caps: We implement safeguards: - Timeouts: Each mission or process can have a max runtime.
For example, Claude generation might timeout after 5 minutes if no result (then fail the mission with a
message). Tests might timeout after e.g. 2 minutes to avoid hanging tests blocking everything. These can
be configured per command type or globally. We can use setTimeout in Node to watch a process, or
better, spawn processes with something like execa which has a built-in timeout option. - Memory limits:
Docker allows setting a memory limit per container (e.g., 1 GB). We could enforce that in sandbox config so
if a process uses too much, the kernel OOM kills it (which appears as container terminated – we catch that
as failure). - Output size limits: To prevent a runaway log from using all disk, we can impose an output limit
per process. E.g., if a process has already written 500 MB, we can decide to stop reading further or kill it.
Alternatively, more gracefully: if output exceeds X, stop streaming to UI (maybe just indicate “too much
output, truncated”) but continue writing to file. Since we have rotation and disk monitoring, an absolute cap
might not be needed if we trust rotation. But a malicious or buggy process could spit infinite logs quickly.
Perhaps set a very high but finite cap (like 1GB per process) as a sanity check. - Zombie Cleanup: If a
process doesn’t stop on SIGTERM, we escalate to SIGKILL after a grace period. The hub will ensure that
when a mission ends or is canceled, all its related OS processes are killed and Docker containers stopped/
removed. We’ll use group PIDs on Unix (kill -TERM -PGID) to kill trees. For Docker, docker stop sends
SIGTERM in container, and after a timeout, Docker will SIGKILL. This prevents zombies. We also periodically
check for any orphan container (with our label but no corresponding mission in DB, perhaps from a
previous crash) and kill/remove it to avoid accumulating junk.
In summary, on restart the system attempts to recover seamlessly by reattaching to any surviving work
(Docker containers). If that’s not possible, it fails fast and clearly (marking missions failed), rather than
leaving inconsistent state. The hub assumes full ownership of process lifecycle and cleans up accordingly,
keeping the system stable over long runs.
8) Isolation Strategy (Critical)
Isolation is crucial given AI-generated code might run unpredictable tasks. We use Docker sandboxing as
the default, and define what runs inside vs outside:
Inside Container (Sandboxed):
All code execution and project-specific commands run in Docker. This includes:
Running the AI agent if it executes any user code or tools (though Claude is just making API
calls, its “code execution” might be limited to writing files; still, if Claude has a CLI that we run,
we can run that inside to be safe).
Dependency installation (e.g., pnpm install ), building, compiling.
Tests ( pnpm test or similar).
Development server (if the mission includes starting a dev server to validate something).
Essentially, the entire “In Progress” step is within a container that has the project files mounted. The
container can be thought of as a throwaway dev environment for that mission’s branch.
We use one container per mission (spanning possibly multiple processes via docker exec ). The
container is started at the beginning of In Progress (or even earlier if Claude runs needed
•
•
◦
◦
◦
◦
•
•
20
environment – but Claude likely doesn’t need it). Actually, we could start the container even for the
Claude steps if needed (not necessary since those don’t execute project code).
The container image: likely a Node.js image (matching the project’s runtime, e.g., Node 18) with any
other tooling needed (perhaps Claude’s CLI installed, etc.). The config.ts might specify the
Docker base image or Dockerfile to use for sandbox. By default, we can use a known image (like
node:lts plus any build tools).
One container vs many: We opt for one container per mission (particularly for the In Progress
phase). Within it, tasks can be run sequentially or concurrently as needed using docker exec . This
avoids the overhead of tearing down and spinning up multiple containers for each command and
allows sharing state (e.g., a pnpm install can be done once and cached in that container for
subsequent test runs).
Alternative: one container per process (e.g., one for typecheck, another fresh for tests). This
ensures absolute cleanliness for each step but would re-install dependencies and set up
environment twice. Given performance considerations, reusing one container is more
efficient.
If something goes wrong in the environment, it only affects that mission’s container. Different
missions use different containers (they might share the same base image but are separate
instances).
Volume Mounts: We mount the project’s working directory (the specific worktree for the mission)
into the container. Likely mount as a bind mount to /workspace inside container. This allows the
container to see and modify the code files. We ensure this mount is read-write because the mission
will write code, run formatters, etc. Also mount any needed directories (maybe the project’s .pnpmstore
or cache directory if we want to cache deps across runs – or use a Docker cache).
Caution: if host is Windows, mounting into a Linux container is possible via Docker Desktop’s
file sharing. Performance might be slower but acceptable for 10 containers.
We also consider mounting a Docker volume for node_modules: possibly, but if we are using
bind mount, the node_modules will just live under the worktree path on host (or we could
keep them purely in container). A common trick is to mount everything except node_modules,
but then container can’t persist them unless we also mount node_modules separately.
Simpler: just mount whole worktree including node_modules – Node modules installed in
container via bind mount will actually appear on host filesystem. This might not be desirable
(polluting host with container’s build artifacts?). However, since it’s a separate worktree
directory under .ralphy/ , it’s isolated from the main repo. It might be fine if container
writes node_modules there; those files are owned by whatever uid the container runs as,
which might map to root on host (depending on Docker). That could cause permission
annoyances when cleaning up from host side. Alternatively, mount everything except an
empty node_modules (so container can fill it but on host we don't mind its content). This
detail can be handled by using Docker volumes or using the correct --user to avoid rootowned
files.
We also mount a temp volume for Docker socket? Not needed; we likely do not want
Docker-in-Docker. No nested Docker needed.
Networking in Container: By default, container has NAT network. We might not need internet
access inside (maybe block it for safety, or only allow if needed for npm install – which could use
cached local registry if offline). Likely we allow internet for npm/yarn installs, but we could bake
dependencies into the image to reduce need.
Dev servers: If a dev server runs inside container listening on say port 3000, we need a way to
access it from host (for user’s browser). We can do Docker port mapping: e.g., run container
•
•
◦
◦
•
◦
◦
◦
•
◦
21
with -p localhost:XXXX:3000 . But if multiple missions might run dev servers
concurrently, we can’t map all to 3000 on host. Options:
Assign each mission a random high port on host, map container 3000 -> host $PORT. The
mission config or API can communicate which port. For instance, mission record could have
devServerHostPort .
Alternatively, don’t map and require user to access via container’s IP (but that IP is not directly
accessible on Windows/mac by default, and anyway for browser easier to map).
Collisions are unlikely if we generate a port, but we must avoid overlapping choices. We
maintain a pool of allowed ports (maybe in config).
We also ensure that the container’s server is bound to 0.0.0.0 internally (so it’s accessible
through the mapping, not just localhost in container).
If multiple dev servers do run, user might have to manage multiple ports – acceptable given
single user scenario.
Isolation Level: The container should run with non-root user if possible (create a user in Dockerfile).
But since it’s ephemeral and local, running as root in container is not as dangerous because it’s still
isolated from host (except the bind mount; but that only gives access to that project folder). To be
safer, we can use user namespaces or just ensure minimal privileges. We should also avoid --
privileged or mounting Docker socket or any host sensitive paths. Only mount what’s needed.
We may include tools in the container like the Claude CLI if it needs to run there. If Claude only
needs to call an API, maybe we run it outside container to use host network; but likely fine either
way.
Outside Container (Host):
Git operations: Creating worktrees, checking out branches, committing, and pushing to remote
happen on host. Reasoning: the host has the actual repository clone. Worktrees are effectively
directories on host tied to the main repo. We could do commits inside the container, but then git
config (username, GPG, credentials) might not be set up there. It’s simpler to perform git commands
via Node on the host, where the user’s credentials or a bot token could be configured. After code is
generated in the worktree (even if done in container), the hub can git add/commit those
changes on host.
We must coordinate so that container writes are flushed before commit. Perhaps ensure the
container process finished and then run git commit outside.
Claude API calls: If using a Claude SDK or HTTP API, that can be done by the hub directly (with the
API key on host). If using a Claude CLI, we could run it outside or inside. Running outside might be
fine because it’s just an API call, not executing untrusted code. Running inside container doesn’t add
value unless Claude CLI itself has heavy dependencies we want container to hold. Likely, call Claude
from host for simplicity.
Project config and secrets: Access to any tokens (Claude, Git, etc.) is from host side. The container
is given only what it needs (maybe no secrets at all, unless the code itself needs some).
Frontend serving: The optional React SPA can be served by the hub (Node) directly to user’s
browser. That’s outside container. It may fetch data via API which the hub provides.
One Container per Step vs per Mission:
As decided, per mission is default. However, consider edge cases:
◦
◦
◦
◦
◦
•
•
•
•
◦
•
•
•
•
22
If the mission’s tasks include starting a long-lived dev server, and then perhaps running tests that
connect to that server, we might actually want the dev server and tests running concurrently inside
the same container. This can be done by:
Launch container, docker exec to start dev server (this process keeps running).
Then docker exec another process (test runner) in the same container so it can reach the
server on localhost.
This is a valid scenario because one container can host multiple processes. We just need to
manage stopping them afterwards.
If we used separate containers, a test container wouldn’t easily talk to a dev server container (unless
we set up a network between them, which is complex). So one container for the mission is better for
inter-process communication.
After mission completes, we stop/remove the container to free resources.
Dev Server Support: As mentioned, port mapping is needed. We will allocate a host port for the
container’s dev server port. The mapping is done on container start ( docker run -d -p
127.0.0.1:3001:3000 ... ). We bind to localhost (127.0.0.1) to not expose dev servers to the
entire LAN unless needed. If the user accesses the UI from another machine via Tailscale, they might
want to reach the dev server too. Perhaps they’d SSH tunnel or we allow 0.0.0.0 binding if
configured. By default, safe to localhost.
Potential port collision: we track used ports in the DB or in memory. We can pick the next free from a
range. The chance of exactly simultaneous dev server start in different missions is low; but we
handle it anyway.
If a mission is canceled or finishes, free that port (stop container).
Could also allow user to specify desired port via config.
Collisions and File System Isolation: Each mission’s worktree is separate, so file writes don’t collide
across missions. But if two missions are on the same project, they share the .git repo – but since
each uses a separate worktree and branch, git keeps them isolated. Only potential conflict: if both
missions try to change the same file in base branch and eventually merge – but they’re independent
branches, so it’s fine. They might conflict at PR merge time, but that’s beyond Ralphy’s scope.
We might lock at project level to avoid simultaneous missions on one project, especially if both try to
do heavy changes. This might simplify things (no concurrent git operations on one repo). However,
the design didn’t forbid it. We can allow it but caution the user. Git worktrees can handle concurrent
operations if on different dirs, except operations on common structures (like updating submodules
or reflog) – not likely an issue. Still, a simple lock (allow one mission per project at a time) could be a
safe default to avoid weird git states. We can mention that as a configurable option.
In short, the hub runs orchestrator tasks and sensitive operations on host, and all untrusted or heavy
project code runs in Docker. One container per mission provides a sandbox that lasts the mission’s
duration. We carefully manage volumes and ports for dev servers. This approach gives robust isolation –
even if AI code tries something destructive (like deleting files), it can only affect the mounted worktree (and
even that is version-controlled and separate from main branch). The host system remains safe.
•
◦
◦
◦
•
•
•
•
•
•
•
•
23
9) Security Model
Even as a single-user tool, we enforce a security model to prevent accidents or unauthorized use, especially
if the hub is accessible over a network (LAN/Tailscale):
Network Exposure Defaults: By default, the hub should bind its REST API to localhost only. This
ensures that on a developer’s machine, no other device can connect. If the user explicitly wants to
access it via LAN or Tailscale, they can configure the binding to 0.0.0.0 or a specific interface.
When doing so, we strongly encourage use of an auth token.
Authentication & Authorization: A simple API token (set via environment variable or config file) can
be required on all requests. For example, using a header Authorization: Bearer <token> .
Since there’s only one user, we don’t need complex user management – just a single secret. Over
HTTPS (if served behind a proxy with TLS or on Tailscale’s encrypted tunnel) this is reasonably secure.
If on local network without TLS, it’s less secure, but acceptable if network is trusted; still, a token
prevents random local programs from hitting the API.
If the user runs on Tailscale, they might rely on Tailscale’s authentication (node must be in their
tailnet) and skip an app-level auth. But adding our token gives defense in depth.
Permissions: All operations are essentially admin for that user. We don’t have roles. So either you
have full access or nothing.
Command Allowlisting: The hub should have a predetermined set of commands it will run on
behalf of missions. For example, allowed commands might include git , pnpm/npm/yarn ,
docker (for sandbox), and possibly language-specific tools (like if working with Python, pip, etc.,
but assume JS focus). We should avoid a scenario where an attacker could call the API to run an
arbitrary shell command on host. Our /processes endpoint should validate that the command
requested is one of the expected operations. Since this is internal use mostly, not a public API, it’s
less of a concern, but if the React frontend calls an endpoint to run a custom script, we must ensure
it’s not abused. E.g., maybe disallow commands like rm outside container. Inside container, even if
arbitrary, the damage is limited to the project.
We can maintain an allowlist or blocklist. E.g., git , pnpm , docker allowed; but if user tries to
run something else via a process API call, reject it.
Alternatively, tie it to mission steps: the code determines what to run next, user doesn’t directly
supply commands except via the mission flow.
Argument Validation: Even for allowed commands, validate arguments to avoid injection or misuse.
For instance, if passing user-provided branch names or file paths to git, we should sanitize them (no
&& or ; obviously since we’re not using shell string concatenation, we pass as array to spawn
which is safer). But still, ensure no path traversal where not intended, etc.
When mounting volumes in Docker, ensure the path is correct and within the project, not something
weird.
If user input (from the draft or config) could eventually go into a command (e.g., featureName
becomes part of branch name, ensure it’s safe for git).
Least-Privilege Execution:
On the host side, the hub should not run as root. It should run as a normal user account. It needs
access to Docker socket – typically that means the user must be in the docker group on Linux.
That is a privilege (docker group can root the host via Docker), so it’s still sensitive. But that’s a
known requirement to use Docker.
Within containers, we can drop privileges by not running as root inside container (especially since we
mount code, we don’t want container root to create root-owned files on host). We could either use
•
•
•
•
•
•
•
•
•
•
•
•
•
24
Docker’s --user flag to map to a UID that corresponds to host user. For example, if host user is
UID 1000, run container processes as 1000 as well, then any files created match host ownership. This
way, even container can’t write outside the mounted folder (it doesn’t see anything outside anyway).
If possible, also use Docker resource limits (–memory, –pids limit, –read-only fs if feasible (but we
need write to project), etc.) to further contain impact.
Secret Handling: API keys (Claude, Git token) should be stored in a config file or environment on the
host, not exposed to the container. The container shouldn’t need the Claude key because host calls
the API. The git credentials for pushing could be either:
Use host’s Git (with perhaps user’s SSH keys or a personal access token in credential manager).
Or use a deploy key stored in the project config. But we can avoid giving container those; do push
from host Node (possibly using a Git library or spawning git with credentials).
Ensure logs do not print secrets. For example, if Claude’s output or our logs accidentally include the
API key (they shouldn’t, but be mindful). If we detect certain patterns (like the token string), we could
filter it out in logs.
Similarly, if environment variables are logged (some processes print env on error), avoid passing
secrets via env if possible (e.g., pass them via config file or as arguments that are not logged).
Claude’s API key likely goes in an env var or config – if a process prints env or if we had to include it
in container env, that’s dangerous if tests print environment. Instead, handle API calls outside
container.
Logging of Personal Data: The logs might contain code (which could be sensitive IP) and possibly
some user data (depending on what the code does). Since this is a local tool, that’s fine. But if they
expose the hub to others, they should be aware logs might reveal code or file paths. We assume
single trusted user, so not a big issue.
Bind to Localhost vs LAN:
As mentioned, default to localhost. If user runs on a VPS intentionally, they should secure it (maybe
behind an SSH tunnel or use the token auth with HTTPS).
Tailscale scenario: if the machine is on Tailscale, one might open it to 0.0.0.0 but only allow
access via Tailscale’s firewall to the user’s devices. In that case, an auth token might be optional. But
if multiple users on tailnet, token is safer.
DoS considerations: Since it’s single user, we don’t expect DoS from external input. But an attacker
hitting the API could try to spam new missions. Rate limiting could be a consideration if exposed. A
simple approach: since user normally only triggers things occasionally, any rapid-fire usage could be
throttled. We can implement basic rate limit (like max 5 new missions per minute, etc.). Again, in
single-user scenario, this is less important unless someone steals the token.
Audit Trail: Although single user, we keep an audit log. If someone did somehow abuse the system
(or if something unintended happened), the audit log can show what commands were run and
when, providing accountability (even if it’s just the user themselves reviewing what the AI did).
To summarize, we treat the hub with a zero-trust posture on what it runs: - Only do what is explicitly
allowed. - Sandboxed execution for potentially harmful actions. - Protect the API with restricted network
access and tokens. - Keep secrets out of the wrong places and logs.
This ensures even if the AI went rogue or an outsider got access, damage is limited to the project folder or
container, not the whole system.
•
•
•
•
•
•
•
•
•
•
•
•
25
10) Implementation Plan (MVP → Hardened)
We propose iterative development in phases, each building on the last:
Phase 1: MVP
- Scope: Implement core mission orchestration with minimal components. - Use Express or Fastify for the
REST API. (Recommendation: Fastify for speed and JSON handling; it has good TypeScript support and
schema validation. Express is fine too, but Fastify’s plugin ecosystem for things like JWT, rate limiting could
be handy.) - Implement basic Project linking (just store path and name). - Implement creating a Mission
from draft and immediately starting Claude (skip optional pause at Draft). For MVP, simulate Claude step if
needed (or integrate real Claude API if available). - Use child_process.spawn or execa to run a
dummy command or actual Claude CLI. Execa is a good choice because it simplifies promises and buffers,
but here we want streaming, which Execa supports ( execa.command(..., { stdout: 'pipe' })
gives streams). - For sandbox, integrate Docker: likely use Docker’s CLI via spawn for simplicity initially (e.g.,
spawn('docker', ['run', ...]) ). We can specify --rm to auto-remove container on exit for MVP
(less to clean up). Alternatively, use dockerode (Docker Node SDK) for more controlled management; but
CLI might suffice for MVP. - Run a simple command in container (like echo hello ) to test logs. - Logging:
Implement SSE endpoint and basic log piping: - Use Node’s HTTP response for SSE (set headers Content-
Type: text/event-stream , etc.). No special library needed; just ensure to flush with res.flush() if
using Express (which might buffer, but can disable buffering). - As processes run, send SSE data. Also write
logs to a file in mission folder. - Persistence: Use better-sqlite3 (synchronous API, which is okay because
operations are short and simplifies not having to await every query). Create tables for Projects, Missions,
Processes as needed for MVP. - On start, do minimal recovery: e.g., mark any running missions as failed
(MVP can simply not try to reattach). - Frontend: not in MVP, but can provide a curl or minimal HTML page
for testing SSE. - Ensure we can start multiple missions concurrently (spawn multiple processes). Possibly
test concurrency by simulating a long task (sleep).
Phase 2: Restart Recovery & Reconciliation
- Implement the robust restart logic: - On server startup, scan DB for Processes.status='running' or
missions not in terminal state. Attempt to reconcile with Docker as described. - Likely introduce Docker SDK
or use docker ps calls to find containers. Dockerode can list containers by label easily. - Update states
accordingly. - Make sure that if the hub is killed (simulate by killing Node process) in the middle of a mission,
on restart it properly marks things (maybe test scenario: have a dummy process that sleeps 30s in
container, kill hub at 10s, restart hub, ensure it notices container still running and continues). - This phase
also includes refining logging: read any missed logs from container (Docker logs). - Possibly implement the
durable queue aspect: if more than 10 missions started, queue them. This could be as simple as: when
starting a mission, if active count >= limit, don’t actually spawn processes yet, set mission state to “queued”.
A background loop can check and start when below limit. This requires a worker or just use setInterval to
check DB for queued missions. Use DB transactions to claim a mission to start. - Introduce basic
notifications: maybe not full in this phase, but prepare hooks or an event emitter for mission state
changes.
Phase 3: Worktree Automation + PR Flow
- Implement the git operations properly: - On mission start, create git worktree: git worktree add
<path> -b ralphy/feature/<name> . Save worktreePath in DB. - Possibly commit the initial draft/
PRD as part of traceability (or maybe not needed). - After code generation and modifications are done (end
26
of In Progress), if mission succeeded, commit all changes: git add -A && git commit -m "Ralphy
changes for <featureName>" . We might do intermediate commits per task or just one at end. Simpler:
one commit at end. - Pushing branch: require user config of remote. Could integrate here or in next. -
Creating PR: integrate with GitHub API if token available. Could use Octokit (GitHub’s Node SDK) or simple
fetch. Only do if configured. - Ensure to handle failure: if tests failed, maybe do not commit or push. Or
commit but mark it as WIP branch. - This phase we also refine the Missions state machine: - Implement the
PRD Review and Tasks Review properly with endpoints to approve/reject (wired to actual logic of looping
back to Claude). - We’ll likely need to integrate calling Claude’s API or CLI now. Possibly use the Claude API
directly using an HTTP client. This involves sending the prompt (the draft) and getting a response (the PRD
text). Then storing it (PRD.md). - Because that might be proprietary, as a placeholder we could simulate with
a stub that writes a dummy PRD. But to truly test, integrate if possible. - Implement tasks generation
similarly. - Now mission can go through full flow: draft -> PRD -> tasks -> code. - Frontend (optional but
maybe start here): - Serve a static React app (build output) from an Express/Fastify static files route. Or use
Vite dev server separately in dev. - The UI should at least display projects, list missions, and show a mission
detail with live logs. - Focus on making SSE logs display and state updates via polling or SSE events for
mission status changes (could also implement server events for state changes). - UI can also allow creating
missions and sending approvals.
Phase 4: Notifications (ntfy/webhooks)
- Add ability to notify the user when certain events occur, so they don’t have to watch the UI constantly: -
ntfy: There’s a service (ntfy.sh) that allows sending push notifications via a simple HTTP publish. If user
configures an ntfy topic or URL, the hub can POST a message when, say, a mission enters a review state
(needs attention) or completes. - Could integrate email or other notifiers similarly. - Webhooks: Provide a
way to register a webhook URL in config that the hub will POST JSON to on important events (mission
completed, etc.). This allows integration with other systems (maybe the user’s custom script). - These should
be optional and disabled by default. - Also consider integrating with OS notifications (if running on a
desktop, send a system notification; but for cross-platform, maybe skip).
Phase 5: Optional React Control Panel
- By now, if not already, complete the React SPA: - Ensure it is mobile-friendly (user might check missions
from phone via Tailscale). - Implement controls to start/cancel missions, view logs, and see stats. - Use
libraries like React Flow or similar for timeline, or just simple components. - Perhaps integrate a terminallike
component for logs (or just <pre> ). - Ensure SSE handling with reconnect (EventSource does autoreconnect
by default; our server should handle Last-Event-Id ). - Possibly use a state management
(Redux or Zustand) to keep mission state in sync with SSE and occasional polling fallback. - Provide forms to
input new mission details, PRD feedback, etc.
Phase 6: VPS Hardening & Production readiness
- Go through security points to tighten configuration: - Support reading the auth token from env or config
and enforce it on all requests (except maybe /health). - If needed, integrate HTTPS (though usually you’d run
behind a reverse proxy like Caddy/NGINX or use Tailscale which is end-to-end encrypted). - Set up logging in
a managed way (maybe integrate Pino pretty logs for dev, JSON logs for production). - Implement process
to rotate logs (maybe integrate pino.destination with a rotating file stream or just rely on external
logrotate). - Container image: possibly build a custom Docker image for sandbox with exactly needed tools.
Or ensure pulling a trusted Node image. - Documentation for the user on how to deploy to a VPS securely
(like ensure firewall, etc.). - Possibly limit memory for SQLite if needed (pragmas). - Make sure to handle
Windows path differences (e.g., use proper path.join, etc., and instruct using Docker Desktop). - Test on
27
macOS and Windows. On Windows, adjust: use docker normally (works via Docker Desktop). Child
process signals differ: we might need to use taskkill for cancellation. Perhaps incorporate a small utility
for that when running on win32 (Node’s process.kill(pid) on Windows is actually TerminateProcess
which kills the main process but not children, but Windows often kills entire tree with it – but to be safe, use
taskkill /PID pid /T /F for tree). - Consider CLI mode: maybe some users may use the hub via CLI
without UI – we could add commands to list running missions or tail logs using something like a small CLI
that calls the API.
Recommended Libraries Summary:
Web Framework: Fastify (fast, schema validation, good TS) or Express (familiar, but older). Fastify
might be preferable for modern Node and ability to handle high throughput (though our throughput
is low, mainly concurrency of SSE which Fastify can handle well).
Spawn Management: Execa for nicer interface (it returns a Promise and allows streaming). It also
has built-in kill behavior that can kill the entire process tree by default on .kill() if the option
cleanup: true is used. If we use raw child_process.spawn , we might use tree-kill package
for cross-platform killing of processes and their children.
Docker Integration: dockerode (popular Docker client for Node) can manage containers via API,
which gives more control than calling CLI and parsing output. For example, dockerode can stream
logs easily. Using it avoids spawning extra docker commands which themselves would need
capturing. So for a more robust solution, dockerode is recommended.
Database: better-sqlite3 for SQLite – it’s synchronous, which is fine for our use (most DB operations
are quick). It has a simple API and supports safe bundling in Electron, etc., if needed. For migrations,
maybe just maintain SQL scripts or use a tiny migration tool, but since “schema should be persistent”
and user isn’t concerned with migration tooling, we can apply changes manually between versions.
Logging: Pino for application logs. It’s very fast and can be configured to log to console or file. For
rotation, Pino itself doesn’t rotate; we can use an external utility ( pino-pretty for dev, and for
rotation pino-multi-stream or just rely on logrotate). Alternatively, Winston has daily rotate file
plugin, but Winston is heavier and slower. Pino is a good default for Node services.
SSE: We can use built-in HTTP handling. If wanting a small helper, there’s packages like expresssse
but it’s trivial to implement writing to response. We just ensure to set headers and keep
connection alive. If using Fastify, we might need to manage raw reply.raw streams (which is fine).
Auth: If we do token auth, a simple middleware that checks header against a secret from env. No
library needed. If wanted, fastify-bearer-auth plugin exists and could be used by providing the token
in config.
Process Monitoring: pidusage for per-process CPU/mem. For Docker stats, dockerode can give stats
stream, or use si (systeminformation) library that can get Docker container stats as well. But that
might be overkill; dockerode’s stats or calling docker stats works.
File operations: fs-extra for convenient fs functions (copy, remove, etc.), used for cleaning up
mission folders, removing locks, etc.
Git: Could just call git CLI via spawn (since we anyway spawn processes). There are Node git libraries
(simple-git, nodegit) but they add complexity and might not cover all needed features easily. Using
CLI is straightforward and we capture output if needed. We just have to handle errors (non-zero exit
codes) and maybe parse some output (like diff stats). Git CLI is reliable.
By the end of phase 6, the system should be quite hardened and user-friendly, running either on a
developer’s machine or a personal server with confidence.
•
•
•
•
•
•
•
•
•
•
28
11) Gotchas (Mandatory)
Finally, a list of potential pitfalls and tricky points to watch out for:
Stdout/Stderr Backpressure: If a child process writes a lot of output and the hub isn’t reading it
promptly, the child can block and hang. Node pipe streams handle this by applying backpressure
(the stream signals it’s full). To avoid deadlocks:
Always consume both stdout and stderr. If, for example, one only reads stdout but the process writes
tons to stderr, the stderr buffer can fill (64KB or so) and block the process. Our code must attach
listeners to both.
Use { stdio: 'pipe' } (default for spawn) and not stdio: 'ignore' (unless intentionally) –
ignoring might cause process to think no consumer and possibly it doesn’t block but you lose logs.
If using exec (not recommended for large output), ensure to increase maxBuffer or it will kill
the process at 1MB output default.
In practice, using streaming and piping to file avoids hitting Node’s memory. The OS will handle
writing to disk which is usually fine. We might still consider if disk writes can’t keep up (unlikely
unless many MB/s of logs, which 10 processes could conceivably do, but disk can typically handle
tens of MB/s).
Killing Process Trees vs Containers:
When stopping a mission or canceling a process, we must ensure all subprocesses are terminated.
Many commands (like pnpm test ) spawn child processes (e.g., a test runner might spawn
workers). If we only kill the parent PID, the children might continue running in background
(zombies). On Linux/macOS, we can kill the entire process group: spawn the process with
detached: true so it starts a new group, then use process.kill(-pid) to kill the group. On
Windows, process groups aren’t as straightforward, so a known solution is to use taskkill . The
hub can detect platform and execute taskkill /PID <pid> /T /F to force terminate the
process and its descendants.
execa has an option cleanup: true which will terminate child on its own exit (but if our
process is still alive but we want to kill it manually, we still handle it).
If using Docker, docker stop will send SIGTERM to PID1 in container. If that process has children,
it depends on init in container. If using the default (no special init), PID1 is likely our process (like
shell or test runner). If that spawns children, they might become orphaned if PID1 exits before them.
Ideally, container should have an init system (like using tini or run all processes under one shell
so if it gets SIGTERM it kills children). We could ensure to run commands with docker exec rather
than long-lived container entrypoint spawns children.
Alternatively, run container with an init: e.g. docker run --init ... uses tini which reaps
zombies.
SIGTERM vs SIGKILL differences (Windows):
Windows doesn’t support SIGTERM/SIGINT in the same way. process.kill(pid, 'SIGTERM')
on Windows is basically immediate termination (there’s no graceful signal). So graceful shutdown of
•
•
•
•
•
•
•
•
•
•
•
•
29
a child on Windows might not be possible unless the child polls something or uses a job object.
Usually, you end up doing a hard kill (which is like SIGKILL).
Some Node libs try to handle that, but we just accept that on Windows, stop = kill immediately for
child processes.
Also, Control-C handling (SIGINT) doesn’t propagate the same in Windows. If needed to simulate an
interrupt in a child (like to stop a dev server gracefully), might have to send a different signal or use
child’s API (some servers listen for SIGINT on Unix, but on Windows might need sending a CTRL+C
event – which Node can’t easily do for child).
For simplicity, our cancel will likely just force kill on Windows. This is fine, just document it.
Git Worktree Lock Conflicts:
Git creates lock files (e.g., .git/HEAD.lock , .git/index.lock ) when updating refs or index. If
the hub crashes or if two git commands run concurrently on same repo, these locks can persist and
block new operations.
We should ensure that when starting a mission, no other mission is currently modifying the same
repo (especially if on same project). If we allow concurrency on same project, maybe avoid running
git operations at exact same time: we could queue git operations or use Git’s own ability to handle
different worktrees (some operations are safe concurrently, others not).
If encountering a lock file error ( could not acquire lock ), we can catch it, wait and retry a bit,
or fail mission with a clear error.
On startup, perform git worktree prune to remove any stale worktrees references if a mission
was canceled and the worktree dir removed, etc. Also remove stale lock files if present and no
corresponding process.
File Descriptor (FD) Leaks:
Each spawned process and each open log file consumes file descriptors. With 10 concurrent
missions, maybe ~20 processes and 20 file streams open, which is fine. But if we forget to close file
streams after process ends, over time we could leak FDs (especially if many missions). Node will
close child stdio FD when the process exits if we consumed the stream? Actually, you typically call
fileStream.end() when done writing. If using piping (child.stdout.pipe(fileStream)), when child exits,
the stream should end (since EOF on stdout should pipe an end).
Need to verify that pipe will indeed close file. If not, explicitly close in the child.on('close') callback.
SSE connections are also FDs (sockets). If a client disconnects improperly, ensure our server
recognizes it and cleans up. Express/fastify usually handle that, but we might keep an array of SSE
clients. Need to remove clients that are closed (listen to req.on('close', ...) for SSE).
If we forget and keep writing to a closed SSE, it’ll error – handle that and remove it.
Watch out for not opening too many file watchers or something (not likely in our case).
Docker Socket Permissions:
On Linux, /var/run/docker.sock by default is owned by root:docker. If the hub runs as a normal
user not in docker group, Docker API calls will fail ( EACCES ). The user must be instructed to add
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
30
their user to docker group or run the hub as root (not recommended). We can detect this situation
and give a friendly error on startup if we can’t connect to Docker.
On Windows/Mac, Docker runs a service that the Docker CLI communicates with (Windows via
named pipe //./pipe/docker_engine , Mac via socket). Dockerode handles these if configured.
Ensure dockerode is configured with proper socket path depending on OS. If using CLI, ensure
docker CLI is installed and in PATH.
Also consider if Docker is not running at all – the hub should handle that gracefully (either start
Docker or error clearly when trying to run a mission).
Windows Path Length / Permission Issues:
Windows historically had MAX_PATH 260 char limit unless long paths enabled. Our worktree path
.ralphy/missions/<id> is likely fine, but if user’s repo path is very deep, adding /.ralphy/
missions/<id> could exceed. We can enable long path support in Node by prefixing \\?\\ but
it’s messy. Alternatively, allow configuring an alternate short path for worktrees (like C:
\ralphy_worktrees\... ). We should document this.
Also, Windows may restrict removal of files that are open. So when cleaning up a worktree folder,
ensure no process is still using it. Docker on Windows (WSL2) might have the files still open in VM if
container not fully removed.
File permissions: Git sometimes sets read-only bits on files (especially in Windows, e.g., .git files). If
our code tries to delete a worktree, it might fail due to read-only. Use fs.chmod to ensure
deletable or use a force remove that can handle read-only (fs-extra’s remove might handle it).
Execution of shell scripts: If any step tries to run a shell script, Windows can’t natively execute bash
scripts. Ensure any such step runs inside the Docker (Linux) environment. For instance, pnpm works
if you call pnpm.cmd on Windows, but inside Linux container, call pnpm .
So adapt command names per OS if needed (maybe just always run these inside container on
Windows too, so we always use Linux commands).
Claude Output Buffering Quirks:
If Claude’s interface updates a status line (like a carriage return \r to overwrite progress), our log
capture might get fragments or repeated lines. For example, if it prints “Tokens used: 10%” then
backspaces to update “Tokens used: 20%”, the final output might only show 20% or we might
capture control characters. We should handle this:
Perhaps detect if output contains \r without \n , and treat it as a carriage-return. We
could either: not log intermediate updates (only log final line when newline comes), or log
each update as its own line (which could be spammy). For context usage, we probably just
want the final count. So maybe suppress interim updates in the user-facing log (or replace inplace
in an interactive UI component if we had one, but in plain text, you can’t).
We could filter out ANSI escape codes or control characters from logs or replace them
appropriately, to keep logs clean.
Buffering: Some processes buffer output if not in a terminal (non-tty). For instance, Python or
certain CLIs may line-buffer only when stdout is TTY, but fully buffer when piped. This can cause
delays in logs appearing. If Claude CLI does this, we might not see output until it flushes large
chunk. A common fix is to use an environment variable or flag to force line buffering (e.g.,
•
•
•
•
•
•
•
•
•
•
◦
◦
•
31
PYTHONUNBUFFERED=1 for Python, or some --no-buffer option if available). We should check if
Claude CLI has such an option, or possibly run it with pseudo-tty using
spawn('script', ['-qc', 'claude ...']) on Unix or pty libraries. However, integrating a
pty library is complex. We could try to work around by periodic flush (not really possible from
outside).
For MVP, assume it’s fine or flushes at newlines. Monitor if output only comes end – then
address by maybe using expect or an interactive mode. This is advanced, hopefully not
needed if tool is well-behaved or provides a streaming API.
Large Context Handling: If the mission sends a huge prompt to Claude, it might stream partial
results. We must ensure capturing that possibly big stream is fine (the SSE and file can handle it, just
as normal large output).
Miscellaneous:
After a mission is done, the container remains if we didn’t --rm. We should remove it to free space.
Also remove the worktree directory if we don’t need it (or perhaps keep it for reference? Maybe keep
until user unlinks project or explicitly cleans, to allow debugging).
NodeJS version differences: On Node 18+, there’s spawnSync improvements, but we stick to async.
Ensure our code is compatible with LTS (16/18/20).
Ensure to handle exceptions in promise chains – e.g., if a child process fails to spawn (bad
command), catch it and mark mission failed.
AI-specific gotcha: The AI might generate code that includes e.g. a command to run that we didn’t
anticipate. If the orchestrator just runs tasks the AI says, there’s a risk. We should keep a tight rein:
maybe parse the tasks output and only allow certain known actions (like if it says “run tests”, we map
that to our known pnpm test command). If it says something weird (“deploy to production”), our
hub should either not do it or require confirmation. Essentially, Ralphy’s design likely already
restricts what tasks can do.
By anticipating these gotchas, we can implement safeguards and fallbacks to make Ralphy Hub robust.
Testing under different OS and failure scenarios (kill -9 the hub, etc.) will help validate these measures.
12) Minimal Code Sketch (TypeScript Backend)
Below is a simplified TypeScript pseudo-code illustrating key parts of the system: launching a process with
logging, using SSE for streaming, and a basic API structure. This is not full implementation, but gives an
idea of how components might tie together:
// Imports (assuming Fastify and Dockerode for demonstration)
import Fastify from 'fastify';
import { spawn } from 'child_process';
import * as fs from 'fs';
import Docker from 'dockerode';
// Initialize Fastify server
◦
•
•
•
•
•
•
32
const app = Fastify();
const docker = new Docker(); // assumes docker socket accessible
// In-memory tracking for SSE clients per process
const logStreams = new Map<number, Set<Fastify.Reply>>();
// Helper: start a process (either local or in Docker)
async function startProcess(missionId: number, command: string, args: string[],
useDocker: boolean): Promise<number> {
// Create DB entry (pseudo-code, assuming db is some database instance)
const procId = await db.insertProcess({ missionId, command:
[command, ...args].join(' '), status: 'running', startedAt: new Date() });
// Prepare log file
const logPath = `/path/to/.ralphy/missions/${missionId}/process_$
{procId}.log`;
const logFile = fs.createWriteStream(logPath, { flags: 'a' });
if (!useDocker) {
// Spawn local process
const child = spawn(command, args, { cwd: /* mission worktree path */,
detached: false });
child.stdout.on('data', chunk => {
logFile.write(chunk);
broadcastLog(procId, chunk.toString()); // send to SSE clients
});
child.stderr.on('data', chunk => {
logFile.write(chunk);
broadcastLog(procId, chunk.toString());
});
child.on('exit', (code, signal) => {
logFile.end();
const status = (signal === 'SIGKILL' || signal === 'SIGTERM') ? 'canceled'
: code === 0 ? 'success' : 'error';
db.updateProcess(procId, { status, exitCode: code ?? undefined, endedAt:
new Date() });
// If process was part of mission execution, handle mission state update
on completion...
});
// Save child reference if we need to cancel later (not shown here, would
store in a map).
} else {
// Run in Docker
const container = await docker.createContainer({
Image: 'node:18-alpine',
Cmd: [command, ...args],
WorkingDir: '/workspace',
HostConfig: {
33
Binds: [`${getWorktreePath(missionId)}:/workspace`]
}
// (Add port mappings, resource limits as needed)
});
await container.start();
// Attach to container logs
const logStream = await container.logs({ follow: true, stdout: true,
stderr: true });
logStream.on('data', (chunk: Buffer) => {
logFile.write(chunk);
broadcastLog(procId, chunk.toString());
});
// Listen for container stop
container.wait().then(async (data) => {
logFile.end();
const exitCode = data.StatusCode;
const status = exitCode === 0 ? 'success' : 'error';
await db.updateProcess(procId, { status, exitCode, endedAt: new Date() });
// Remove container to clean up
container.remove().catch(() => { /* ignore errors on removal */ });
// Update mission state if needed...
});
// Store container id in DB for potential reconnection
db.updateProcess(procId, { containerId: container.id });
}
return procId;
}
// Helper: broadcast log data to all SSE clients for a process
function broadcastLog(processId: number, message: string) {
const clients = logStreams.get(processId);
if (!clients) return;
for (const reply of clients) {
if (!reply.sent) continue; // ensure header sent
reply.raw.write(`data: ${message.replace(/\n/g, '\ndata: ')}\n\n`); // SSE
format
}
}
// SSE endpoint for live logs
app.get('/processes/:id/logs/stream', (req, reply) => {
const procId = Number(req.params.id);
// Set headers for SSE
reply.raw.setHeader('Content-Type', 'text/event-stream');
reply.raw.setHeader('Cache-Control', 'no-cache');
reply.raw.setHeader('Connection', 'keep-alive');
reply.raw.flushHeaders();
34
reply.raw.write('retry: 10000\n\n'); // set SSE retry
// Register client
if (!logStreams.has(procId)) {
logStreams.set(procId, new Set());
}
logStreams.get(procId)?.add(reply);
// Remove client on close
req.raw.on('close', () => {
logStreams.get(procId)?.delete(reply);
});
});
// Example API endpoint to start a mission (simplified)
app.post('/missions', async (req, reply) => {
const { projectId, featureName, description, draft } = req.body;
const missionId = await db.insertMission({ projectId, featureName, state:
'Preparing PRD', createdAt: new Date() });
// Launch Claude process (assuming a Claude CLI in path, or could call API
directly)
const prompt = `Generate a PRD for feature: ${description}\nDraft:\n${draft}`;
// Save prompt to a temp file or pass via stdin? Here we'll assume CLI that
takes prompt as argument.
startProcess(missionId, 'claude', ['-p', prompt], /*useDocker=*/ false)
.then(procId => {
// Link process to mission step (store in DB if needed)
db.updateMission(missionId, { prdProcessId: procId });
});
reply.code(201).send({ missionId, state: 'Preparing PRD' });
});
// ... other endpoints for approvals, retrieving status, etc. would be defined
similarly ...
// Start server
app.listen({ port: 3000, host: '127.0.0.1' });
Notes on the code: - It uses dockerode for container management. We create and start a container for a
given command, attach to logs, and wait for it to finish. - The broadcastLog sends SSE data. It prefixes
each line with data: as needed. This simplistic approach may break on huge chunks or binary data, but
since logs are text, it’s fine. - In the SSE endpoint, we flush headers and keep connection open. We add the
retry field so clients know to retry after 10s if disconnected. - Cancellation logic is not shown, but we
would use stored child process or container IDs: e.g., in a /processes/:id/signal handler, find if it has
containerId – if yes, do docker.getContainer(id).stop() (or kill), if a child process – call
child.kill() or process.kill(-pid) for group. - We omitted proper error handling for brevity. In
real code, wrap calls in try/catch and reply with errors accordingly. - DB operations are pseudocode; we’d
use prepared statements with better-sqlite3 or an ORM to actually insert/update.
35
This sketch demonstrates how relatively little code is needed by using existing tools (Fastify, Dockerode,
spawn, SQLite). With this structure, we can expand to full functionality as described in the design.
Handling 1M Jobs/Day with BullMQ in Node.js | by Neurobyte | Medium
https://medium.com/@kaushalsinh73/handling-1m-jobs-day-with-bullmq-in-node-js-e428fb6b9348
Why Server-Sent Events Beat WebSockets for 95% of Real-Time Cloud Applications | by Anurag
singh | CodeToDeploy | Jan, 2026 | Medium
https://medium.com/codetodeploy/why-server-sent-events-beat-websockets-for-95-of-real-time-cloud-applications-830eff5a1d7c
PM2 and Docker - Choosing the Right Process Manager for Node.js in Production | Leapcell
https://leapcell.io/blog/pm2-and-docker-choosing-the-right-process-manager-for-node-js-in-production
Add context usage information to statusline JSON input #10613
https://github.com/anthropics/claude-code/issues/10613
1
2 3 6
4 5
7
36
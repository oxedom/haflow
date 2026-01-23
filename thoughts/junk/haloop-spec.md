# Ideal Solution
Full Mobile Control
Can host on VPS
Can host on local machine
**Haloop lives globally (Central Hub Architecture)**
**One server manages multiple projects**

# Features
One /login for Claude 
Mission Observability:
Isolated Env
View current project .claude files
Multiple projects
Instance of loop is verbose and loggable (All of claudes outputs)
Open source
**Link repo via Global CLI**
Can commit branches
Frontend
Can disable frontend hosting work only via REST API
Multiple loops at once

# Nice to have
Github issues
Claude to ask questions
Can spin up app locally in the isolated env (ie localhost dev servers)

# Tools
Claude Code
Docker Sandbox
Github Worktrees
tailscale (for remote access/frontend hosting)
termius SSH client for android and ios
https://github.com/binwiederhier/ntfy
https://github.com/browsh-org/browsh

# Requirements
# Resources:
https://looking4offswitch.github.io/blog/2026/01/04/ralph-wiggum-claude-code/
https://granda.org/en/2026/01/02/claude-code-on-the-go/
https://github.com/BloopAI/vibe-kanban (Kabanboard)
https://github.com/omnara-ai/omnara


# Concepts
Missions: (Draft, Preparing PRD -> Review PRD -> Ready, In progress, Completed Success, Completed Failed (Blocked))
1. Draft. Raw Text, Branch name (optional), tools, agents to delegate -> Step 2
2. Generate PRD -> (In progress state with timer, notification) -> Step 3
3. PRD Review -
- Reject: Can add freetext implementation rejects and press fix -> PRD Review (Keep track of iterations) -> Step 3
- Generate Tasks -> Step 4
4. Preparing Tasks (In progress state with timer, notification complete) -> Step 5
5. Tasks Review
- Reject: Can add freetext implementation rejects and press fix -> Tasks Review (Keep track of iterations) -> Step 5
- Start -> Step 6
6. In-progress (Claude Running) -> Options
- Completed all tasks -> Create PR
- Completed Failed (Blocked ie can't run e2e tests as database connection not returning response)

# User stories:
**Install Haloop Globally (VPS/Local)**
`npm install -g haloop` (or git clone to `~/tools/haloop`)
`haloop init`
**Link a Project**
`cd ~/dev/my-app`
`haloop link`

**Start** (running backend and frontend server)
haloop start (local fe, local be)

# Desktop flow
Visit localhost:PORT
Select "My App" from project list
Start Mission



# Files of repo (The Haloop Tool)
backend
-src/
- server.ts (Central Hub)
- orchestrator.ts
- db.sqlite (Registry of linked projects)
frontend/React 19 Vite (The Control pannel)

# Files created in a target repo
.haloop
missions/
- [feature-template]
-- progress.txt
-- tasks.json
-- sqlite
-- PRD.md
config.ts (frontend port, backend port)



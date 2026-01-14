

# Ideal Solution
Full Mobile Control
Can host on VPS
Can host on local machine
# Feautures
One /login
Mission Obsverbility:
Isolated Env
View current project .claude files
Multiple projects
Instance of loop is verbose and logabble (All of claudes outputs)
Open source
Init in any repo
Can commit branchs
Frontend
Can disable frontend hosting work only via REST API
Multiple loops at once
# Nice to have
Github issues
Claude to ask questions
Can spin up app locally in the isolted env (ie localhost dev servers)
# Tools
Claude Code
Docker Sandbox
Github Worktrees
tailscale (for remote acesss/frontend hosting)
termius SSH client for android and ios
https://github.com/binwiederhier/ntfy
https://github.com/browsh-org/browsh
# Requirmeents
# Resources:
https://looking4offswitch.github.io/blog/2026/01/04/ralph-wiggum-claude-code/
https://granda.org/en/2026/01/02/claude-code-on-the-go/
https://github.com/BloopAI/vibe-kanban
https://granda.org/en/2026/01/02/claude-code-on-the-go/
https://granda.org/en/2026/01/02/claude-code-on-the-go/
https://github.com/omnara-ai/omnara 
Kabanboard
# Concepts
Missions: (Draft, Preparing PRD -> Review PRD -> Ready, In progress, Completed Sucess, Completed Failed (Blocked))
1. Draft. Raw Text, Branch name (optinal), tools, agents to delegate -> Step 2
2. Generate PRD -> (In progress state with timer, notfiaction) -> Step 3
3. PRD Review -
- Reject: Can add freetext implemetnion rejects and press fix -> PRD Review (Keep track of iterations) -> Step 3
- Generate Tasks -> Step 4
4. Preparing Tasks (In progress state with timer, notification complete) -> Step 5
5. Tasks Review 
- Reject: Can add freetext implemetnion rejects and press fix -> Tsks Review (Keep track of iterations) -> Step 5
- Start -> Step 6
6. In-progress (Claude Running) -> Options
- Completed all tasks -> Create PR
- Completed Failed (Blocked ie can't run e2e tests as database connection not returning response)
# User stories:
Git clone project into their repo
cd ralphy/
/init.sh
CLI Setup: (Updates config.ts)
Host frontend? Default Yes/No
Login to Claude
# Files of repo
./init.sh
.claude/*
./ralph-loop.sh

auth/*

dist/
src/
- index.ts
.gitignore

# Files created in target repo
ralphy/
missions/
- [feature-template]
-- progress.txt
-- tasks.json
-- sqlite
-- PRD.md
config.ts (frontend port, backend port)

# API endpoints
# Wireframe layout
- Create Mission (Dialog with PRD markdown input)
- List of rendered accordions all closed (badge of status)
- Accordion item: Play/Stop, Time running, View Task, Container ID, State (Dialog with progress.txt, prd.json)
https://granda.org/en/2026/01/02/claude-code-on-the-go/
# Facts
This will be a server
Server can execute commands via terminal
Each mission instance Sandbox/Container will be on the current machine
# Problem:
We want to lauch CC from our phones
Use as many tokens as we can
Human in the loop + Context Switching
Problem:
We arent maxamzing Claude Tokens while we are AFK
Context Switching
Human in the loop

# Ideal Solution

Create FULL PRDS on the fly the via mobile
Be able to init a loop AFK
Instance of loop is verbose and logabble
Isolated
Instance status (not started, in progress, complete sucsess, completed unsucess)
Init in any repo
Open source
It can run on a VM or my PC
Phone

# ralphy

Mobile Overview from home
Mobile Launch
Github Issues connection
Github Worktrees
Github branches
Docker Sandbox
One setup
Be able to run entire envirment inside container

Raw Text -> Plan Mode for PRD ->

https://github.com/browsh-org/browsh

What does ralph need to start a mission
PRD.json ()
interface PRDTask {
category: string;
description: string;
agents: []
reccomendedSkills: []
steps_to_verify: string[];
passes: boolean;
}
https://github.com/binwiederhier/ntfy

# Ralphy Lanaguge

Missions (Draft, Prepare, Ready, In progress, Completed Sucess, Completed Failed (Blocked))
State: Always visibile
Loop:

# User stories:

User logins Claude once, init.sh
User can press add mission -> paste a PRD.md, Reccomend Skills/Agents from list
Each Mission Instance is a Docker Image with a docker running inside
User can disable FE feature

# Homepage

- Create Mission (Dialog with PRD markdown input)
- List of rendered accordions all closed (badge of status)
- Accordion item: Play/Stop, Time running, View Task, Container ID, State (Dialog with progress.txt, prd.json)
    
https://granda.org/en/2026/01/02/claude-code-on-the-go/

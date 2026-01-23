---
description: Implement highest priority small ticket with worktree setup
model: sonnet
---

## PART I - IF A TICKET/ISSUE IS MENTIONED

0c. Fetch the issue details into thoughts with the issue number - ./thoughts/shared/tickets/issue-xxxx.md
0d. Read the issue and all comments to understand the implementation plan and any concerns

## PART I - IF NO TICKET/ISSUE IS MENTIONED

0a. Fetch the top priority items that are ready for dev, noting all items in the `links` section
0b. Select the highest priority SMALL or XS issue from the list (if no SMALL or XS issues exist, EXIT IMMEDIATELY and inform the user)
0c. Fetch the selected item into thoughts - ./thoughts/shared/tickets/issue-xxxx.md
0d. Read the issue and all comments to understand the implementation plan and any concerns

## PART II - NEXT STEPS

think deeply

1. move the item to "in dev" using the MCP tools
1a. identify the linked implementation plan document from the `links` section
1b. if no plan exists, move the ticket back to "ready for spec" and EXIT with an explanation

think deeply about the implementation

2. set up worktree for implementation:
2a. create a new worktree or branch for the implementation
2b. run `/implement_plan` and when done implementing and all tests pass, create a commit and PR

think deeply, use TodoWrite to track your tasks. Get the top 10 items by priority but only work on ONE item - specifically the highest priority SMALL or XS sized issue.

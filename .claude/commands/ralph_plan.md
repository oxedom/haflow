---
description: Create implementation plan for highest priority ticket ready for spec
---

## PART I - IF A TICKET/ISSUE IS MENTIONED

0c. Fetch the issue details into thoughts with the issue number - ./thoughts/shared/tickets/issue-xxxx.md
0d. Read the issue and all comments to learn about past implementations and research, and any questions or concerns about them


### PART I - IF NO TICKET/ISSUE IS MENTIONED

0a. Fetch the top priority items that are ready for spec, noting all items in the `links` section
0b. Select the highest priority SMALL or XS issue from the list (if no SMALL or XS issues exist, EXIT IMMEDIATELY and inform the user)
0c. Fetch the selected item into thoughts - ./thoughts/shared/tickets/issue-xxxx.md
0d. Read the issue and all comments to learn about past implementations and research, and any questions or concerns about them

### PART II - NEXT STEPS

think deeply

1. move the item to "plan in progress" using the MCP tools
1a. read ./claude/commands/create_plan.md
1b. determine if the item has a linked implementation plan document based on the `links` section
1d. if the plan exists, you're done, respond with a link to the ticket
1e. if the research is insufficient or has unaswered questions, create a new plan document following the instructions in ./claude/commands/create_plan.md

think deeply

2. When the plan is complete, attach the doc to the issue and create a terse comment with a link to it
2a. Update the issue status to indicate plan is in review

think deeply, use TodoWrite to track your tasks. Get the top 10 items by priority but only work on ONE item - specifically the highest priority SMALL or XS sized issue.

### PART III - When you're done


Print a message for the user (replace placeholders with actual values):

```
✅ Completed implementation plan for #XXXX: [issue title]

Approach: [selected approach description]

The plan has been:

Created at thoughts/shared/plans/YYYY-MM-DD-issue-XXXX-description.md
Saved to thoughts repository
Attached to the issue
Issue moved to "plan in review" status

Implementation phases:
- Phase 1: [phase 1 description]
- Phase 2: [phase 2 description]
- Phase 3: [phase 3 description if applicable]

View the issue: [GitHub issue URL]
```

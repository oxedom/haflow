---
name: sync-claude-resources
description: Sync the claudeResources registry in claude-runner.ts with actual files in .claude folder. Use when adding, removing, or renaming skills/agents/commands, or when claudeResources may be out of sync with the .claude directory structure.
---

# Sync Claude Resources

Synchronizes the `claudeResources` object in `packages/backend/src/claude-runner.ts` with the actual files in the `.claude` folder.

## Resource Structure

The `.claude` folder contains three resource types:

| Type | Location | Path Pattern |
|------|----------|--------------|
| Skills | `.claude/skills/<name>/SKILL.md` | `@.claude/skills/<name>/SKILL.md` |
| Agents | `.claude/agents/<name>.md` | `@.claude/agents/<name>.md` |
| Commands | `.claude/commands/<name>.md` | `@.claude/commands/<name>.md` |

## Sync Process

1. **Scan .claude folder** to discover all resources:
   ```bash
   # Skills (directories with SKILL.md)
   find .claude/skills -name "SKILL.md" -type f

   # Agents and Commands (direct .md files)
   ls .claude/agents/*.md .claude/commands/*.md
   ```

2. **Parse existing claudeResources** in `packages/backend/src/claude-runner.ts`

3. **Generate camelCase key** from resource name:
   - `complex-task-planner` -> `complexTaskPlanner`
   - `create_plan` -> `createPlan`
   - `web-search-researcher` -> `webSearchResearcher`

4. **Determine stopper** based on resource purpose:
   - Default: `DEFAULT_STOPPER`
   - Planning commands: Custom stopper mentioning "implementation plan"
   - Research commands: Custom stopper mentioning "codebase research"
   - Commit/PR commands: Custom stopper mentioning "commit and PR creation"

5. **Update claudeResources object** in `claude-runner.ts`:
   - Add missing resources
   - Remove resources for deleted files
   - Preserve custom stoppers for existing entries

## Key Conversion Function

```typescript
function toCamelCase(name: string): string {
  return name
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (c) => c.toLowerCase());
}
```

## Output Format

Each resource entry follows this structure:

```typescript
resourceKey: {
  path: '@.claude/<type>/<name>/SKILL.md', // or <name>.md for agents/commands
  stopper: DEFAULT_STOPPER, // or custom stopper
},
```

## Validation

After syncing, verify:
1. All files in `.claude/{skills,agents,commands}` have corresponding entries
2. No orphan entries exist for deleted files
3. TypeScript compiles without errors: `pnpm --filter @haflow/backend build`

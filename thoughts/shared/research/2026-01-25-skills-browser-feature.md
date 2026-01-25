---
date: 2026-01-25T12:00:00-05:00
researcher: Claude
git_commit: 827e66d025945f24264d460d891eb93042e71464
branch: main
repository: oxedom/haflow
topic: "Skills Browser Feature - Add SKILLS button to navbar that opens a dialog showing available skills"
tags: [research, codebase, frontend, skills, dialog, navbar, react]
status: complete
last_updated: 2026-01-25
last_updated_by: Claude
---

# Research: Skills Browser Feature

**Date**: 2026-01-25T12:00:00-05:00
**Researcher**: Claude
**Git Commit**: 827e66d025945f24264d460d891eb93042e71464
**Branch**: main
**Repository**: oxedom/haflow

## Research Question

Add a "SKILLS" button to the navbar that opens a dialog showing all available skills from:

- Installed package: `/home/sam/projects/haflow/.claude/skills/`
- Linked project: `{linkedProject}/.claude/skills/` (if exists)

Users can browse skill directories, see filenames, and read markdown content (READ-only).

## Summary

The implementation requires:

1. **Backend API endpoint** to list skills and read skill file contents
2. **Frontend dialog component** to browse and display skills
3. **Button in the navbar** (desktop header) to open the dialog

The codebase already has all the necessary patterns and utilities in place - the feature follows existing conventions closely.

## Detailed Findings

### Frontend Architecture

#### App.tsx - Desktop Header Location

The desktop header (`packages/frontend/src/App.tsx:201-221`) is where navbar buttons live. Currently has:

- Cleanup containers button (Trash2 icon)
- Voice chat toggle button (Headphones icon)

The SKILLS button should be added here alongside these buttons.

```tsx
// packages/frontend/src/App.tsx:201-221
<div className="hidden md:flex items-center justify-end gap-2 px-4 py-2 border-b">
  <Button variant="outline" size="icon" onClick={() => setIsCleanupDialogOpen(true)} ... />
  <Button variant={showVoiceChat ? 'default' : 'outline'} size="icon" ... />
</div>
```

#### Dialog Pattern

The codebase uses Radix UI dialogs via `@/components/ui/dialog`. Examples:

- `NewMissionModal.tsx` - Full modal with form
- Cleanup containers dialog in `App.tsx` - Simple confirm dialog

The Skills dialog should follow the `NewMissionModal.tsx` pattern but read-only.

#### API Client Pattern

API calls are centralized in `packages/frontend/src/api/client.ts` using axios with the pattern:

```typescript
const res = await client.get<ApiResponse<T>>("/endpoint");
if (!res.data.success) throw new Error(res.data.error || "Failed message");
return res.data.data!;
```

### Backend Architecture

#### Config - Skills Path Already Configured

`packages/backend/src/utils/config.ts:19-20` already defines `haflowClaudeDir`:

```typescript
// Path to the haflow repo's .claude folder
haflowClaudeDir: join(repoRoot, '.claude'),
```

This can be used to access `/home/sam/projects/haflow/.claude/skills/`.

#### Linked Project Support

`packages/backend/src/utils/config.ts:38-52` provides `getLinkedProject()` which reads from `~/.haflow/config.json`:

```typescript
export async function getLinkedProject(): Promise<string | undefined> {
  const configPath = join(config.haflowHome, "config.json");
  // ... reads linkedProject from CLI config
}
```

#### Routes Pattern

Routes are defined in `packages/backend/src/routes/`. System-level routes go in `system.ts`.
The pattern uses:

```typescript
import { sendSuccess, sendError } from '../utils/response.js';
systemRoutes.get('/endpoint', async (req, res, next) => { ... });
```

### Skills Directory Structure

The `.claude/skills/` directory contains skill folders, each with:

- `SKILL.md` - Main skill documentation (required)
- Optional additional files: `README.md`, `metadata.json`, subdirectories with more `.md` files

Current skills in haflow repo:

- `complex-task-planner/` - SKILL.md
- `playwright/` - SKILL.md, demo.sql
- `react-best-practices/` - SKILL.md, README.md, AGENTS.md, metadata.json, rules/ directory
- `skill-creator/` - SKILL.md
- `small-to-before-research/` - SKILL.md
- `sql-pro/` - SKILL.md
- `sync-claude-resources/` - SKILL.md
- `testing/` - SKILL.md, references/ directory
- `using-git-worktrees/` - SKILL.md
- `using-git-worktrees copy/` - SKILL.md

### Shared Types

Types are defined in `packages/shared/src/types.ts` using Zod schema inference. New types for skills API should follow this pattern.

## Code References

- `packages/frontend/src/App.tsx:201-221` - Desktop header with navbar buttons
- `packages/frontend/src/App.tsx:259-284` - Cleanup containers dialog example
- `packages/frontend/src/components/NewMissionModal.tsx` - Full modal dialog pattern
- `packages/frontend/src/components/ui/dialog.tsx` - Dialog primitives
- `packages/frontend/src/api/client.ts` - API client pattern
- `packages/backend/src/utils/config.ts:19-20` - haflowClaudeDir config
- `packages/backend/src/utils/config.ts:38-52` - getLinkedProject() helper
- `packages/backend/src/routes/system.ts` - System routes pattern
- `packages/backend/src/server.ts` - Route registration

## Architecture Insights

### Recommended API Design

```typescript
// GET /api/system/skills - List all skills from both sources
interface SkillSource {
  source: "installed" | "linked";
  basePath: string;
}

interface SkillInfo {
  id: string; // e.g., "react-best-practices"
  name: string; // Display name from SKILL.md or directory name
  source: "installed" | "linked";
  files: string[]; // List of .md files in the skill directory
}

// GET /api/system/skills/:skillId/files/:filePath - Read skill file content
interface SkillFileContent {
  content: string;
  path: string;
}
```

### Recommended Frontend Components

1. **SkillsButton** - Icon button for navbar (use `BookOpen` from lucide-react)
2. **SkillsDialog** - Main dialog with:
   - Left panel: Skill list grouped by source (Installed / Linked Project)
   - Right panel: Markdown file viewer (read-only)
   - Tree/accordion for skills with multiple files

### UI Flow

1. User clicks SKILLS button in navbar
2. Dialog opens, fetches skill list from API
3. Left panel shows skills grouped by source
4. Clicking a skill shows its SKILL.md content
5. Skills with subdirectories (like `react-best-practices/rules/`) show expandable tree
6. Clicking any .md file shows its content in the right panel

### Mobile Consideration

The mobile header (`App.tsx:167-189`) is separate. Skills button could be added there too, but desktop-only is acceptable for v1.

## Implementation Checklist

### Backend

- [ ] Add `SkillInfo` and `SkillFileContent` types to shared package
- [ ] Create skill listing endpoint in `system.ts`: `GET /api/system/skills`
- [ ] Create file content endpoint: `GET /api/system/skills/:skillId/files/:filePath`
- [ ] Handle both installed and linked project skills paths

### Frontend

- [ ] Add API methods to `client.ts`: `getSkills()`, `getSkillFile()`
- [ ] Create `SkillsDialog.tsx` component
- [ ] Add SKILLS button to desktop header in `App.tsx`
- [ ] Implement skill list view with source grouping
- [ ] Implement markdown content viewer (read-only)
- [ ] Add loading and error states

## Open Questions

1. **Markdown rendering**: Should raw markdown be displayed or rendered? Consider using `react-markdown` for better UX.
2. **Search**: Should there be search/filter for skills? Useful if many skills.
3. **Caching**: Should skill list be cached? Skills don't change frequently.
4. **File watching**: Should the UI update if skills change on disk? Probably not needed for v1.

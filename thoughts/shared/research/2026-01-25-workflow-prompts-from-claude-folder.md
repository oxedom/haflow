---
date: 2026-01-25T12:00:00+00:00
researcher: Claude
git_commit: 827e66d025945f24264d460d891eb93042e71464
branch: main
repository: haflow
topic: "Workflow Prompts from .claude Folder Integration"
tags: [research, workflow, prompts, claude-folder, mission-engine]
status: complete
last_updated: 2026-01-25
last_updated_by: Claude
---

# Research: Workflow Prompts from .claude Folder Integration

**Date**: 2026-01-25T12:00:00+00:00
**Researcher**: Claude
**Git Commit**: 827e66d025945f24264d460d891eb93042e71464
**Branch**: main
**Repository**: haflow

## Research Question

There is a gap in the project implementation: in workflow.ts we have hardcoded step prompts. The goal is to use prompts defined inside the .claude folder instead, while keeping the `<promise>COMPLETE</promise>` marker and string interpolation for artifacts.

## Summary

The current implementation has hardcoded prompts in `STEP_PROMPTS` dictionary within `workflow.ts`. To use prompts from the `.claude` folder:

1. **Create new prompt files** in `.claude/prompts/` or `.claude/workflow-prompts/` for each workflow step
2. **Add YAML frontmatter parsing** capability to read these files
3. **Implement a prompt loader** that reads markdown files, extracts content after frontmatter, and applies string interpolation for artifacts
4. **Keep the completion marker** by appending `<promise>COMPLETE</promise>` in the prompt loader

## Detailed Findings

### Current Workflow Prompts (`workflow.ts:31-99`)

Four hardcoded prompts exist:

| Step ID | Agent | Input Artifact | Output Artifact |
|---------|-------|----------------|-----------------|
| `cleanup` | cleanup-agent | `raw-input.md` | `structured-text.md` |
| `research` | research-agent | `structured-text.md` | `research-output.md` |
| `planning` | planning-agent | `research-output.md` | `implementation-plan.md` |
| `implementation` | impl-agent | `implementation-plan.md` | `implementation-result.json` |

Each prompt:
- Has a role definition ("You are a...")
- References specific input/output files
- Ends with `<promise>COMPLETE</promise>` marker

### Prompt Usage Flow

1. `mission-engine.ts:125` calls `getStepPrompt(step)`
2. Prompt retrieved from `STEP_PROMPTS` dictionary or generic fallback generated
3. Prompt passed to `provider.startClaudeStreaming({ prompt })`
4. Prompt passed as CLI argument to `claude` command in Docker container
5. Stream output parsed for `<promise>COMPLETE</promise>` marker detection

### .claude Folder Structure

```
.claude/
├── agent-template.md           # Template with frontmatter example
├── agents/                     # Specialized agents (codebase-analyzer, etc.)
├── commands/                   # Workflow commands (implement_plan, etc.)
├── skills/                     # Skill modules
└── settings.json               # Configuration
```

### Frontmatter Pattern

All .claude files use YAML frontmatter:

```yaml
---
name: agent-name
description: When and how to use this agent
tools: Read, Write, Bash
model: sonnet
---

# Agent Content
[Markdown content with instructions]
```

### Gap Analysis

| Aspect | Current State | Required State |
|--------|--------------|----------------|
| Prompt Storage | Hardcoded in `workflow.ts` | Markdown files in `.claude/` |
| File Loading | None | Runtime markdown file reading |
| Frontmatter Parsing | None | YAML frontmatter extraction |
| Artifact References | Hardcoded in prompts | String interpolation variables |
| Completion Marker | Hardcoded in prompts | Appended by prompt loader |

### Proposed File Structure

Create new directory for workflow-specific prompts:

```
.claude/
├── workflow-prompts/           # NEW: Workflow step prompts
│   ├── cleanup.md
│   ├── research.md
│   ├── planning.md
│   └── implementation.md
```

### Prompt File Format

Each prompt file should follow this pattern:

```markdown
---
name: cleanup
description: Structures raw feature requests into organized documents
input_artifact: raw-input.md
output_artifact: structured-text.md
---

You are a technical writer helping to structure raw feature requests.

Read the file "{{INPUT_ARTIFACT}}" and restructure it into a clear, well-organized document.

Your task:
1. Read {{INPUT_ARTIFACT}} carefully
2. Organize the content with clear sections and headings
3. Remove ambiguity and clarify vague requirements
4. Add structure: Problem Statement, Goals, Requirements, Constraints
5. Write the result to "{{OUTPUT_ARTIFACT}}"

Focus on: clarity, organization, completeness, removing ambiguity.
```

**Note**: The `<promise>COMPLETE</promise>` marker should be appended automatically by the prompt loader, NOT included in the file.

### Implementation Approach

#### 1. Create Prompt Loader Utility

New file: `packages/backend/src/services/prompt-loader.ts`

```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { WorkflowStep } from '@haflow/shared';

const PROMPT_DIR = '.claude/workflow-prompts';
const COMPLETE_MARKER = '\n\nWhen you are satisfied with the output, include <promise>COMPLETE</promise> at the end of your response.';

interface PromptFrontmatter {
  name: string;
  description: string;
  input_artifact?: string;
  output_artifact?: string;
}

function parseFrontmatter(content: string): { frontmatter: PromptFrontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: { name: 'unknown', description: '' }, body: content };
  }

  // Simple YAML parsing for known fields
  const yamlContent = match[1];
  const frontmatter: PromptFrontmatter = {
    name: '',
    description: '',
  };

  for (const line of yamlContent.split('\n')) {
    const [key, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();
    if (key && value) {
      (frontmatter as any)[key.trim()] = value;
    }
  }

  return { frontmatter, body: match[2] };
}

function interpolate(template: string, step: WorkflowStep): string {
  return template
    .replace(/\{\{INPUT_ARTIFACT\}\}/g, step.inputArtifact || '')
    .replace(/\{\{OUTPUT_ARTIFACT\}\}/g, step.outputArtifact || '');
}

export async function loadStepPrompt(step: WorkflowStep, repoRoot: string): Promise<string> {
  const promptPath = join(repoRoot, PROMPT_DIR, `${step.step_id}.md`);

  try {
    const content = await readFile(promptPath, 'utf-8');
    const { body } = parseFrontmatter(content);
    const interpolated = interpolate(body, step);
    return interpolated.trim() + COMPLETE_MARKER;
  } catch {
    // Fallback to generic prompt if file not found
    return `Read the file "${step.inputArtifact}" and process it according to the step "${step.name}".
Write your output to "${step.outputArtifact}".${COMPLETE_MARKER}`;
  }
}
```

#### 2. Update workflow.ts

Modify `getStepPrompt` to use the loader:

```typescript
import { loadStepPrompt } from './prompt-loader.js';
import { getRepoRoot } from '../utils/config.js';

// Keep STEP_PROMPTS as fallback or remove entirely
// Update getStepPrompt to be async:

export async function getStepPrompt(step: WorkflowStep): Promise<string> {
  return loadStepPrompt(step, getRepoRoot());
}
```

#### 3. Update mission-engine.ts

Change the prompt retrieval at line 125 to be async:

```typescript
// Before:
const prompt = getStepPrompt(step);

// After:
const prompt = await getStepPrompt(step);
```

### String Interpolation Variables

| Variable | Source | Example Value |
|----------|--------|---------------|
| `{{INPUT_ARTIFACT}}` | `step.inputArtifact` | `raw-input.md` |
| `{{OUTPUT_ARTIFACT}}` | `step.outputArtifact` | `structured-text.md` |
| `{{STEP_NAME}}` | `step.name` | `Cleanup` |
| `{{STEP_ID}}` | `step.step_id` | `cleanup` |

### Completion Marker Handling

The `<promise>COMPLETE</promise>` marker should be:
1. **NOT** included in the prompt markdown files
2. **Appended automatically** by the prompt loader
3. **Consistent** with current detection logic in `docker.ts:158`

This keeps prompt files clean while maintaining the completion detection mechanism.

## Code References

- `packages/backend/src/services/workflow.ts:31-99` - Current hardcoded STEP_PROMPTS
- `packages/backend/src/services/workflow.ts:102-110` - getStepPrompt function
- `packages/backend/src/services/mission-engine.ts:125` - Prompt retrieval call
- `packages/backend/src/services/docker.ts:158` - COMPLETE_MARKER constant
- `packages/backend/src/services/docker.ts:187,196,324` - Marker detection logic
- `packages/backend/src/services/mission-store.ts:1` - File reading patterns (fs/promises)
- `.claude/agent-template.md` - Example frontmatter structure
- `.claude/commands/create_plan_generic.md` - Similar command pattern

## Architecture Insights

1. **Separation of Concerns**: Moving prompts to files separates configuration from code
2. **Extensibility**: New workflow steps can be added by creating new prompt files
3. **Maintainability**: Prompts can be edited without modifying TypeScript code
4. **Consistency**: Same YAML frontmatter pattern as existing .claude files

## Existing Similar Patterns

The codebase already uses similar patterns:
- `.claude/commands/*.md` - Commands with frontmatter and markdown content
- `.claude/agents/*.md` - Agents with frontmatter specifying tools and behavior
- `mission-store.ts` - File reading with `fs/promises.readFile`

## Open Questions

1. **Prompt file location**: Should prompts go in `.claude/workflow-prompts/` or `.claude/prompts/workflow/`?
2. **Frontmatter validation**: Should we validate frontmatter against a schema?
3. **Caching**: Should loaded prompts be cached in memory?
4. **Alternative to custom YAML parser**: Use a library like `gray-matter` for robust frontmatter parsing?

## Recommended Next Steps

1. Create `.claude/workflow-prompts/` directory
2. Create prompt files for each step (cleanup.md, research.md, planning.md, implementation.md)
3. Implement `prompt-loader.ts` utility
4. Update `workflow.ts` to use async prompt loading
5. Update `mission-engine.ts` to await the prompt
6. Add tests for prompt loading and interpolation

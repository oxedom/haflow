# Raw - Plan → Implement Workflow

## Overview

The **Raw - Plan → Implement** workflow is a two-phase workflow designed for complex tasks that benefit from explicit separation between planning and implementation. This workflow enables users to:

1. **Phase 1 (Planning & Design)**: Thoroughly explore the problem space, analyze the codebase, and design a comprehensive implementation approach
2. **Phase 2 (Implementation)**: Execute the plan with full context from Phase 1, ensuring implementation fidelity to the designed approach

This workflow is ideal for:
- Complex feature implementations
- Major refactoring efforts
- Architectural changes
- Tasks requiring significant upfront design
- Situations where planning and implementation benefits from explicit separation

## Workflow Architecture

```
Raw - Plan → Implement
│
├─ Phase 1: Planning & Design (Agent Step)
│  ├─ Input: raw-input.md (user request)
│  ├─ Output: planning-output.md (planning document)
│  └─ Mode: Document (analysis and planning)
│
├─ Human Review: Review Planning (Human Gate)
│  ├─ Reviews: planning-output.md
│  └─ User Confirms: Ready to proceed to implementation
│
├─ Phase 2: Implementation (Agent Step)
│  ├─ Input: planning-output.md (Phase 1 output)
│  ├─ Output: implementation-result.json (implementation summary)
│  └─ Mode: Codegen (code changes and testing)
│
└─ Final Review: Review Implementation (Code Review Gate)
   ├─ Quick Commands: npm test, npm lint, npm run build
   └─ User Approves: Implementation complete
```

## Workflow Definition

The workflow is defined in `/workspace/packages/backend/src/services/workflow.ts`:

```typescript
'raw-plan-implement': {
  workflow_id: 'raw-plan-implement',
  name: 'Raw - Plan → Implement',
  steps: [
    {
      step_id: 'plan',
      name: 'Phase 1: Planning & Design',
      type: 'agent',
      agent: 'planning-agent',
      inputArtifact: 'raw-input.md',
      outputArtifact: 'planning-output.md',
      workspaceMode: 'document'
    },
    {
      step_id: 'review-plan',
      name: 'Review Planning',
      type: 'human-gate',
      reviewArtifact: 'planning-output.md',
      workspaceMode: 'document'
    },
    {
      step_id: 'implement',
      name: 'Phase 2: Implementation',
      type: 'agent',
      agent: 'impl-agent',
      inputArtifact: 'planning-output.md',
      outputArtifact: 'implementation-result.json',
      workspaceMode: 'codegen'
    },
    {
      step_id: 'review-impl',
      name: 'Review Implementation',
      type: 'code-review',
      workspaceMode: 'codegen',
      quickCommands: ['npm test', 'npm run lint', 'npm run build']
    }
  ]
}
```

## Context Passing Mechanism

The workflow implements context passing between phases:

- **Phase 1 Output**: The `plan` step writes its analysis and design to `planning-output.md`
- **Phase 2 Input**: The `implement` step reads `planning-output.md` as its input artifact
- **System Instructions**: The implementation phase prompt explicitly references and instructs the agent to follow the planning document
- **Full Context**: The planning document provides complete context about the problem, approach, and design decisions

This ensures Phase 2 always has access to the design decisions and analysis from Phase 1.

## System Instructions

### Phase 1: Planning & Design

The planning phase prompt instructs the agent to:

1. Understand the user's request from `raw-input.md`
2. Explore the codebase to understand architecture, patterns, and conventions
3. Analyze requirements and identify key challenges
4. Design a comprehensive implementation approach with clear architecture
5. Document findings in a structured planning document

The planning document should include:
- Problem statement and requirements summary
- Codebase architecture overview and relevant patterns
- Proposed implementation approach with architecture decisions
- List of files to create/modify with specific changes
- Dependencies and integration points
- Known risks and mitigation strategies
- Testing strategy and success criteria

**Key Characteristic**: Phase 1 focuses on analysis, exploration, and planning—NOT implementation or code changes.

### Phase 2: Implementation

The implementation phase prompt instructs the agent to:

1. Read and understand the planning document from Phase 1
2. Explore the codebase to confirm patterns referenced in the plan
3. Implement changes exactly according to the plan
4. Write tests as specified in the planning document
5. Document what was done in `implementation-result.json`

**Key Characteristic**: Phase 2 focuses on executing the plan with fidelity, using the planning document as the source of truth.

## Integration with Haflow System

### Workflow Discovery

The workflow is automatically discovered through the standard Haflow discovery mechanism:

1. Backend `getWorkflows()` function returns all workflows from the WORKFLOWS object
2. API endpoint `/api/workflows` exposes all workflows
3. Frontend automatically fetches and displays all available workflows
4. Users can select the workflow from the UI

### Execution Flow

1. User creates a mission with the `raw-plan-implement` workflow
2. First step (`plan`) is automatically executed
3. After Phase 1 completes, mission transitions to human gate
4. User reviews the planning document and confirms to proceed
5. Phase 2 implementation step starts with Phase 1 planning as input
6. After Phase 2 completes, mission transitions to code review gate
7. User reviews the implementation and approves completion

### Storage and Persistence

- Planning output is stored as artifact: `~/.haflow/missions/m-<uuid>/artifacts/planning-output.md`
- Implementation output is stored as artifact: `~/.haflow/missions/m-<uuid>/artifacts/implementation-result.json`
- Step executions are tracked in `~/.haflow/missions/m-<uuid>/runs/r-<uuid>.json`
- Logs for each step are stored in `~/.haflow/missions/m-<uuid>/logs/`

## Extending the Workflow

### Modifying Phase Instructions

To adjust the planning or implementation phase behavior:

1. Edit the relevant prompt in `STEP_PROMPTS` in `/workspace/packages/backend/src/services/workflow.ts`
2. Update the `plan` or `implement` prompt as needed
3. Ensure the prompt still references the correct input/output artifacts
4. Add `<promise>COMPLETE</promise>` marker at the end

### Adding Custom Agents

To use different agents for the phases:

1. Modify the `agent` property in the step definition (currently `planning-agent` and `impl-agent`)
2. Ensure the agent is registered in the Haflow agent system
3. The agent will be used for execution when the step is reached

### Adding Tools per Phase

To add phase-specific tools:

1. Extend the system instructions to reference available tools
2. Tools are inherited from the base agent configuration
3. Phase-specific tool selection is handled through system instructions

## Testing the Workflow

### Unit Tests

Unit tests for the workflow are located in `/workspace/packages/backend/tests/unit/services/workflow.test.ts`:

- Workflow is registered and discoverable
- Workflow can be retrieved by ID
- Workflow has correct structure (4 steps)
- Steps are in correct order
- Step types are correct
- Phase sequencing is correct
- Context passing is properly configured
- Prompts contain required elements

Run tests:
```bash
pnpm --filter @haflow/backend test -- workflow.test.ts
```

### Integration Tests

Integration tests verify the workflow integrates correctly with:
- Workflow registry and discovery
- Mission creation and execution
- Frontend UI
- Artifact storage and retrieval
- Step sequencing and transitions

### Manual Testing

To manually test the workflow:

1. Start the backend: `pnpm --filter @haflow/backend dev`
2. Start the frontend: `pnpm --filter frontend dev`
3. Open the UI and create a new mission
4. Select "Raw - Plan → Implement" workflow
5. Provide a task description
6. Observe Phase 1 execution (planning)
7. Review the planning document
8. Confirm to proceed to Phase 2
9. Observe Phase 2 execution (implementation)
10. Review the implementation results

## Architecture Decisions

### Why Two Distinct Phases?

The workflow separates planning and implementation to provide:

1. **Explicit Design Review**: Users can review the approach before implementation
2. **Clear Separation of Concerns**: Planning focuses on understanding; implementation focuses on execution
3. **Flexibility**: Users can request plan adjustments before implementation begins
4. **Better Context**: Phase 2 has full context of design decisions from Phase 1

### Why Use Document Mode for Phase 1?

Phase 1 uses document mode because:
- Focus is on analysis and documentation, not code changes
- No need for full codebase access or test execution
- Cleaner separation between planning and implementation workspaces

### Why Use Codegen Mode for Phase 2?

Phase 2 uses codegen mode because:
- Full codebase access needed to implement changes
- Tests must be run to validate implementation
- Code must be written and tested

## Troubleshooting

### Planning Phase Takes Too Long

If Phase 1 planning takes excessive time:
- Consider if the task might be better suited for the full 8-step workflow
- Ensure the user request is clear and well-structured
- The planning agent may be exploring too thoroughly—this is expected behavior

### Implementation Doesn't Follow Plan

If Phase 2 implementation diverges from the plan:
- Ensure the planning document was clear and specific
- The implementation prompt emphasizes plan adherence
- User can review and ask for corrections

### Phase 2 Can't Read Planning Output

This should not happen in normal operation, but if it does:
- Verify the planning output artifact was created correctly
- Check that the step's inputArtifact points to `planning-output.md`
- Check mission logs for errors during Phase 1

## Files Involved

| File | Purpose |
|------|---------|
| `/packages/backend/src/services/workflow.ts` | Workflow definition and prompts |
| `/packages/backend/tests/unit/services/workflow.test.ts` | Unit tests |
| `/docs/workflows/raw-plan-implement.md` | This documentation |

## Related Documentation

- [Workflow System Overview](./README.md)
- [Haflow Architecture](../architecture.md)
- [User Guide: Raw - Plan → Implement Workflow](../user-guide/raw-plan-implement-workflow.md)

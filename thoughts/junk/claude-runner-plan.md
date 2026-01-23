# Claude Runner Pipeline Implementation Plan

## Overview

Implement a 10-step AI-assisted development pipeline with human gates for review and approval at critical decision points.

---

## Pipeline Architecture

```
Voice Input
    ↓
[Step 3] aiStructureSpecDocument()
    ↓
[Step 4] humanReviewAndApprove() ◄── HUMAN GATE
    ↓
[Step 5] aiResearchCodebase()
    ↓
[Step 6] humanReviewResearch() ◄── HUMAN GATE
    ↓
[Step 7] aiCreateImplementationPlan()
    ↓
[Step 8] humanApproveAndSelectOneshot() ◄── HUMAN GATE
    ↓
[Step 9] executeSafeImplementation()
    ↓
[Step 10] createCommitAndOpenPR()
```

---

## Step-by-Step Implementation

### Step 3: `aiStructureSpecDocument(voiceInput: string)`

**Purpose**: Transform unstructured voice/text input into a formal spec document.

**Implementation**:
```typescript
interface SpecDocument {
  title: string;
  summary: string;
  requirements: string[];
  acceptanceCriteria: string[];
  constraints: string[];
  rawInput: string;
}

async function aiStructureSpecDocument(voiceInput: string): Promise<SpecDocument> {
  const prompt = `
    You are a technical specification writer. Convert the following voice input
    into a structured specification document with:
    - Title
    - Summary (1-2 sentences)
    - Requirements (bullet points)
    - Acceptance Criteria
    - Constraints/Limitations

    Voice Input: ${voiceInput}

    Output JSON only.
  `;

  const result = await runClaude(prompt, '<promise>SPEC_COMPLETE</promise>');
  return parseSpecFromResult(result);
}
```

**Output**: `SpecDocument` object stored at `.haloop/missions/<id>/spec.json`

---

### Step 4: `humanReviewAndApprove(specDoc: SpecDocument)`

**Purpose**: Human gate to review, edit, and approve the AI-generated spec.

**Implementation**:
```typescript
interface ReviewResult<T> {
  approved: boolean;
  edited: boolean;
  data: T;
  feedback?: string;
}

async function humanReviewAndApprove(specDoc: SpecDocument): Promise<SpecDocument> {
  // 1. Save spec to file for human review
  await saveToFile(specDoc, '.haloop/missions/<id>/spec-pending.json');

  // 2. Notify human (webhook, CLI prompt, or API endpoint)
  await notifyHumanForReview('spec', specDoc);

  // 3. Wait for human action via polling or webhook
  const review = await waitForHumanAction<SpecDocument>('spec-review');

  if (!review.approved) {
    throw new HumanRejectedError('Spec rejected', review.feedback);
  }

  return review.data; // May be edited version
}
```

**Human Actions Available**:
- ✅ Approve as-is
- ✏️ Edit and approve
- ❌ Reject with feedback
- 🔄 Request AI regeneration with feedback

---

### Step 5: `aiResearchCodebase(approvedSpec: SpecDocument)`

**Purpose**: AI explores codebase to understand existing patterns, dependencies, and integration points.

**Implementation**:
```typescript
interface ResearchData {
  relevantFiles: Array<{
    path: string;
    purpose: string;
    relevance: 'high' | 'medium' | 'low';
  }>;
  existingPatterns: string[];
  dependencies: string[];
  integrationPoints: string[];
  risks: string[];
  recommendations: string[];
}

async function aiResearchCodebase(approvedSpec: SpecDocument): Promise<ResearchData> {
  // Use codebase-analyzer and codebase-locator agents
  const prompt = `
    Given the following specification:
    ${JSON.stringify(approvedSpec)}

    Research the codebase to identify:
    1. Files that will need modification
    2. Existing patterns to follow
    3. Dependencies to consider
    4. Integration points
    5. Potential risks

    Use ${claudeResources.codebaseAnalyzer} and ${claudeResources.codebaseLocator}
  `;

  const result = await runClaude(prompt, '<promise>RESEARCH_COMPLETE</promise>');
  return parseResearchFromResult(result);
}
```

**Output**: `ResearchData` stored at `.haloop/missions/<id>/research.json`

---

### Step 6: `humanReviewResearch(researchData: ResearchData)`

**Purpose**: Human validates AI's understanding of the codebase before planning.

**Implementation**:
```typescript
async function humanReviewResearch(researchData: ResearchData): Promise<ResearchData> {
  await saveToFile(researchData, '.haloop/missions/<id>/research-pending.json');
  await notifyHumanForReview('research', researchData);

  const review = await waitForHumanAction<ResearchData>('research-review');

  if (!review.approved) {
    throw new HumanRejectedError('Research rejected', review.feedback);
  }

  return review.data;
}
```

**Human Actions Available**:
- ✅ Approve research findings
- ➕ Add missing files/context
- ➖ Remove irrelevant items
- 🔄 Request deeper research on specific areas

---

### Step 7: `aiCreateImplementationPlan(approvedResearch: ResearchData)`

**Purpose**: Create detailed step-by-step implementation plan based on spec and research.

**Implementation**:
```typescript
interface ImplementationPlan {
  overview: string;
  steps: Array<{
    id: number;
    title: string;
    description: string;
    files: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    dependencies: number[]; // Step IDs this depends on
  }>;
  testingStrategy: string;
  rollbackPlan: string;
}

async function aiCreateImplementationPlan(
  approvedResearch: ResearchData
): Promise<ImplementationPlan> {
  const prompt = `
    Based on the approved research:
    ${JSON.stringify(approvedResearch)}

    Create a detailed implementation plan with:
    1. Step-by-step tasks (ordered by dependency)
    2. Files to modify per step
    3. Testing strategy
    4. Rollback plan if something goes wrong

    Use ${claudeResources.createPlan} approach.
  `;

  const result = await runClaude(prompt, '<promise>PLAN_COMPLETE</promise>');
  return parsePlanFromResult(result);
}
```

**Output**: `ImplementationPlan` stored at `.haloop/missions/<id>/plan.json`

---

### Step 8: `humanApproveAndSelectOneshot(plan: ImplementationPlan)`

**Purpose**: Human reviews plan and decides execution strategy (oneshot vs incremental).

**Implementation**:
```typescript
interface ExecutionConfig {
  mode: 'oneshot' | 'incremental';
  plan: ImplementationPlan;
  skipSteps?: number[];
  maxRetries: number;
  timeout: number;
}

async function humanApproveAndSelectOneshot(
  plan: ImplementationPlan
): Promise<ExecutionConfig> {
  await saveToFile(plan, '.haloop/missions/<id>/plan-pending.json');
  await notifyHumanForReview('plan', plan);

  const review = await waitForHumanAction<{
    approved: boolean;
    mode: 'oneshot' | 'incremental';
    skipSteps?: number[];
  }>('plan-review');

  if (!review.approved) {
    throw new HumanRejectedError('Plan rejected', review.feedback);
  }

  return {
    mode: review.data.mode,
    plan: plan,
    skipSteps: review.data.skipSteps,
    maxRetries: 3,
    timeout: 30 * 60 * 1000, // 30 minutes
  };
}
```

**Human Actions Available**:
- ✅ Approve and select "Oneshot" (execute all at once)
- ✅ Approve and select "Incremental" (step-by-step with pauses)
- ⏭️ Skip specific steps
- ✏️ Reorder steps
- ❌ Reject and request replanning

---

### Step 9: `executeSafeImplementation(config: ExecutionConfig)`

**Purpose**: Execute implementation in isolated Docker sandbox.

**Implementation**:
```typescript
interface ExecutionResult {
  success: boolean;
  changedFiles: Array<{
    path: string;
    changeType: 'created' | 'modified' | 'deleted';
    diff?: string;
  }>;
  logs: string[];
  errors?: string[];
}

async function executeSafeImplementation(
  config: ExecutionConfig
): Promise<ExecutionResult> {
  const results: ExecutionResult = {
    success: true,
    changedFiles: [],
    logs: [],
  };

  for (const step of config.plan.steps) {
    if (config.skipSteps?.includes(step.id)) {
      results.logs.push(`Skipping step ${step.id}: ${step.title}`);
      continue;
    }

    const stepPrompt = `
      Execute implementation step:
      ${JSON.stringify(step)}

      Work in the Docker sandbox. Make minimal, focused changes.
      Use ${claudeResources.implementPlan} approach.
    `;

    try {
      const stepResult = await runClaude(stepPrompt, '<promise>STEP_COMPLETE</promise>');
      results.logs.push(`Completed step ${step.id}: ${step.title}`);

      // Parse changed files from result
      const changes = parseChangesFromResult(stepResult);
      results.changedFiles.push(...changes);

      if (config.mode === 'incremental') {
        // Pause for human review between steps
        await humanReviewStepResult(step, changes);
      }
    } catch (err) {
      results.success = false;
      results.errors = results.errors || [];
      results.errors.push(`Step ${step.id} failed: ${err.message}`);

      // Attempt rollback if configured
      if (config.maxRetries > 0) {
        // Retry logic
      }
      break;
    }
  }

  return results;
}
```

**Safety Features**:
- Docker isolation (no host filesystem access except project)
- Timeout enforcement
- Automatic rollback on failure
- Change tracking for audit

---

### Step 10: `createCommitAndOpenPR(codeChanges: ExecutionResult)`

**Purpose**: Commit changes and open PR for final human review.

**Implementation**:
```typescript
interface PRResult {
  commitHash: string;
  branch: string;
  prUrl: string;
  prNumber: number;
}

async function createCommitAndOpenPR(
  codeChanges: ExecutionResult
): Promise<PRResult> {
  if (!codeChanges.success) {
    throw new Error('Cannot create PR from failed implementation');
  }

  const prompt = `
    Create a git commit and PR for the following changes:

    Changed files:
    ${codeChanges.changedFiles.map(f => `- ${f.changeType}: ${f.path}`).join('\n')}

    Use ${claudeResources.commitPushCreatePr} approach.

    Generate appropriate:
    - Branch name
    - Commit message
    - PR title and description
  `;

  const result = await runClaude(prompt, '<promise>PR_COMPLETE</promise>');
  return parsePRResultFromResult(result);
}
```

**Output**: PR URL for final human code review

---

## Supporting Infrastructure

### Human Gate Notification System

```typescript
type NotificationType = 'spec' | 'research' | 'plan' | 'step-result';

interface NotificationConfig {
  webhook?: string;
  email?: string;
  cli?: boolean; // Interactive CLI prompt
}

async function notifyHumanForReview(
  type: NotificationType,
  data: unknown
): Promise<void> {
  // Implementation based on user config
}

async function waitForHumanAction<T>(
  reviewType: string,
  timeout?: number
): Promise<ReviewResult<T>> {
  // Poll database or wait for webhook callback
}
```

### State Persistence

All intermediate states saved to `.haloop/missions/<id>/`:
```
.haloop/missions/<mission-id>/
├── spec.json           # Approved spec
├── spec-pending.json   # Awaiting review
├── research.json       # Approved research
├── plan.json           # Approved plan
├── execution-log.json  # Step-by-step execution log
└── pr-result.json      # Final PR details
```

### Error Handling

```typescript
class HumanRejectedError extends Error {
  constructor(message: string, public feedback?: string) {
    super(message);
  }
}

class ExecutionTimeoutError extends Error {}
class SandboxViolationError extends Error {}
```

---

## API Endpoints Required

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/missions/:id/review/spec` | Submit spec review |
| POST | `/api/missions/:id/review/research` | Submit research review |
| POST | `/api/missions/:id/review/plan` | Submit plan review |
| GET | `/api/missions/:id/status` | Poll current pipeline stage |
| POST | `/api/missions/:id/abort` | Abort pipeline at any stage |

---

## Implementation Order

1. **Phase 1**: Core types and interfaces
2. **Phase 2**: `aiStructureSpecDocument` + `humanReviewAndApprove`
3. **Phase 3**: `aiResearchCodebase` + `humanReviewResearch`
4. **Phase 4**: `aiCreateImplementationPlan` + `humanApproveAndSelectOneshot`
5. **Phase 5**: `executeSafeImplementation` (Docker integration)
6. **Phase 6**: `createCommitAndOpenPR`
7. **Phase 7**: API endpoints and notification system
8. **Phase 8**: End-to-end testing

---

## Notes

- Each human gate should have configurable timeout with auto-reminder
- All Claude calls use existing `runClaude()` function
- Consider adding WebSocket support for real-time status updates
- Implement retry logic with exponential backoff for AI calls

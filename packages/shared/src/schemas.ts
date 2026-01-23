import { z } from 'zod';

// Mission type - branch-friendly types
export const MissionTypeSchema = z.enum(['feature', 'fix', 'bugfix', 'hotfix', 'enhance']);

// Mission status derived from workflow position + container state
export const MissionStatusSchema = z.enum([
  'draft',              // Initial state, not started
  'ready',              // Ready to run
  'waiting_human',      // At a human gate
  'running_code_agent', // Agent container running
  'running_root_llm',   // root LLM running
  'failed',             // Agent failed
  'completed',          // All steps done
]);

// Step types in a workflow
export const StepTypeSchema = z.enum(['llm', 'agent', 'human-gate']);

// Workflow step definition
export const WorkflowStepSchema = z.object({
  step_id: z.string(),
  name: z.string(),
  type: StepTypeSchema,
  agent: z.string().optional(),           // Agent name from agents.json
  inputArtifact: z.string().optional(),   // e.g., "raw-input.md"
  outputArtifact: z.string().optional(),  // e.g., "structured-text.md"
  reviewArtifact: z.string().optional(),  // For human-gate steps
});

// Workflow definition
export const WorkflowSchema = z.object({
  workflow_id: z.string(),
  name: z.string(),
  steps: z.array(WorkflowStepSchema),
});

// Mission metadata (stored in mission.json)
export const MissionMetaSchema = z.object({
  mission_id: z.string(),
  title: z.string(),
  type: MissionTypeSchema,
  workflow_id: z.string(),
  current_step: z.number(),
  status: MissionStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
  errors: z.array(z.string()),
  last_error: z.string().optional(),
});

// Step run metadata (stored in runs/*.json)
export const StepRunSchema = z.object({
  step_id: z.string(),
  run_id: z.string(),
  started_at: z.string(),
  finished_at: z.string().optional(),
  exit_code: z.number().optional(),
  container_id: z.string().optional(),
});

// API response wrapper
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.nullable(),
    error: z.string().nullable(),
  });

// Mission list item for sidebar
export const MissionListItemSchema = z.object({
  mission_id: z.string(),
  title: z.string(),
  type: z.string(),
  status: MissionStatusSchema,
  current_step_name: z.string(),
  updated_at: z.string(),
});

// Full mission detail
export const MissionDetailSchema = MissionMetaSchema.extend({
  workflow: WorkflowSchema,
  artifacts: z.record(z.string(), z.string()),  // filename -> content
  runs: z.array(StepRunSchema),
  current_log_tail: z.string().optional(),      // Last N bytes of current step log
});

// API request schemas
export const CreateMissionRequestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: MissionTypeSchema,
  rawInput: z.string().min(1, 'Raw input is required'),
});

export const SaveArtifactRequestSchema = z.object({
  content: z.string(),
});

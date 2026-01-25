import { z } from 'zod';
import {
  MissionTypeSchema,
  MissionStatusSchema,
  StepTypeSchema,
  WorkspaceModeSchema,
  WorkflowStepSchema,
  WorkflowSchema,
  MissionMetaSchema,
  StepRunSchema,
  MissionListItemSchema,
  MissionDetailSchema,
  CreateMissionRequestSchema,
  SaveArtifactRequestSchema,
  TranscriptionResponseSchema,
  TranscriptionStatusSchema,
} from './schemas.js';

// Infer types from schemas
export type MissionType = z.infer<typeof MissionTypeSchema>;
export type MissionStatus = z.infer<typeof MissionStatusSchema>;
export type StepType = z.infer<typeof StepTypeSchema>;
export type WorkspaceMode = z.infer<typeof WorkspaceModeSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type MissionMeta = z.infer<typeof MissionMetaSchema>;
export type StepRun = z.infer<typeof StepRunSchema>;
export type MissionListItem = z.infer<typeof MissionListItemSchema>;
export type MissionDetail = z.infer<typeof MissionDetailSchema>;
export type CreateMissionRequest = z.infer<typeof CreateMissionRequestSchema>;
export type SaveArtifactRequest = z.infer<typeof SaveArtifactRequestSchema>;
export type TranscriptionResponse = z.infer<typeof TranscriptionResponseSchema>;
export type TranscriptionStatus = z.infer<typeof TranscriptionStatusSchema>;

// API response wrapper (kept as interface for generic usage)
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

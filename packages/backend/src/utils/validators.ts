import { z } from 'zod';

/**
 * Schema for creating a new project
 */
export const CreateProjectSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

/**
 * Schema for updating a project
 */
export const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

/**
 * Schema for creating a new mission
 */
export const CreateMissionSchema = z.object({
  projectId: z.string().min(1),
  featureName: z.string().min(1),
  description: z.string().min(1),
  draft: z.string().min(1),
});

export type CreateMissionInput = z.infer<typeof CreateMissionSchema>;

/**
 * Schema for updating a mission
 */
export const UpdateMissionSchema = z.object({
  feature_name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  prd: z.string().optional(),
});

export type UpdateMissionInput = z.infer<typeof UpdateMissionSchema>;

/**
 * Schema for rejection feedback (PRD or tasks rejection)
 */
export const RejectSchema = z.object({
  notes: z.string().min(1),
});

export type RejectInput = z.infer<typeof RejectSchema>;

/**
 * Schema for sending signals to processes
 */
export const SignalSchema = z.object({
  signal: z.enum(['SIGTERM', 'SIGKILL']),
});

export type SignalInput = z.infer<typeof SignalSchema>;

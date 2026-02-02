import axios from 'axios';
import type { MissionListItem, MissionDetail, MissionMeta, ApiResponse, TranscriptionResponse, TranscriptionStatus, Workflow } from '@haflow/shared';

const host = window.location.hostname
// const API_BASE = 'http://localhost:4000/api';
const API_BASE = `http://${host}:4000/api`;

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  listMissions: async (): Promise<MissionListItem[]> => {
    const res = await client.get<ApiResponse<MissionListItem[]>>('/missions');
    if (!res.data.success) throw new Error(res.data.error || 'Failed to list missions');
    return res.data.data!;
  },

  getWorkflows: async (): Promise<Workflow[]> => {
    const res = await client.get<ApiResponse<Workflow[]>>('/workflows');
    if (!res.data.success) throw new Error(res.data.error || 'Failed to list workflows');
    return res.data.data!;
  },

  getMission: async (id: string): Promise<MissionDetail> => {
    const res = await client.get<ApiResponse<MissionDetail>>(`/missions/${id}`);
    if (!res.data.success) throw new Error(res.data.error || 'Failed to get mission');
    return res.data.data!;
  },

  createMission: async (
    title: string,
    type: string,
    rawInput: string,
    workflowId?: string
  ): Promise<MissionMeta> => {
    const res = await client.post<ApiResponse<MissionMeta>>('/missions', {
      title,
      type,
      rawInput,
      workflowId,
    });
    if (!res.data.success) throw new Error(res.data.error || 'Failed to create mission');
    return res.data.data!;
  },

  saveArtifact: async (missionId: string, filename: string, content: string): Promise<void> => {
    const res = await client.put<ApiResponse<void>>(`/missions/${missionId}/artifacts/${filename}`, { content });
    if (!res.data.success) throw new Error(res.data.error || 'Failed to save artifact');
  },

  continueMission: async (missionId: string): Promise<void> => {
    const res = await client.post<ApiResponse<void>>(`/missions/${missionId}/continue`);
    if (!res.data.success) throw new Error(res.data.error || 'Failed to continue mission');
  },

  markCompleted: async (missionId: string): Promise<void> => {
    const res = await client.post<ApiResponse<void>>(`/missions/${missionId}/mark-completed`);
    if (!res.data.success) throw new Error(res.data.error || 'Failed to mark completed');
  },

  transcribeAudio: async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    const res = await client.post<ApiResponse<TranscriptionResponse>>(
      '/transcribe',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    if (!res.data.success) throw new Error(res.data.error || 'Transcription failed');
    return res.data.data!.text;
  },

  getTranscriptionStatus: async (): Promise<TranscriptionStatus> => {
    const res = await client.get<ApiResponse<TranscriptionStatus>>('/transcribe/status');
    if (!res.data.success) throw new Error(res.data.error || 'Failed to get status');
    return res.data.data!;
  },

  cleanupContainers: async (): Promise<{ removed: number; total?: number; message: string }> => {
    const res = await client.delete<ApiResponse<{ removed: number; total?: number; message: string }>>('/system/cleanup-containers');
    if (!res.data.success) throw new Error(res.data.error || 'Failed to cleanup containers');
    return res.data.data!;
  },

  // Code review step APIs
  runCommand: async (
    missionId: string,
    command: string,
    timeout?: number
  ): Promise<{ executionId: string }> => {
    const res = await client.post<ApiResponse<{ executionId: string }>>(
      `/missions/${missionId}/run-command`,
      { command, timeout }
    );
    if (!res.data.success) throw new Error(res.data.error || 'Failed to run command');
    return res.data.data!;
  },

  getExecution: async (
    missionId: string,
    executionId: string
  ): Promise<{
    id: string;
    command: string;
    status: 'running' | 'completed' | 'failed';
    output: string;
    exitCode?: number;
    startedAt: string;
    finishedAt?: string;
  }> => {
    const res = await client.get<ApiResponse<{
      id: string;
      command: string;
      status: 'running' | 'completed' | 'failed';
      output: string;
      exitCode?: number;
      startedAt: string;
      finishedAt?: string;
    }>>(`/missions/${missionId}/execution/${executionId}`);
    if (!res.data.success) throw new Error(res.data.error || 'Failed to get execution');
    return res.data.data!;
  },

  getFullDiff: async (missionId: string): Promise<{ diff: string }> => {
    const res = await client.get<ApiResponse<{ diff: string }>>(`/missions/${missionId}/git-diff`);
    if (!res.data.success) throw new Error(res.data.error || 'Failed to get diff');
    return res.data.data!;
  },

  getFileDiff: async (missionId: string, filePath: string): Promise<{ diff: string }> => {
    const res = await client.get<ApiResponse<{ diff: string }>>(
      `/missions/${missionId}/git-diff/${encodeURIComponent(filePath)}`
    );
    if (!res.data.success) throw new Error(res.data.error || 'Failed to get file diff');
    return res.data.data!;
  },

  getGitStatus: async (missionId: string): Promise<{
    hasChanges: boolean;
    files: Array<{ path: string; status: string }>;
    summary: string;
  }> => {
    const res = await client.get<ApiResponse<{
      hasChanges: boolean;
      files: Array<{ path: string; status: string }>;
      summary: string;
    }>>(`/missions/${missionId}/git-status`);
    if (!res.data.success) throw new Error(res.data.error || 'Failed to get git status');
    return res.data.data!;
  },

  deleteMission: async (missionId: string): Promise<void> => {
    const res = await client.delete<ApiResponse<void>>(`/missions/${missionId}`);
    if (!res.data.success) throw new Error(res.data.error || 'Failed to delete mission');
  },

  bulkDeleteMissions: async (
    missionIds: string[],
    reason?: string
  ): Promise<{ deleted: number; failed: number; failedIds?: string[] }> => {
    const res = await client.post<ApiResponse<{ deleted: number; failed: number; failedIds?: string[] }>>(
      '/missions/bulk-delete',
      { ids: missionIds, reason }
    );
    if (!res.data.success) throw new Error(res.data.error || 'Failed to delete missions');
    return res.data.data!;
  },
};

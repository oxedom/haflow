import axios from 'axios';
import type { MissionListItem, MissionDetail, MissionMeta, ApiResponse } from '@haflow/shared';

const API_BASE = 'http://localhost:4000/api';

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

  getMission: async (id: string): Promise<MissionDetail> => {
    const res = await client.get<ApiResponse<MissionDetail>>(`/missions/${id}`);
    if (!res.data.success) throw new Error(res.data.error || 'Failed to get mission');
    return res.data.data!;
  },

  createMission: async (title: string, type: string, rawInput: string): Promise<MissionMeta> => {
    const res = await client.post<ApiResponse<MissionMeta>>('/missions', { title, type, rawInput });
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


};

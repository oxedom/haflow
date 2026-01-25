import { ConnectionLineType } from 'reactflow';

export const REACT_FLOW_CONFIG = {
  defaultViewport: { x: 0, y: 0, zoom: 1 },
  minZoom: 0.25,
  maxZoom: 2,
  snapToGrid: true,
  snapGrid: [16, 16] as [number, number],
  connectionLineType: ConnectionLineType.SmoothStep,
  deleteKeyCode: ['Backspace', 'Delete'],
};

export const NODE_DIMENSIONS = {
  width: 280,
  height: 120,
  spacing: { x: 320, y: 160 },
};

// Agent color mapping
export const AGENT_COLORS: Record<string, string> = {
  'cleanup-agent': '#3B82F6',    // Blue
  'research-agent': '#8B5CF6',   // Purple
  'planning-agent': '#F59E0B',   // Amber
  'impl-agent': '#10B981',       // Green
};

// Node type colors
export const NODE_TYPE_COLORS: Record<string, string> = {
  'agent': '#6B7280',       // Gray (default, overridden by agent color)
  'human-gate': '#EF4444',  // Red
  'code-review': '#6366F1', // Indigo
};

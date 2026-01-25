import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import { WorkflowStepWithStatus } from '@/types/workflow';
import { Bot } from 'lucide-react';
import { AGENT_COLORS } from '../config';

const AGENT_LABELS: Record<string, string> = {
  'cleanup-agent': 'Cleanup Agent',
  'research-agent': 'Research Agent',
  'planning-agent': 'Planning Agent',
  'impl-agent': 'Implementation Agent',
};

export function AgentNode(props: NodeProps<WorkflowStepWithStatus>) {
  const { data } = props;
  const agentColor = data.agent ? AGENT_COLORS[data.agent] || '#6B7280' : '#6B7280';

  return (
    <BaseNode {...props} icon={<Bot className="w-5 h-5" />} color={agentColor}>
      <div className="flex gap-2">
        <span className="text-gray-500">Agent:</span>
        <span className="text-gray-800 font-medium">
          {data.agent ? AGENT_LABELS[data.agent] || data.agent : 'Not set'}
        </span>
      </div>
      {data.inputArtifact && (
        <div className="flex gap-2">
          <span className="text-gray-500">Input:</span>
          <span className="text-gray-800 font-mono">{data.inputArtifact}</span>
        </div>
      )}
      {data.outputArtifact && (
        <div className="flex gap-2">
          <span className="text-gray-500">Output:</span>
          <span className="text-gray-800 font-mono">{data.outputArtifact}</span>
        </div>
      )}
      <div className="flex gap-2">
        <span className="text-gray-500">Mode:</span>
        <span className="text-gray-800">{data.workspaceMode}</span>
      </div>
    </BaseNode>
  );
}

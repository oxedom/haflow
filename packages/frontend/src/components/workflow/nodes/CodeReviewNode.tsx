import type { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import type { WorkflowStepWithStatus } from '@/types/workflow';
import { Code2 } from 'lucide-react';
import { NODE_TYPE_COLORS } from '../config';

export function CodeReviewNode(props: NodeProps<WorkflowStepWithStatus>) {
  const { data } = props;

  return (
    <BaseNode {...props} icon={<Code2 className="w-5 h-5" />} color={NODE_TYPE_COLORS['code-review']}>
      <div className="flex gap-2">
        <span className="text-gray-500">Mode:</span>
        <span className="text-gray-800">{data.workspaceMode}</span>
      </div>
      {data.quickCommands && data.quickCommands.length > 0 && (
        <div className="flex gap-2">
          <span className="text-gray-500">Commands:</span>
          <span className="text-gray-800">{data.quickCommands.length} available</span>
        </div>
      )}
    </BaseNode>
  );
}

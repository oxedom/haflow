import { NodeProps } from 'reactflow';
import { BaseNode } from './BaseNode';
import { WorkflowStepWithStatus } from '@/types/workflow';
import { User } from 'lucide-react';
import { NODE_TYPE_COLORS } from '../config';
import { Badge } from '@/components/ui/badge';

export function HumanGateNode(props: NodeProps<WorkflowStepWithStatus>) {
  const { data } = props;

  return (
    <BaseNode {...props} icon={<User className="w-5 h-5" />} color={NODE_TYPE_COLORS['human-gate']}>
      <div className="flex gap-2">
        <span className="text-gray-500">Review:</span>
        <span className="text-gray-800 font-mono">{data.reviewArtifact || 'Not set'}</span>
      </div>
      <div className="flex gap-2">
        <span className="text-gray-500">Mode:</span>
        <span className="text-gray-800">{data.workspaceMode}</span>
      </div>
      <div className="mt-2">
        <Badge variant="warning" className="text-[10px]">
          Requires Human Approval
        </Badge>
      </div>
    </BaseNode>
  );
}

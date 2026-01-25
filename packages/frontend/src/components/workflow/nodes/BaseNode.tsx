import { Handle, Position, type NodeProps } from 'reactflow';
import type { WorkflowStepWithStatus, ExecutionStatus } from '@/types/workflow';
import { cn } from '@/lib/utils';
import { Check, X, Loader2 } from 'lucide-react';

interface BaseNodeProps extends NodeProps<WorkflowStepWithStatus> {
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}

const STATUS_STYLES: Record<ExecutionStatus, string> = {
  pending: 'status-pending',
  running: 'status-running',
  completed: 'status-completed',
  failed: 'status-failed',
};

export function BaseNode({ data, selected, icon, color, children }: BaseNodeProps) {
  const statusClass = data.executionStatus ? STATUS_STYLES[data.executionStatus] : '';

  return (
    <div
      className={cn(
        'workflow-node bg-white border-2 rounded-lg p-3 min-w-[240px] shadow-md relative',
        selected && 'ring-2 ring-blue-500',
        statusClass
      )}
      style={{ borderColor: color }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white"
      />

      {data.executionStatus && (
        <div
          className={cn(
            'absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center',
            data.executionStatus === 'pending' && 'bg-gray-200',
            data.executionStatus === 'running' && 'bg-blue-500',
            data.executionStatus === 'completed' && 'bg-green-500',
            data.executionStatus === 'failed' && 'bg-red-500'
          )}
        >
          {data.executionStatus === 'running' && (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          )}
          {data.executionStatus === 'completed' && (
            <Check className="w-4 h-4 text-white" />
          )}
          {data.executionStatus === 'failed' && (
            <X className="w-4 h-4 text-white" />
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mb-2 font-semibold text-gray-800">
        <span className="flex-shrink-0" style={{ color }}>{icon}</span>
        <span className="truncate">{data.name}</span>
      </div>

      <div className="space-y-1 text-xs">
        {children}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
}

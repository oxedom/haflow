import { WorkflowStepWithStatus, NodeType } from '@/types/workflow';
import { AgentConfig } from './AgentConfig';
import { HumanGateConfig } from './HumanGateConfig';
import { CodeReviewConfig } from './CodeReviewConfig';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Trash2 } from 'lucide-react';

interface NodeConfigPanelProps {
  node: WorkflowStepWithStatus | null;
  nodeType: NodeType | null;
  onUpdate: (data: Partial<WorkflowStepWithStatus>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function NodeConfigPanel({
  node,
  nodeType,
  onUpdate,
  onDelete,
  onClose,
}: NodeConfigPanelProps) {
  if (!node || !nodeType) {
    return (
      <div className="w-80 border-l border-gray-200 bg-white flex items-center justify-center p-4">
        <p className="text-gray-400 text-sm text-center">
          Select a node to configure
        </p>
      </div>
    );
  }

  const ConfigComponent = {
    agent: AgentConfig,
    'human-gate': HumanGateConfig,
    'code-review': CodeReviewConfig,
  }[nodeType];

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">
          Configure {nodeType.replace('-', ' ')}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onClose}
          data-testid="close-config-panel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="step-name">Step Name</Label>
          <Input
            id="step-name"
            type="text"
            value={node.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            data-testid="step-name-input"
          />
        </div>

        {ConfigComponent && <ConfigComponent node={node} onUpdate={onUpdate} />}
      </div>

      <div className="p-4 border-t border-gray-200">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={onDelete}
          data-testid="delete-node-button"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Node
        </Button>
      </div>
    </div>
  );
}

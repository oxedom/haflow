import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Play, Save } from 'lucide-react';

interface WorkflowToolbarProps {
  workflowName: string;
  isDirty: boolean;
  onSave: () => void;
  onExecute: () => void;
  onClear: () => void;
  onNameChange: (name: string) => void;
  isSaving?: boolean;
  isExecuting?: boolean;
}

export function WorkflowToolbar({
  workflowName,
  isDirty,
  onSave,
  onExecute,
  onClear,
  onNameChange,
  isSaving = false,
  isExecuting = false,
}: WorkflowToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-3">
        <Input
          type="text"
          className="w-64 text-lg font-semibold border-transparent hover:border-gray-300 focus:border-blue-500"
          value={workflowName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Workflow name"
          data-testid="workflow-name-input"
        />
        {isDirty && (
          <span className="text-sm text-amber-600 font-medium">
            Unsaved changes
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          data-testid="clear-workflow-button"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          data-testid="save-workflow-button"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onExecute}
          disabled={isExecuting}
          className="bg-green-600 hover:bg-green-700"
          data-testid="execute-workflow-button"
        >
          <Play className="w-4 h-4 mr-2" />
          {isExecuting ? 'Starting...' : 'Execute'}
        </Button>
      </div>
    </div>
  );
}

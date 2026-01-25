import { useState, type KeyboardEvent } from 'react';
import type { WorkflowStepWithStatus } from '@/types/workflow';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus } from 'lucide-react';

interface CodeReviewConfigProps {
  node: WorkflowStepWithStatus;
  onUpdate: (data: Partial<WorkflowStepWithStatus>) => void;
}

export function CodeReviewConfig({ node, onUpdate }: CodeReviewConfigProps) {
  const [newCommand, setNewCommand] = useState('');
  const commands = node.quickCommands || [];

  const addCommand = () => {
    if (newCommand.trim()) {
      onUpdate({ quickCommands: [...commands, newCommand.trim()] });
      setNewCommand('');
    }
  };

  const removeCommand = (index: number) => {
    const updated = commands.filter((_, i) => i !== index);
    onUpdate({ quickCommands: updated });
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCommand();
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="workspace-mode">Workspace Mode</Label>
        <Select
          value={node.workspaceMode}
          onValueChange={(value) =>
            onUpdate({ workspaceMode: value as 'document' | 'codegen' })
          }
        >
          <SelectTrigger id="workspace-mode" data-testid="workspace-mode-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="document">Document (Markdown)</SelectItem>
            <SelectItem value="codegen">Code Generation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Quick Commands</Label>
        {commands.length > 0 && (
          <div className="space-y-1">
            {commands.map((cmd, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded border"
              >
                <code className="flex-1 text-sm text-gray-700 font-mono truncate">
                  {cmd}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                  onClick={() => removeCommand(index)}
                  data-testid={`remove-command-${index}`}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            type="text"
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="npm run test"
            className="flex-1"
            data-testid="new-command-input"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={addCommand}
            data-testid="add-command-button"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

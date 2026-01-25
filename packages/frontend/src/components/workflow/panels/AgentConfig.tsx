import { WorkflowStepWithStatus, AgentType } from '@/types/workflow';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const AGENTS: { value: AgentType; label: string }[] = [
  { value: 'cleanup-agent', label: 'Cleanup Agent' },
  { value: 'research-agent', label: 'Research Agent' },
  { value: 'planning-agent', label: 'Planning Agent' },
  { value: 'impl-agent', label: 'Implementation Agent' },
];

const WORKSPACE_MODES: { value: 'document' | 'codegen'; label: string }[] = [
  { value: 'document', label: 'Document (Markdown)' },
  { value: 'codegen', label: 'Code Generation' },
];

interface AgentConfigProps {
  node: WorkflowStepWithStatus;
  onUpdate: (data: Partial<WorkflowStepWithStatus>) => void;
}

export function AgentConfig({ node, onUpdate }: AgentConfigProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="agent-type">Agent Type</Label>
        <Select
          value={node.agent || ''}
          onValueChange={(value) => onUpdate({ agent: value as AgentType })}
        >
          <SelectTrigger id="agent-type" data-testid="agent-type-select">
            <SelectValue placeholder="Select agent..." />
          </SelectTrigger>
          <SelectContent>
            {AGENTS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="input-artifact">Input Artifact</Label>
        <Input
          id="input-artifact"
          type="text"
          value={node.inputArtifact || ''}
          onChange={(e) => onUpdate({ inputArtifact: e.target.value })}
          placeholder="e.g., raw-input.md"
          data-testid="input-artifact-input"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="output-artifact">Output Artifact</Label>
        <Input
          id="output-artifact"
          type="text"
          value={node.outputArtifact || ''}
          onChange={(e) => onUpdate({ outputArtifact: e.target.value })}
          placeholder="e.g., research-output.md"
          data-testid="output-artifact-input"
        />
      </div>

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
            {WORKSPACE_MODES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

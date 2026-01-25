import { WorkflowStepWithStatus } from '@/types/workflow';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HumanGateConfigProps {
  node: WorkflowStepWithStatus;
  onUpdate: (data: Partial<WorkflowStepWithStatus>) => void;
}

export function HumanGateConfig({ node, onUpdate }: HumanGateConfigProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="review-artifact">Review Artifact</Label>
        <Input
          id="review-artifact"
          type="text"
          value={node.reviewArtifact || ''}
          onChange={(e) => onUpdate({ reviewArtifact: e.target.value })}
          placeholder="e.g., implementation-plan.md"
          data-testid="review-artifact-input"
        />
        <p className="text-xs text-gray-500">
          The artifact that requires human review
        </p>
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
            <SelectItem value="document">Document (Markdown)</SelectItem>
            <SelectItem value="codegen">Code Generation</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

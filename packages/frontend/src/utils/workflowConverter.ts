import type {
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  WorkflowStepWithStatus,
} from '@/types/workflow';
import type { Workflow, WorkflowStep } from '@haflow/shared';

export function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateEdgeId(): string {
  return `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createEmptyWorkflow(): Workflow {
  return {
    workflow_id: generateNodeId(),
    name: 'New Workflow',
    steps: [],
  };
}

export function createDefaultNodeData(type: NodeType): WorkflowStepWithStatus {
  const baseData: WorkflowStepWithStatus = {
    step_id: generateNodeId(),
    name: `New ${type} step`,
    type,
    workspaceMode: 'document',
  };

  if (type === 'agent') {
    return { ...baseData, agent: undefined, inputArtifact: '', outputArtifact: '' };
  }
  if (type === 'human-gate') {
    return { ...baseData, reviewArtifact: '' };
  }
  if (type === 'code-review') {
    return { ...baseData, quickCommands: [] };
  }

  return baseData;
}

export function convertNodesToWorkflow(
  workflowId: string,
  name: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): Workflow {
  // Build adjacency list from edges
  const adjacency = new Map<string, string>();
  edges.forEach((edge) => {
    adjacency.set(edge.source, edge.target);
  });

  // Find start node (no incoming edges)
  const targetNodes = new Set(edges.map((e) => e.target));
  const startNode = nodes.find((n) => !targetNodes.has(n.id));

  if (!startNode) {
    // If no clear start node, just return steps in node order
    const steps: WorkflowStep[] = nodes.map((n) => ({
      step_id: n.data.step_id,
      name: n.data.name,
      type: n.data.type,
      agent: n.data.agent,
      inputArtifact: n.data.inputArtifact,
      outputArtifact: n.data.outputArtifact,
      reviewArtifact: n.data.reviewArtifact,
      workspaceMode: n.data.workspaceMode,
      quickCommands: n.data.quickCommands,
    }));
    return { workflow_id: workflowId, name, steps };
  }

  // Traverse in order
  const orderedSteps: WorkflowStep[] = [];
  let currentId: string | undefined = startNode.id;

  while (currentId) {
    const node = nodes.find((n) => n.id === currentId);
    if (node) {
      orderedSteps.push({
        step_id: node.data.step_id,
        name: node.data.name,
        type: node.data.type,
        agent: node.data.agent,
        inputArtifact: node.data.inputArtifact,
        outputArtifact: node.data.outputArtifact,
        reviewArtifact: node.data.reviewArtifact,
        workspaceMode: node.data.workspaceMode,
        quickCommands: node.data.quickCommands,
      });
    }
    currentId = adjacency.get(currentId);
  }

  return { workflow_id: workflowId, name, steps: orderedSteps };
}

export function convertWorkflowToNodes(
  workflow: Workflow
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const nodes: WorkflowNode[] = workflow.steps.map((step, index) => ({
    id: step.step_id,
    type: step.type as NodeType,
    position: { x: 100 + index * 350, y: 100 },
    data: {
      ...step,
      type: step.type as NodeType,
    } as WorkflowStepWithStatus,
  }));

  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < workflow.steps.length - 1; i++) {
    edges.push({
      id: generateEdgeId(),
      source: workflow.steps[i].step_id,
      target: workflow.steps[i + 1].step_id,
    });
  }

  return { nodes, edges };
}

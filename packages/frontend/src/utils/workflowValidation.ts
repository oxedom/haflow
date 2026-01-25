import type { WorkflowNode, WorkflowEdge, ValidationError, ValidationResult } from '@/types/workflow';

export function validateWorkflowForExecution(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): ValidationResult {
  const errors: ValidationError[] = [];

  // Check for at least one node
  if (nodes.length === 0) {
    errors.push({ message: 'Workflow must have at least one node' });
    return { valid: false, errors };
  }

  // Check all agent nodes have agent type
  nodes.forEach((node) => {
    if (node.type === 'agent' && !node.data.agent) {
      errors.push({
        nodeId: node.id,
        field: 'agent',
        message: `Agent node "${node.data.name}" must have an agent type selected`,
      });
    }
  });

  // Check for disconnected nodes (except when there's only one node)
  if (nodes.length > 1) {
    const connectedNodes = new Set<string>();
    edges.forEach((edge) => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    nodes.forEach((node) => {
      if (!connectedNodes.has(node.id)) {
        errors.push({
          nodeId: node.id,
          message: `Node "${node.data.name}" is not connected to the workflow`,
        });
      }
    });
  }

  // Check for cycles
  if (hasCycle(nodes, edges)) {
    errors.push({ message: 'Workflow contains a cycle, which is not allowed' });
  }

  return { valid: errors.length === 0, errors };
}

function hasCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
  const adjacency = new Map<string, string[]>();
  nodes.forEach((n) => adjacency.set(n.id, []));
  edges.forEach((e) => {
    const neighbors = adjacency.get(e.source);
    if (neighbors) {
      neighbors.push(e.target);
    }
  });

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);

    for (const neighbor of adjacency.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
}

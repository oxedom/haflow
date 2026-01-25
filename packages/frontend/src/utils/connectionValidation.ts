import { Connection } from 'reactflow';
import { WorkflowNode, WorkflowEdge, NodeType } from '@/types/workflow';

interface ConnectionRules {
  canConnectTo: NodeType[];
  maxOutputs: number;
  maxInputs: number;
}

const CONNECTION_RULES: Record<NodeType, ConnectionRules> = {
  'agent': {
    canConnectTo: ['agent', 'human-gate', 'code-review'],
    maxOutputs: 1,
    maxInputs: 1,
  },
  'human-gate': {
    canConnectTo: ['agent', 'code-review'],
    maxOutputs: 1,
    maxInputs: 1,
  },
  'code-review': {
    canConnectTo: ['agent'],
    maxOutputs: 1,
    maxInputs: 1,
  },
};

export interface ConnectionValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateConnection(
  connection: Connection,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): ConnectionValidationResult {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);

  if (!sourceNode || !targetNode) {
    return { valid: false, reason: 'Invalid node reference' };
  }

  const sourceType = sourceNode.type as NodeType;
  const targetType = targetNode.type as NodeType;

  // Check if connection type is allowed
  const rules = CONNECTION_RULES[sourceType];
  if (!rules) {
    return { valid: false, reason: `Unknown source node type: ${sourceType}` };
  }

  if (!rules.canConnectTo.includes(targetType)) {
    return { valid: false, reason: `${sourceType} cannot connect to ${targetType}` };
  }

  // Check max outputs from source
  const sourceOutputs = edges.filter((e) => e.source === connection.source).length;
  if (sourceOutputs >= rules.maxOutputs) {
    return { valid: false, reason: `${sourceType} can only have ${rules.maxOutputs} output(s)` };
  }

  // Check max inputs to target
  const targetRules = CONNECTION_RULES[targetType];
  if (targetRules) {
    const targetInputs = edges.filter((e) => e.target === connection.target).length;
    if (targetInputs >= targetRules.maxInputs) {
      return { valid: false, reason: `${targetType} can only have ${targetRules.maxInputs} input(s)` };
    }
  }

  // Prevent self-connections
  if (connection.source === connection.target) {
    return { valid: false, reason: 'Cannot connect node to itself' };
  }

  return { valid: true };
}

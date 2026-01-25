import { AgentNode } from './AgentNode';
import { HumanGateNode } from './HumanGateNode';
import { CodeReviewNode } from './CodeReviewNode';

export const nodeTypes = {
  'agent': AgentNode,
  'human-gate': HumanGateNode,
  'code-review': CodeReviewNode,
};

export { AgentNode, HumanGateNode, CodeReviewNode };
export { BaseNode } from './BaseNode';

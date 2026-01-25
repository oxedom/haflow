import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  ReactFlowProvider,
  BackgroundVariant,
} from 'reactflow';
import { nodeTypes } from './nodes';
import { convertWorkflowToNodes } from '@/utils/workflowConverter';
import type { Workflow } from '@haflow/shared';
import { REACT_FLOW_CONFIG } from './config';
import type { WorkflowNode, ExecutionStatus } from '@/types/workflow';
import 'reactflow/dist/style.css';

interface WorkflowViewerProps {
  workflow: Workflow;
  executionStatus?: Record<string, ExecutionStatus>;
}

function WorkflowViewerInner({ workflow, executionStatus }: WorkflowViewerProps) {
  const { nodes, edges } = convertWorkflowToNodes(workflow);

  // Add execution status to node data
  const nodesWithStatus: WorkflowNode[] = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      executionStatus: executionStatus?.[node.id],
    },
  }));

  return (
    <div className="workflow-viewer h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-800">{workflow.name}</h2>
      </div>

      <div className="flex-1" data-testid="workflow-viewer-canvas">
        <ReactFlow
          nodes={nodesWithStatus}
          edges={edges}
          nodeTypes={nodeTypes}
          {...REACT_FLOW_CONFIG}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          fitView
        >
          <Controls showInteractive={false} />
          <MiniMap nodeStrokeWidth={3} pannable zoomable />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function WorkflowViewer(props: WorkflowViewerProps) {
  return (
    <ReactFlowProvider>
      <WorkflowViewerInner {...props} />
    </ReactFlowProvider>
  );
}

export { WorkflowViewer };

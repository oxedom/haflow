import { useCallback, useRef, useState, type DragEvent } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  ReactFlowProvider,
  BackgroundVariant,
} from 'reactflow';
import { nodeTypes } from './nodes';
import { useWorkflowState } from './hooks/useWorkflowState';
import { NodePalette } from './toolbar/NodePalette';
import { WorkflowToolbar } from './toolbar/WorkflowToolbar';
import { NodeConfigPanel } from './panels/NodeConfigPanel';
import { ValidationErrors } from './ValidationErrors';
import { REACT_FLOW_CONFIG, NODE_DIMENSIONS } from './config';
import type { NodeType, WorkflowNode, ValidationError } from '@/types/workflow';
import type { Workflow } from '@haflow/shared';
import { validateWorkflowForExecution } from '@/utils/workflowValidation';
import 'reactflow/dist/style.css';

interface WorkflowBuilderProps {
  initialWorkflow?: Workflow;
  onSave: (workflow: Workflow) => Promise<void>;
  onExecute: (workflow: Workflow) => Promise<void>;
}

function WorkflowBuilderInner({
  initialWorkflow,
  onSave,
  onExecute,
}: WorkflowBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const {
    nodes,
    edges,
    selectedNodeId,
    isDirty,
    workflowName,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeData,
    removeNode,
    setSelectedNodeId,
    clearWorkflow,
    updateWorkflowName,
    toWorkflow,
    markClean,
  } = useWorkflowState(initialWorkflow);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (!type || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - NODE_DIMENSIONS.width / 2,
        y: event.clientY - bounds.top - NODE_DIMENSIONS.height / 2,
      };

      addNode(type, position);
    },
    [addNode]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(toWorkflow());
      markClean();
      setValidationErrors([]);
    } catch (error) {
      console.error('Failed to save workflow:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecute = async () => {
    // Validate before execution
    const validation = validateWorkflowForExecution(
      nodes as WorkflowNode[],
      edges
    );

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors([]);
    setIsExecuting(true);
    try {
      await onExecute(toWorkflow());
    } catch (error) {
      console.error('Failed to execute workflow:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClear = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to clear the workflow?'
      );
      if (!confirmed) return;
    }
    clearWorkflow();
    setValidationErrors([]);
  };

  const handleErrorClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="workflow-builder h-full flex flex-col">
      <WorkflowToolbar
        workflowName={workflowName}
        isDirty={isDirty}
        onSave={handleSave}
        onExecute={handleExecute}
        onClear={handleClear}
        onNameChange={updateWorkflowName}
        isSaving={isSaving}
        isExecuting={isExecuting}
      />

      {validationErrors.length > 0 && (
        <ValidationErrors
          errors={validationErrors}
          onErrorClick={handleErrorClick}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        <NodePalette />

        <div
          className="flex-1 h-full"
          ref={reactFlowWrapper}
          data-testid="workflow-canvas"
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
            {...REACT_FLOW_CONFIG}
          >
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              pannable
              zoomable
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
            />
          </ReactFlow>
        </div>

        <NodeConfigPanel
          node={selectedNode?.data || null}
          nodeType={(selectedNode?.type as NodeType) || null}
          onUpdate={(data) =>
            selectedNodeId && updateNodeData(selectedNodeId, data)
          }
          onDelete={() => selectedNodeId && removeNode(selectedNodeId)}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>
    </div>
  );
}

export default function WorkflowBuilder(props: WorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}

export { WorkflowBuilder };

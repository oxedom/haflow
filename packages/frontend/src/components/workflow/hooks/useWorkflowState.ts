import { useState, useCallback } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from 'reactflow';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowStepWithStatus,
  NodeType,
} from '@/types/workflow';
import type { Workflow } from '@haflow/shared';
import {
  generateNodeId,
  generateEdgeId,
  createDefaultNodeData,
  convertNodesToWorkflow,
  convertWorkflowToNodes,
} from '@/utils/workflowConverter';
import { validateConnection } from '@/utils/connectionValidation';

export function useWorkflowState(initialWorkflow?: Workflow) {
  // Initialize from workflow if provided
  const initialState = initialWorkflow
    ? convertWorkflowToNodes(initialWorkflow)
    : { nodes: [], edges: [] };

  const [workflowMeta, setWorkflowMeta] = useState({
    workflowId: initialWorkflow?.workflow_id || generateNodeId(),
    name: initialWorkflow?.name || 'New Workflow',
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowStepWithStatus>(
    initialState.nodes as Node<WorkflowStepWithStatus>[]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialState.edges as Edge[]
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      // Mark dirty on any node change except selection
      const isOnlySelection = changes.every((c) => c.type === 'select');
      if (!isOnlySelection) {
        setIsDirty(true);
      }
    },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      // Mark dirty on any edge change except selection
      const isOnlySelection = changes.every((c) => c.type === 'select');
      if (!isOnlySelection) {
        setIsDirty(true);
      }
    },
    [onEdgesChange]
  );

  const addNode = useCallback(
    (type: NodeType, position: { x: number; y: number }) => {
      const newNode: WorkflowNode = {
        id: generateNodeId(),
        type,
        position,
        data: createDefaultNodeData(type),
      };
      setNodes((nds) => [...nds, newNode as Node<WorkflowStepWithStatus>]);
      setIsDirty(true);
      return newNode.id;
    },
    [setNodes]
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<WorkflowStepWithStatus>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        )
      );
      setIsDirty(true);
    },
    [setNodes]
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
      setIsDirty(true);
    },
    [setNodes, setEdges, selectedNodeId]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const workflowNodes = nodes as WorkflowNode[];
      const workflowEdges = edges as WorkflowEdge[];
      const validation = validateConnection(connection, workflowNodes, workflowEdges);

      if (validation.valid) {
        setEdges((eds) =>
          addEdge({ ...connection, id: generateEdgeId() }, eds)
        );
        setIsDirty(true);
      }
    },
    [setEdges, nodes, edges]
  );

  const clearWorkflow = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setWorkflowMeta({
      workflowId: generateNodeId(),
      name: 'New Workflow',
    });
    setIsDirty(false);
  }, [setNodes, setEdges]);

  const updateWorkflowName = useCallback((name: string) => {
    setWorkflowMeta((prev) => ({ ...prev, name }));
    setIsDirty(true);
  }, []);

  const toWorkflow = useCallback((): Workflow => {
    return convertNodesToWorkflow(
      workflowMeta.workflowId,
      workflowMeta.name,
      nodes as WorkflowNode[],
      edges as WorkflowEdge[]
    );
  }, [workflowMeta, nodes, edges]);

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  return {
    // State
    nodes: nodes as WorkflowNode[],
    edges: edges as WorkflowEdge[],
    selectedNodeId,
    isDirty,
    workflowName: workflowMeta.name,
    workflowId: workflowMeta.workflowId,

    // React Flow handlers
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect,

    // Actions
    addNode,
    updateNodeData,
    removeNode,
    setSelectedNodeId,
    clearWorkflow,
    updateWorkflowName,
    toWorkflow,
    markClean,
  };
}

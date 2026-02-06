'use client';

/**
 * IntegrationNetworkGraph Component
 * 
 * Main React Flow canvas showing forms, integrations, and workflows.
 * Visualizes the three-layer business process model:
 * 1. Forms (with baked-in operations)
 * 2. Triggers (form events)
 * 3. Workflows (automation)
 * 
 * STANDARDS:
 * - Fail-Safe: Shows helpful messages on empty/error states
 * - Extensible: Custom node/edge types registered separately
 */

import { useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useNetworkGraph } from './useNetworkGraph';
import { IntegrationNode } from './IntegrationNode';
import { FormNode } from './FormNode';
import { OperationNode } from './OperationNode';
import { AsyncGapNode } from './AsyncGapNode';
import { WorkflowEdge, EdgeMarkerDefs } from './WorkflowEdge';
import { TriggerEdge, TriggerEdgeMarkerDefs } from './TriggerEdge';
import { GraphSelectionPanel } from './GraphSelectionPanel';
import { RefreshCw, AlertTriangle } from 'lucide-react';

// Register custom node types
const nodeTypes: NodeTypes = {
  integration: IntegrationNode,
  form: FormNode,
  operation: OperationNode,
  asyncGap: AsyncGapNode,
};

// Register custom edge types
const edgeTypes: EdgeTypes = {
  workflow: WorkflowEdge,
  trigger: TriggerEdge,
};

interface IntegrationNetworkGraphProps {
  workspaceId: string;
}

export function IntegrationNetworkGraph({ workspaceId }: IntegrationNetworkGraphProps) {
  const {
    graph,
    nodes: initialNodes,
    edges: initialEdges,
    loading,
    error,
    selection,
    refresh,
    selectNode,
    selectEdge,
    selectForm,
    selectOperation,
    clearSelection,
  } = useNetworkGraph(workspaceId);

  // Use React Flow state hooks for draggable nodes
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Sync nodes/edges from hook when data changes
  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
    }
  }, [initialNodes, setNodes]);

  useEffect(() => {
    if (initialEdges.length > 0) {
      setEdges(initialEdges);
    }
  }, [initialEdges, setEdges]);

  // Handle node click
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'form') {
        selectForm(node.id);
      } else if (node.type === 'operation') {
        selectOperation(node.id);
      } else {
        selectNode(node.id);
      }
    },
    [selectNode, selectForm, selectOperation]
  );

  // Handle edge click
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      // Edge ID format is "workflowId-actionAdapter", extract workflow ID
      const workflowId = edge.data?.workflowId || edge.id.split('-')[0];
      selectEdge(workflowId);
    },
    [selectEdge]
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-180px)] min-h-[400px]">
        <RefreshCw className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-180px)] min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <div className="text-red-400">{error}</div>
          <button
            onClick={refresh}
            className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!graph || initialNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-180px)] min-h-[400px]">
        <div className="text-center text-zinc-500">
          <div className="text-lg mb-2">No workflows or forms configured</div>
          <div className="text-sm">Create a workflow or enable a form to see the business process graph</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-180px)] min-h-[400px] overflow-hidden">
      {/* SVG marker definitions */}
      <EdgeMarkerDefs />
      <TriggerEdgeMarkerDefs />
      
      {/* Header with stats */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-400">
            {graph.stats.enabledForms} forms, {graph.stats.enabledWorkflows} of {graph.stats.totalWorkflows} workflows active
          </span>
          {graph.stats.validWorkflows < graph.stats.totalWorkflows && (
            <span className="flex items-center gap-1 text-yellow-500">
              <AlertTriangle className="w-4 h-4" />
              {graph.stats.totalWorkflows - graph.stats.validWorkflows} need attention
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Warnings */}
      {graph.warnings.length > 0 && (
        <div className="absolute top-12 left-4 right-4 z-10 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
          <div className="flex items-center gap-2 text-yellow-500 text-xs">
            <AlertTriangle className="w-3 h-3" />
            {graph.warnings[0]}
            {graph.warnings.length > 1 && (
              <span className="text-yellow-500/60">+{graph.warnings.length - 1} more</span>
            )}
          </div>
        </div>
      )}

      {/* React Flow canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodesDraggable={true}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'workflow',
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#27272a" gap={20} />
        <MiniMap
          className="!bg-zinc-800 !border-zinc-700 !rounded-lg"
          nodeColor={(node) => {
            if (node.type === 'form') return '#8b5cf6'; // Purple for forms
            if (node.type === 'asyncGap') return '#71717a'; // Muted for gaps
            return node.data?.color || '#71717a';
          }}
          maskColor="rgba(0, 0, 0, 0.8)"
        />
      </ReactFlow>

      {/* Selection panel */}
      {selection && (
        <GraphSelectionPanel
          selection={selection}
          onClose={clearSelection}
          workspaceId={workspaceId}
          onWorkflowDeleted={refresh}
        />
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-500" />
          <span>Form</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-zinc-500" />
          <span>Inactive</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>Issues</span>
        </div>
      </div>
    </div>
  );
}

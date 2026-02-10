/**
 * useNetworkGraph Hook
 * 
 * Transforms the dependency-graph API response into React Flow nodes and edges.
 * Handles layout calculation, selection state, and data fetching.
 * 
 * Implements the three-layer business process model:
 * Forms → Operations (as individual nodes) → Triggers → Workflows
 * 
 * STANDARDS:
 * - Abstraction First: All graph logic encapsulated in this hook
 * - Fail-Safe: Returns empty arrays on error, never crashes
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import { getIntegrationStyle } from '@/app/_lib/workflow/integration-config';
import {
  DependencyGraph,
  FormNode as FormNodeType,
  NetworkNode,
  NetworkEdge,
  NetworkNodeData,
  NetworkEdgeData,
  FormNodeData,
  OperationNodeData,
  AsyncGapNodeData,
  Selection,
  WorkflowNode,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const COLUMN_GAP = 50; // Gap between columns (horizontal spacing between nodes)
const ROW_SPACING = 120;
const OP_NODE_HEIGHT = 70; // Approximate height of operation nodes
const OP_VERTICAL_GAP = 30; // Gap between vertically stacked operations
const OP_VERTICAL_SPACING = OP_NODE_HEIGHT + OP_VERTICAL_GAP; // Total spacing between operation node tops
const FORM_NODE_WIDTH = 220; // Width of form node (matches max-w-[220px])
const OP_NODE_WIDTH = 180; // Width of operation nodes (matches max-w-[180px])
const INTEGRATION_NODE_WIDTH = 180; // Width of integration nodes (matches max-w-[180px])
const GAP_NODE_WIDTH = 120; // Width of async gap node (matches max-w-[120px])

// Built-in adapters that don't require external integration
const BUILTIN_ADAPTERS = ['revline', 'capture'];

/** Ensure edge colors are visible on dark backgrounds */
function getVisibleEdgeColor(hex: string): string {
  // Parse hex to RGB and check relative luminance
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // If too dark for the dark background, use zinc-400
  return luminance < 0.3 ? '#a1a1aa' : hex;
}

// =============================================================================
// HOOK
// =============================================================================

export function useNetworkGraph(workspaceId: string) {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);

  // Fetch graph data
  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/dependency-graph`);
      if (response.ok) {
        const data = await response.json();
        setGraph(data.data?.graph || null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to load dependency graph');
      }
    } catch (err) {
      console.error('Failed to fetch dependency graph:', err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Transform graph data into React Flow format
  const { nodes, edges } = useMemo(() => {
    if (!graph) {
      return { nodes: [], edges: [] };
    }
    return buildNetworkGraph(graph);
  }, [graph]);

  // Handle node selection (integration)
  const selectNode = useCallback((integrationKey: string) => {
    if (!graph) return;
    
    const nodeData = nodes.find(n => n.id === integrationKey && n.type === 'integration')?.data as NetworkNodeData | undefined;
    if (!nodeData) return;

    // Find workflows using this integration
    const workflows = graph.workflows.filter(w => 
      w.trigger.adapter === integrationKey ||
      w.actions.some(a => a.adapter === integrationKey)
    );

    // Find forms using this integration
    const forms = graph.forms.filter(f => 
      f.operations.some(op => op.adapter === integrationKey)
    );

    setSelection({
      type: 'node',
      integrationKey,
      data: nodeData,
      workflows,
      forms,
      integration: graph.integrations[integrationKey] || null,
    });
  }, [graph, nodes]);

  // Handle edge selection (workflow)
  const selectEdge = useCallback((workflowId: string) => {
    if (!graph) return;

    const edge = edges.find(e => e.data?.workflowId === workflowId);
    const workflow = graph.workflows.find(w => w.id === workflowId);
    
    if (!edge?.data || !workflow) return;

    setSelection({
      type: 'edge',
      workflowId,
      data: edge.data as NetworkEdgeData,
      workflow,
    });
  }, [graph, edges]);

  // Handle form selection
  const selectForm = useCallback((formId: string) => {
    if (!graph) return;

    const formNode = nodes.find(n => n.id === formId && n.type === 'form');
    const form = graph.forms.find(f => f.id === formId);
    
    if (!formNode?.data || !form) return;

    // Find workflows listening to this form's triggers
    const formTriggerIds = form.triggers.map(t => t.id);
    const listeningWorkflows = graph.workflows.filter(w => 
      w.trigger.adapter === 'revline' && 
      formTriggerIds.includes(w.trigger.operation)
    );

    setSelection({
      type: 'form',
      formId,
      data: formNode.data as FormNodeData,
      form,
      listeningWorkflows,
    });
  }, [graph, nodes]);

  // Handle operation selection
  const selectOperation = useCallback((operationId: string) => {
    if (!graph) return;

    const opNode = nodes.find(n => n.id === operationId && n.type === 'operation');
    if (!opNode?.data) return;

    const opData = opNode.data as OperationNodeData;
    const form = graph.forms.find(f => f.id === opData.formId);
    
    if (!form) return;

    setSelection({
      type: 'operation',
      operationId,
      data: opData,
      form,
    });
  }, [graph, nodes]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  return {
    // Data
    graph,
    nodes,
    edges,
    // State
    loading,
    error,
    selection,
    // Actions
    refresh: fetchGraph,
    selectNode,
    selectEdge,
    selectForm,
    selectOperation,
    clearSelection,
  };
}

// =============================================================================
// GRAPH BUILDING
// =============================================================================

function buildNetworkGraph(graph: DependencyGraph): {
  nodes: (NetworkNode | Node<FormNodeData> | Node<OperationNodeData> | Node<AsyncGapNodeData>)[];
  edges: Edge[];
} {
  const nodes: (NetworkNode | Node<FormNodeData> | Node<OperationNodeData> | Node<AsyncGapNodeData>)[] = [];
  const edges: Edge[] = [];

  // 1. Build form nodes and their operation nodes (phase-based vertical stacking)
  const enabledForms = graph.forms.filter(f => f.enabled);
  
  // First pass: calculate per-form data and check if any form has a gap
  let anyHasGap = false;
  const formData = enabledForms.map(form => {
    const preOps = form.operations
      .map((op, idx) => ({ ...op, originalIndex: idx }))
      .filter(op => (op.phase ?? 'pre') === 'pre');
    const triggerOps = form.operations
      .map((op, idx) => ({ ...op, originalIndex: idx }))
      .filter(op => op.phase === 'trigger');
    const hasGap = preOps.length > 0 && triggerOps.length > 0;
    if (hasGap) anyHasGap = true;
    
    // Calculate this form's row height based on its actual ops
    const maxOpsInPhase = Math.max(preOps.length, triggerOps.length, 1);
    const rowHeight = Math.max((maxOpsInPhase - 1) * OP_VERTICAL_SPACING + OP_NODE_HEIGHT + 40, ROW_SPACING);
    
    return { form, preOps, triggerOps, hasGap, rowHeight };
  });
  
  // Column X positions:
  // Col 0: Forms
  // Col 1: Pre-phase ops (stacked vertically)
  // Col 2: Gap (if any form has both phases)
  // Col 3: Trigger-phase ops (stacked vertically)
  // Col 4+: Integrations
  // Calculate column X positions based on actual node widths + gaps
  const formColumnX = 0;
  const preOpsColumnX = FORM_NODE_WIDTH + COLUMN_GAP;
  const gapColumnX = preOpsColumnX + OP_NODE_WIDTH + COLUMN_GAP;
  const triggerOpsColumnX = anyHasGap 
    ? gapColumnX + GAP_NODE_WIDTH + COLUMN_GAP 
    : preOpsColumnX + OP_NODE_WIDTH + COLUMN_GAP;
  const integrationColumnStart = triggerOpsColumnX + OP_NODE_WIDTH + COLUMN_GAP; // Start integrations after trigger ops

  // Calculate cumulative Y positions for each form
  let currentY = 0;
  const formYPositions: number[] = [];
  formData.forEach(({ rowHeight }) => {
    formYPositions.push(currentY);
    currentY += rowHeight;
  });
  const totalFormsHeight = currentY;

  formData.forEach(({ form, preOps, triggerOps, hasGap, rowHeight }, formIndex) => {
    const formBaseY = formYPositions[formIndex];

    // Calculate pre-ops stack positioning first (we need this to align the form)
    const preStackHeight = preOps.length > 0 ? (preOps.length - 1) * OP_VERTICAL_SPACING + OP_NODE_HEIGHT : 0;
    const preStackStartY = formBaseY + (rowHeight - preStackHeight) / 2;
    
    // Calculate where the form should be positioned
    // Align form's center with the center of the pre-ops stack (or row center if no pre-ops)
    const FORM_HEIGHT = 100;
    let formY: number;
    if (preOps.length > 0) {
      // Align form center with pre-ops stack center
      const preStackCenterY = preStackStartY + preStackHeight / 2;
      formY = preStackCenterY - FORM_HEIGHT / 2;
    } else {
      // No pre-ops, center form in row
      formY = formBaseY + (rowHeight - FORM_HEIGHT) / 2;
    }

    // Create form node
    const formNodeData: FormNodeData = {
      formId: form.id,
      name: form.name,
      description: form.description,
      type: form.type,
      enabled: form.enabled,
      operations: form.operations,
      triggers: form.triggers,
      dependencies: form.dependencies.integrations,
    };

    nodes.push({
      id: form.id,
      type: 'form',
      position: { x: formColumnX, y: formY },
      data: formNodeData,
    });

    // Track the last node ID for horizontal connections
    let lastHorizontalNodeId = form.id;
    let lastHorizontalSourceHandle: string | undefined = undefined;

    // Create PRE phase operation nodes (stacked vertically)
    preOps.forEach((op, localIndex) => {
      const operationId = `${form.id}-op-${op.originalIndex}`;
      const opY = preStackStartY + localIndex * OP_VERTICAL_SPACING;

      const isFirst = localIndex === 0;
      const isLast = localIndex === preOps.length - 1;

      const operationNodeData: OperationNodeData = {
        operationId,
        formId: form.id,
        adapter: op.adapter,
        operation: op.operation,
        label: op.label,
        conditional: op.conditional,
        sequenceIndex: op.originalIndex,
        phase: 'pre',
        parallel: op.parallel,
        hasLeftConnection: isFirst, // First op gets horizontal in from form
        hasRightConnection: isLast, // Last op gets horizontal out to gap/trigger
        hasTopConnection: !isFirst, // Non-first ops get vertical in from above
        hasBottomConnection: !isLast, // Non-last ops get vertical out to below
      };

      nodes.push({
        id: operationId,
        type: 'operation',
        position: { x: preOpsColumnX, y: opY },
        data: operationNodeData,
      });

      const style = getIntegrationStyle(op.adapter);

      const edgeColor = getVisibleEdgeColor(style.color);

      if (isFirst) {
        // First op: horizontal edge from form
        edges.push({
          id: `${lastHorizontalNodeId}-to-${operationId}`,
          source: lastHorizontalNodeId,
          sourceHandle: lastHorizontalSourceHandle,
          target: operationId,
          targetHandle: 'left',
          type: 'default',
          animated: true,
          style: { stroke: edgeColor, strokeWidth: 2 },
        });
      } else {
        // Subsequent ops: vertical edge from op above
        const prevOpId = `${form.id}-op-${preOps[localIndex - 1].originalIndex}`;
        edges.push({
          id: `${prevOpId}-to-${operationId}`,
          source: prevOpId,
          sourceHandle: 'bottom',
          target: operationId,
          targetHandle: 'top',
          type: 'default',
          animated: true,
          style: { stroke: edgeColor, strokeWidth: 2 },
        });
      }
    });

    // Update last horizontal node to be the last pre op
    if (preOps.length > 0) {
      const lastPreOp = preOps[preOps.length - 1];
      lastHorizontalNodeId = `${form.id}-op-${lastPreOp.originalIndex}`;
      lastHorizontalSourceHandle = 'right';
    }

    // Create async gap node if needed - positioned at the center of pre-ops stack
    if (hasGap) {
      const gapId = `${form.id}-gap`;
      // Center gap vertically with the pre-ops stack middle
      const gapY = preStackStartY + (preStackHeight - OP_NODE_HEIGHT) / 2;

      const gapNodeData: AsyncGapNodeData = {
        formId: form.id,
        label: 'User action',
      };

      nodes.push({
        id: gapId,
        type: 'asyncGap',
        position: { x: gapColumnX, y: gapY },
        data: gapNodeData,
      });

      // Edge from last pre op to gap
      edges.push({
        id: `${lastHorizontalNodeId}-to-${gapId}`,
        source: lastHorizontalNodeId,
        sourceHandle: lastHorizontalSourceHandle,
        target: gapId,
        type: 'default',
        animated: false,
        style: { stroke: '#71717a', strokeWidth: 2, strokeDasharray: '5,5' },
      });

      lastHorizontalNodeId = gapId;
      lastHorizontalSourceHandle = undefined;
    }

    // Calculate trigger-ops stack positioning
    const triggerStackHeight = triggerOps.length > 0 ? (triggerOps.length - 1) * OP_VERTICAL_SPACING + OP_NODE_HEIGHT : 0;
    const triggerStackStartY = formBaseY + (rowHeight - triggerStackHeight) / 2;

    // Create TRIGGER phase operation nodes (stacked vertically)
    triggerOps.forEach((op, localIndex) => {
      const operationId = `${form.id}-op-${op.originalIndex}`;
      const opY = triggerStackStartY + localIndex * OP_VERTICAL_SPACING;

      const isFirst = localIndex === 0;
      const isLast = localIndex === triggerOps.length - 1;

      const operationNodeData: OperationNodeData = {
        operationId,
        formId: form.id,
        adapter: op.adapter,
        operation: op.operation,
        label: op.label,
        conditional: op.conditional,
        sequenceIndex: op.originalIndex,
        phase: 'trigger',
        parallel: op.parallel,
        hasLeftConnection: isFirst, // First op gets horizontal in from gap/form
        hasRightConnection: isLast, // Last op gets horizontal out to revline
        hasTopConnection: !isFirst, // Non-first ops get vertical in from above
        hasBottomConnection: !isLast, // Non-last ops get vertical out to below
      };

      nodes.push({
        id: operationId,
        type: 'operation',
        position: { x: triggerOpsColumnX, y: opY },
        data: operationNodeData,
      });

      const style = getIntegrationStyle(op.adapter);
      const edgeColor = getVisibleEdgeColor(style.color);

      if (isFirst) {
        // First op: horizontal edge from gap (or form if no pre ops)
        edges.push({
          id: `${lastHorizontalNodeId}-to-${operationId}`,
          source: lastHorizontalNodeId,
          sourceHandle: lastHorizontalSourceHandle,
          target: operationId,
          targetHandle: 'left',
          type: 'default',
          animated: true,
          style: { stroke: edgeColor, strokeWidth: 2 },
        });
      } else {
        // Subsequent ops: vertical edge from op above
        const prevOpId = `${form.id}-op-${triggerOps[localIndex - 1].originalIndex}`;
        edges.push({
          id: `${prevOpId}-to-${operationId}`,
          source: prevOpId,
          sourceHandle: 'bottom',
          target: operationId,
          targetHandle: 'top',
          type: 'default',
          animated: true,
          style: { stroke: edgeColor, strokeWidth: 2 },
        });
      }
    });

    // Update last horizontal node to be the last trigger op
    if (triggerOps.length > 0) {
      const lastTriggerOp = triggerOps[triggerOps.length - 1];
      lastHorizontalNodeId = `${form.id}-op-${lastTriggerOp.originalIndex}`;
      lastHorizontalSourceHandle = 'right';
    }

    // Create edge from last node to revline (if form has triggers)
    if (form.triggers.length > 0) {
      edges.push({
        id: `${lastHorizontalNodeId}-to-revline`,
        source: lastHorizontalNodeId,
        sourceHandle: lastHorizontalSourceHandle,
        target: 'revline',
        type: 'trigger',
        animated: true,
        data: {
          triggerLabels: form.triggers.map(t => t.label).join(', '),
          formName: form.name,
        },
      });
    }
  });

  // 2. Collect all unique integrations used by workflows
  const usedIntegrations = new Set<string>();
  
  for (const workflow of graph.workflows) {
    usedIntegrations.add(workflow.trigger.adapter);
    for (const action of workflow.actions) {
      usedIntegrations.add(action.adapter);
    }
  }

  // 3. Categorize integrations by their role in workflows
  const triggerOnly: string[] = [];
  const actionOnly: string[] = [];
  const bidirectional: string[] = [];

  for (const key of usedIntegrations) {
    const isTrigger = graph.workflows.some(w => w.trigger.adapter === key);
    const isAction = graph.workflows.some(w => w.actions.some(a => a.adapter === key));

    if (isTrigger && isAction) {
      bidirectional.push(key);
    } else if (isTrigger) {
      triggerOnly.push(key);
    } else {
      actionOnly.push(key);
    }
  }

  // 4. Calculate positions for integration nodes
  // Use totalFormsHeight calculated during form layout
  const positions = calculateIntegrationPositions(
    triggerOnly, 
    bidirectional, 
    actionOnly, 
    integrationColumnStart,
    totalFormsHeight
  );

  // 5. Build integration nodes
  for (const key of usedIntegrations) {
    const integration = graph.integrations[key];
    const style = getIntegrationStyle(key);
    const isBuiltin = BUILTIN_ADAPTERS.includes(key);
    
    // Count how many workflows use this as trigger vs action
    const triggerCount = graph.workflows.filter(w => w.trigger.adapter === key).length;
    const actionCount = graph.workflows.filter(w => 
      w.actions.some(a => a.adapter === key)
    ).length;

    const nodeData: NetworkNodeData = {
      integrationKey: key,
      name: style.name,
      color: style.color,
      configured: isBuiltin || (integration?.configured ?? false),
      healthy: isBuiltin || (integration?.healthy ?? false),
      healthStatus: isBuiltin ? 'GREEN' : (integration?.healthStatus ?? null),
      triggerCount,
      actionCount,
    };

    nodes.push({
      id: key,
      type: 'integration',
      position: positions.get(key) || { x: integrationColumnStart, y: 0 },
      data: nodeData,
    });
  }

  // 6. Build edges from workflows
  for (const workflow of graph.workflows) {
    // Get unique action adapters
    const actionAdapters = [...new Set(workflow.actions.map(a => a.adapter))];
    
    // Create an edge from trigger to each unique action adapter
    for (const actionAdapter of actionAdapters) {
      const edgeData: NetworkEdgeData = {
        workflowId: workflow.id,
        workflowName: workflow.name,
        enabled: workflow.enabled,
        canEnable: workflow.canEnable,
        errors: workflow.validationErrors,
        warnings: workflow.validationWarnings,
        actionCount: workflow.actions.length,
        actionAdapters,
        triggerOperation: workflow.trigger.operation,
      };

      edges.push({
        id: `${workflow.id}-${actionAdapter}`,
        source: workflow.trigger.adapter,
        target: actionAdapter,
        type: 'workflow',
        data: edgeData,
        animated: workflow.enabled,
      });
    }
  }

  return { nodes, edges };
}

// =============================================================================
// LAYOUT CALCULATION
// =============================================================================

function calculateIntegrationPositions(
  triggerOnly: string[],
  bidirectional: string[],
  actionOnly: string[],
  xOffset: number,
  formsHeight: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Spacing between integration columns (node width + gap)
  const integrationColumnSpacing = INTEGRATION_NODE_WIDTH + COLUMN_GAP;

  // All integration nodes share one vertical space anchored to the forms area.
  // Stack all categories into a single vertical list per column, centered
  // within the forms height so nothing floats above/below the main graph.

  const allCategories = [
    { keys: triggerOnly, col: 0 },
    { keys: bidirectional, col: 1 },
    { keys: actionOnly, col: 2 },
  ];

  for (const { keys, col } of allCategories) {
    if (keys.length === 0) continue;
    const stackHeight = keys.length * ROW_SPACING;
    // Clamp vertical start: center within forms height, but never go negative
    const startY = Math.max(0, (formsHeight - stackHeight) / 2);
    keys.forEach((key, index) => {
      positions.set(key, {
        x: xOffset + integrationColumnSpacing * col,
        y: startY + index * ROW_SPACING,
      });
    });
  }

  return positions;
}

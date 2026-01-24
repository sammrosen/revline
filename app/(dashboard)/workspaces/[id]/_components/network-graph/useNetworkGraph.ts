/**
 * useNetworkGraph Hook
 * 
 * Transforms the dependency-graph API response into React Flow nodes and edges.
 * Handles layout calculation, selection state, and data fetching.
 * 
 * STANDARDS:
 * - Abstraction First: All graph logic encapsulated in this hook
 * - Fail-Safe: Returns empty arrays on error, never crashes
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getIntegrationStyle } from '@/app/_lib/workflow/integration-config';
import {
  DependencyGraph,
  NetworkNode,
  NetworkEdge,
  NetworkNodeData,
  NetworkEdgeData,
  Selection,
  WorkflowNode,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const COLUMN_SPACING = 350;
const ROW_SPACING = 120;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

// Built-in adapters that don't require external integration
const BUILTIN_ADAPTERS = ['revline', 'capture'];

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

  // Handle node selection
  const selectNode = useCallback((integrationKey: string) => {
    if (!graph) return;
    
    const nodeData = nodes.find(n => n.id === integrationKey)?.data;
    if (!nodeData) return;

    const workflows = graph.workflows.filter(w => 
      w.trigger.adapter === integrationKey ||
      w.actions.some(a => a.adapter === integrationKey)
    );

    setSelection({
      type: 'node',
      integrationKey,
      data: nodeData,
      workflows,
      integration: graph.integrations[integrationKey] || null,
    });
  }, [graph, nodes]);

  // Handle edge selection
  const selectEdge = useCallback((workflowId: string) => {
    if (!graph) return;

    const edge = edges.find(e => e.id === workflowId);
    const workflow = graph.workflows.find(w => w.id === workflowId);
    
    if (!edge?.data || !workflow) return;

    setSelection({
      type: 'edge',
      workflowId,
      data: edge.data,
      workflow,
    });
  }, [graph, edges]);

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
    clearSelection,
  };
}

// =============================================================================
// GRAPH BUILDING
// =============================================================================

function buildNetworkGraph(graph: DependencyGraph): {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
} {
  // 1. Collect all unique integrations that are actually used
  const usedIntegrations = new Set<string>();
  
  for (const workflow of graph.workflows) {
    usedIntegrations.add(workflow.trigger.adapter);
    for (const action of workflow.actions) {
      usedIntegrations.add(action.adapter);
    }
  }

  // 2. Categorize integrations by their role
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

  // 3. Calculate positions (3-column layout)
  const positions = calculatePositions(triggerOnly, bidirectional, actionOnly);

  // 4. Build nodes
  const nodes: NetworkNode[] = [];
  
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
      triggerCount,
      actionCount,
    };

    nodes.push({
      id: key,
      type: 'integration',
      position: positions.get(key) || { x: 0, y: 0 },
      data: nodeData,
    });
  }

  // 5. Build edges (one per workflow)
  const edges: NetworkEdge[] = [];
  
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
        // Animated if enabled
        animated: workflow.enabled,
      });
    }
  }

  return { nodes, edges };
}

// =============================================================================
// LAYOUT CALCULATION
// =============================================================================

function calculatePositions(
  triggerOnly: string[],
  bidirectional: string[],
  actionOnly: string[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Calculate total height needed
  const maxItems = Math.max(triggerOnly.length, bidirectional.length, actionOnly.length, 1);
  const totalHeight = maxItems * ROW_SPACING;

  // Position trigger-only (left column)
  const triggerStartY = (totalHeight - triggerOnly.length * ROW_SPACING) / 2;
  triggerOnly.forEach((key, index) => {
    positions.set(key, {
      x: 0,
      y: triggerStartY + index * ROW_SPACING,
    });
  });

  // Position bidirectional (center column)
  const bidirectionalStartY = (totalHeight - bidirectional.length * ROW_SPACING) / 2;
  bidirectional.forEach((key, index) => {
    positions.set(key, {
      x: COLUMN_SPACING,
      y: bidirectionalStartY + index * ROW_SPACING,
    });
  });

  // Position action-only (right column)
  const actionStartY = (totalHeight - actionOnly.length * ROW_SPACING) / 2;
  actionOnly.forEach((key, index) => {
    positions.set(key, {
      x: COLUMN_SPACING * 2,
      y: actionStartY + index * ROW_SPACING,
    });
  });

  return positions;
}

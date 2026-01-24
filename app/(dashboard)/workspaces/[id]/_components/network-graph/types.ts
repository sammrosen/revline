/**
 * Network Graph Types
 * 
 * Type definitions for the React Flow integration network graph.
 * Transforms the dependency-graph API response into React Flow format.
 */

import { Node, Edge } from 'reactflow';

// =============================================================================
// API TYPES (from dependency-graph endpoint)
// =============================================================================

export interface IntegrationNode {
  type: string;
  configured: boolean;
  healthy: boolean;
  healthStatus: string | null;
  secretNames: string[];
  metaKeys: string[];
  usedBy: Array<{
    workflowId: string;
    workflowName: string;
    asTrigger: boolean;
    asAction: boolean;
    operations: string[];
  }>;
}

export interface WorkflowNode {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  canEnable: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  trigger: {
    adapter: string;
    adapterName: string;
    operation: string;
  };
  actions: Array<{
    adapter: string;
    adapterName: string;
    operation: string;
    params: Record<string, unknown>;
  }>;
  dependencies: {
    integrations: string[];
    metaReferences: Array<{
      adapter: string;
      path: string;
      param: string;
      value: string;
    }>;
  };
}

export interface DependencyGraph {
  integrations: Record<string, IntegrationNode>;
  workflows: WorkflowNode[];
  warnings: string[];
  stats: {
    totalWorkflows: number;
    enabledWorkflows: number;
    validWorkflows: number;
    configuredIntegrations: number;
    healthyIntegrations: number;
  };
}

// =============================================================================
// REACT FLOW TYPES
// =============================================================================

export interface NetworkNodeData {
  /** Integration key (e.g., 'calendly') */
  integrationKey: string;
  /** Display name */
  name: string;
  /** Brand color */
  color: string;
  /** Whether integration is configured */
  configured: boolean;
  /** Whether integration is healthy */
  healthy: boolean;
  /** Number of workflows where this is the trigger */
  triggerCount: number;
  /** Number of workflows where this is an action */
  actionCount: number;
  /** Whether this node is currently selected */
  selected?: boolean;
}

export interface NetworkEdgeData {
  /** Workflow ID */
  workflowId: string;
  /** Workflow name */
  workflowName: string;
  /** Whether workflow is enabled */
  enabled: boolean;
  /** Whether workflow can be enabled */
  canEnable: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Total number of actions in the workflow */
  actionCount: number;
  /** All action adapters (for tooltip) */
  actionAdapters: string[];
  /** Trigger operation name */
  triggerOperation: string;
}

export type NetworkNode = Node<NetworkNodeData>;
export type NetworkEdge = Edge<NetworkEdgeData>;

// =============================================================================
// SELECTION STATE
// =============================================================================

export type SelectionType = 'node' | 'edge' | null;

export interface NodeSelection {
  type: 'node';
  integrationKey: string;
  data: NetworkNodeData;
  workflows: WorkflowNode[];
  integration: IntegrationNode | null;
}

export interface EdgeSelection {
  type: 'edge';
  workflowId: string;
  data: NetworkEdgeData;
  workflow: WorkflowNode;
}

export type Selection = NodeSelection | EdgeSelection | null;

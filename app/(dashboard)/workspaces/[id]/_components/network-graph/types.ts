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

export interface IntegrationUsage {
  type: 'workflow' | 'form';
  id: string;
  name: string;
  enabled: boolean;
  asTrigger: boolean;
  asAction: boolean;
  operations: string[];
}

export interface IntegrationNode {
  type: string;
  configured: boolean;
  healthy: boolean;
  healthStatus: string | null;
  secretNames: string[];
  metaKeys: string[];
  usedBy: IntegrationUsage[];
}

export interface FormNode {
  id: string;
  name: string;
  description: string;
  type: string;
  path: string;
  enabled: boolean;
  operations: Array<{
    adapter: string;
    operation: string;
    label?: string;
    conditional?: boolean;
    phase?: 'pre' | 'trigger';
    parallel?: boolean;
  }>;
  triggers: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  dependencies: {
    integrations: string[];
  };
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
  forms: FormNode[];
  integrations: Record<string, IntegrationNode>;
  workflows: WorkflowNode[];
  warnings: string[];
  stats: {
    totalForms: number;
    enabledForms: number;
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

export interface FormNodeData {
  /** Form ID */
  formId: string;
  /** Display name */
  name: string;
  /** Form description */
  description: string;
  /** Form type (booking, signup, etc.) */
  type: string;
  /** Whether form is enabled for this workspace */
  enabled: boolean;
  /** Baked-in operations this form performs */
  operations: Array<{
    adapter: string;
    operation: string;
    label?: string;
    conditional?: boolean;
    phase?: 'pre' | 'trigger';
    parallel?: boolean;
  }>;
  /** Triggers this form can emit */
  triggers: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  /** Integration dependencies */
  dependencies: string[];
  /** Whether this node is currently selected */
  selected?: boolean;
}

export interface OperationNodeData {
  /** Unique ID for this operation node */
  operationId: string;
  /** Parent form ID */
  formId: string;
  /** Adapter that performs this operation */
  adapter: string;
  /** Operation name */
  operation: string;
  /** Human-readable label */
  label?: string;
  /** Whether this is conditional */
  conditional?: boolean;
  /** Position in the operation sequence (0-indexed) */
  sequenceIndex: number;
  /** Phase: 'pre' (before async gap) or 'trigger' (when trigger fires) */
  phase: 'pre' | 'trigger';
  /** Whether this operation runs in parallel with others */
  parallel?: boolean;
}

export interface AsyncGapNodeData {
  /** Parent form ID */
  formId: string;
  /** Label to display */
  label: string;
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
export type FormNetworkNode = Node<FormNodeData>;
export type OperationNetworkNode = Node<OperationNodeData>;
export type AsyncGapNetworkNode = Node<AsyncGapNodeData>;
export type NetworkEdge = Edge<NetworkEdgeData>;

// =============================================================================
// SELECTION STATE
// =============================================================================

export type SelectionType = 'node' | 'edge' | 'form' | 'operation' | null;

export interface NodeSelection {
  type: 'node';
  integrationKey: string;
  data: NetworkNodeData;
  workflows: WorkflowNode[];
  forms: FormNode[];
  integration: IntegrationNode | null;
}

export interface EdgeSelection {
  type: 'edge';
  workflowId: string;
  data: NetworkEdgeData;
  workflow: WorkflowNode;
}

export interface FormSelection {
  type: 'form';
  formId: string;
  data: FormNodeData;
  form: FormNode;
  listeningWorkflows: WorkflowNode[];
}

export interface OperationSelection {
  type: 'operation';
  operationId: string;
  data: OperationNodeData;
  form: FormNode;
}

export type Selection = NodeSelection | EdgeSelection | FormSelection | OperationSelection | null;

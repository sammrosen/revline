'use client';

/**
 * DependencyTree Component
 * 
 * Network graph visualization of integrations and workflows.
 * Shows integrations as nodes and workflows as edges connecting them.
 * 
 * STANDARDS:
 * - Abstraction First: Graph logic in useNetworkGraph hook
 * - Fail-Safe: Graceful empty/error states
 */

import { IntegrationNetworkGraph } from './network-graph';

export interface DependencyTreeProps {
  workspaceId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DependencyTree({ workspaceId }: DependencyTreeProps) {
  return <IntegrationNetworkGraph workspaceId={workspaceId} />;
}

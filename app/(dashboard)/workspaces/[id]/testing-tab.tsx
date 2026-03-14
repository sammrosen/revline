'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, Play, ChevronDown, AlertCircle, CheckCircle, Search, X, ChevronUp, Plus, Zap, ChevronRight, MessageSquare } from 'lucide-react';
import { TestingChatPanel } from './testing-chat-panel';

interface KnownEndpoint {
  method: string;
  path: string;
  description: string;
}

interface AvailableIntegration {
  id: string;
  type: string;
  healthStatus: string;
  knownEndpoints: KnownEndpoint[];
}

interface TestResult {
  success: boolean;
  status: number;
  data: unknown;
  duration_ms: number;
  error?: string;
}

interface TestingTabProps {
  workspaceId: string;
}

interface TestPanelProps {
  workspaceId: string;
  integrations: AvailableIntegration[];
  compact?: boolean;
  onClose?: () => void;
}

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'datetime-local';
  placeholder?: string;
}

interface EndpointForm {
  fields: FormField[];
}

/**
 * Form schemas for endpoints that need structured input
 * For GET endpoints, these become query parameters
 * For POST/PUT endpoints, these become the request body
 */
const ENDPOINT_FORMS: Record<string, EndpointForm> = {
  'GET:/employees': {
    fields: [
      { name: 'firstName', label: 'First Name', type: 'text', placeholder: 'Filter by first name (optional)' },
      { name: 'lastName', label: 'Last Name', type: 'text', placeholder: 'Filter by last name (optional)' },
      { name: 'employeeStatus', label: 'Status', type: 'text', placeholder: 'Active, Inactive (optional)' },
    ],
  },
  'POST:/calendars/events': {
    fields: [
      { name: 'employeeId', label: 'Employee ID', type: 'text', placeholder: 'Employee/trainer ID' },
      { name: 'eventTypeId', label: 'Event Type ID', type: 'text', placeholder: 'Event type ID' },
      { name: 'levelId', label: 'Level ID', type: 'text', placeholder: 'Training level ID' },
      { name: 'startTime', label: 'Start Time', type: 'datetime-local' },
      { name: 'memberId', label: 'Member ID', type: 'text', placeholder: 'Member ID' },
    ],
  },
};

/**
 * Extract path parameters from an endpoint path
 * e.g., "/members/{memberId}/appointments" -> ["memberId"]
 */
function extractPathParams(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1, -1));
}

/**
 * Replace path parameters with actual values
 * e.g., "/members/{memberId}/appointments", { memberId: "123" } -> "/members/123/appointments"
 */
function replacePathParams(path: string, params: Record<string, string>): string {
  let result = path;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, value);
  }
  return result;
}

/**
 * Convert datetime-local value to API format (YYYY-MM-DD HH:mm:ss)
 */
function formatDateTimeForApi(value: string): string {
  if (!value) return '';
  // datetime-local gives us "2024-01-20T10:30", we need "2024-01-20 10:30:00"
  return value.replace('T', ' ') + ':00';
}

/**
 * Individual test panel component - manages its own request/response state
 */
function TestPanel({ workspaceId, integrations, compact = false, onClose }: TestPanelProps) {
  // Request state
  const [selectedIntegration, setSelectedIntegration] = useState<string>(integrations[0]?.type || '');
  const [method, setMethod] = useState<string>('GET');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('custom');
  const [customEndpoint, setCustomEndpoint] = useState<string>('');
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState<string>('');
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const preRef = useRef<HTMLPreElement>(null);

  // Get current integration's endpoints
  const currentIntegration = integrations.find(i => i.type === selectedIntegration);
  const knownEndpoints = currentIntegration?.knownEndpoints || [];

  // Get the current endpoint path
  const currentEndpointPath = selectedEndpoint === 'custom' 
    ? customEndpoint 
    : knownEndpoints.find(e => `${e.method}:${e.path}` === selectedEndpoint)?.path || '';

  // Panel sub-tab
  const [panelMode, setPanelMode] = useState<'endpoints' | 'scenarios' | 'chats'>('endpoints');

  // Check if current endpoint has a form schema
  const endpointKey = `${method}:${currentEndpointPath}`;
  const formSchema = ENDPOINT_FORMS[endpointKey];

  // Extract and track path params when endpoint changes
  useEffect(() => {
    const params = extractPathParams(currentEndpointPath);
    setPathParams(prev => {
      const newParams: Record<string, string> = {};
      for (const param of params) {
        newParams[param] = prev[param] || '';
      }
      return newParams;
    });
  }, [currentEndpointPath]);

  // Reset form data when endpoint changes
  useEffect(() => {
    if (formSchema) {
      setFormData({});
    }
  }, [endpointKey, formSchema]);

  // When selecting a known endpoint, also set the method
  const handleEndpointSelect = (value: string) => {
    setSelectedEndpoint(value);
    if (value !== 'custom') {
      const endpoint = knownEndpoints.find(e => `${e.method}:${e.path}` === value);
      if (endpoint) {
        setMethod(endpoint.method);
      }
    }
  };

  // Validate JSON body
  const validateBody = (value: string) => {
    setRequestBody(value);
    if (!value.trim()) {
      setBodyError(null);
      return;
    }
    try {
      JSON.parse(value);
      setBodyError(null);
    } catch {
      setBodyError('Invalid JSON');
    }
  };

  // Execute the test request
  const executeRequest = async () => {
    setIsExecuting(true);
    setResult(null);
    setExecutionError(null);

    try {
      // Build the final endpoint with path params replaced
      let finalEndpoint = replacePathParams(currentEndpointPath, pathParams);

      // Build request body or query params
      let body: unknown = undefined;
      
      if (method === 'GET' && formSchema) {
        // For GET requests with form schema, add as query parameters
        const queryParams = new URLSearchParams();
        for (const field of formSchema.fields) {
          const value = formData[field.name]?.trim();
          if (value) {
            queryParams.append(field.name, value);
          }
        }
        const queryString = queryParams.toString();
        if (queryString) {
          finalEndpoint += (finalEndpoint.includes('?') ? '&' : '?') + queryString;
        }
      } else if (['POST', 'PUT', 'PATCH'].includes(method)) {
        if (formSchema) {
          // Convert form data to body, handling datetime formatting
          const processedData: Record<string, string> = {};
          for (const field of formSchema.fields) {
            const value = formData[field.name] || '';
            if (field.type === 'datetime-local' && value) {
              processedData[field.name] = formatDateTimeForApi(value);
            } else if (value) {
              processedData[field.name] = value;
            }
          }
          body = processedData;
        } else if (requestBody.trim()) {
          try {
            body = JSON.parse(requestBody);
          } catch {
            setExecutionError('Invalid JSON body');
            setIsExecuting(false);
            return;
          }
        }
      }

      const response = await fetch(`/api/v1/workspaces/${workspaceId}/test-integration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration: selectedIntegration,
          method,
          endpoint: finalEndpoint,
          body,
        }),
      });

      const data = await response.json();

      if (!response.ok && !data.status) {
        throw new Error(data.error || 'Request failed');
      }

      setResult(data);
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsExecuting(false);
    }
  };

  // Check if we can execute
  const canExecute = selectedIntegration && currentEndpointPath && !bodyError && !isExecuting;

  // Get path params for current endpoint
  const currentPathParams = extractPathParams(currentEndpointPath);

  // Format JSON and count search matches
  const { formattedJson, matchCount } = useMemo(() => {
    if (!result?.data) return { formattedJson: '', matchCount: 0 };
    
    const json = JSON.stringify(result.data, null, 2);
    if (!searchTerm.trim()) {
      return { formattedJson: json, matchCount: 0 };
    }
    
    // Count matches (case-insensitive)
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = json.match(regex);
    return { formattedJson: json, matchCount: matches?.length || 0 };
  }, [result?.data, searchTerm]);

  // Reset current match index when search term changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchTerm]);

  // Scroll to current match when navigating
  useEffect(() => {
    if (matchCount > 0 && preRef.current) {
      const currentMark = preRef.current.querySelector(`[data-match-index="${currentMatchIndex}"]`);
      if (currentMark) {
        currentMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentMatchIndex, matchCount]);

  // Navigate to next/previous match
  const goToNextMatch = useCallback(() => {
    setCurrentMatchIndex(prev => (prev + 1) % matchCount);
  }, [matchCount]);

  const goToPrevMatch = useCallback(() => {
    setCurrentMatchIndex(prev => (prev - 1 + matchCount) % matchCount);
  }, [matchCount]);

  // Render JSON with highlighted search matches
  const renderHighlightedJson = useCallback((json: string, term: string, currentIdx: number) => {
    if (!term.trim()) return json;
    
    // Escape special regex characters in search term
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    const parts = json.split(regex);
    
    let matchIndex = 0;
    return parts.map((part, index) => {
      if (part.toLowerCase() === term.toLowerCase()) {
        const isCurrentMatch = matchIndex === currentIdx;
        const thisMatchIndex = matchIndex;
        matchIndex++;
        return (
          <mark 
            key={index} 
            data-match-index={thisMatchIndex}
            className={`rounded px-0.5 ${
              isCurrentMatch 
                ? 'bg-orange-500/70 text-orange-100 ring-2 ring-orange-400' 
                : 'bg-yellow-500/40 text-yellow-200'
            }`}
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  }, []);

  return (
    <div className="space-y-4 bg-zinc-950/50 border border-zinc-800 rounded-lg p-3">
      {/* Panel Header with Close Button */}
      {onClose && (
        <div className="flex justify-end -mt-1 -mr-1">
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Integration Selection (hidden for Chats mode) */}
      {panelMode !== 'chats' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Integration
          </label>
          <div className="relative">
            <select
              value={selectedIntegration}
              onChange={(e) => {
                setSelectedIntegration(e.target.value);
                setSelectedEndpoint('custom');
                setCustomEndpoint('');
                setResult(null);
                setFormData({});
              }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-zinc-600"
            >
              {integrations.map(int => (
                <option key={int.id} value={int.type}>
                  {int.type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Sub-tabs: Endpoints | Scenarios | Chats */}
      <div className="flex border-b border-zinc-800">
        <button
          type="button"
          onClick={() => setPanelMode('endpoints')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
            panelMode === 'endpoints'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Play className="w-3 h-3" />
          Endpoints
        </button>
        <button
          type="button"
          onClick={() => setPanelMode('scenarios')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
            panelMode === 'scenarios'
              ? 'border-amber-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Zap className="w-3 h-3" />
          Scenarios
        </button>
        <button
          type="button"
          onClick={() => setPanelMode('chats')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
            panelMode === 'chats'
              ? 'border-violet-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <MessageSquare className="w-3 h-3" />
          Chats
        </button>
      </div>

      {/* === ENDPOINTS TAB === */}
      {panelMode === 'endpoints' && (
        <>
          {/* Endpoint Selection */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Endpoint
              </label>
              <div className="flex gap-2">
                {/* Method selector */}
                <div className="relative">
                  <select
                    value={method}
                    onChange={(e) => {
                      setMethod(e.target.value);
                      setSelectedEndpoint('custom');
                      setFormData({});
                    }}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-sm text-white appearance-none focus:outline-none focus:border-zinc-600 pr-7"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                </div>

                {/* Endpoint selector */}
                <div className="relative flex-1">
                  <select
                    value={selectedEndpoint}
                    onChange={(e) => handleEndpointSelect(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-zinc-600"
                  >
                    <option value="custom">Custom...</option>
                    {knownEndpoints
                      .filter(ep => ep.method === method)
                      .map(ep => (
                        <option key={`${ep.method}:${ep.path}`} value={`${ep.method}:${ep.path}`}>
                          {compact ? ep.path.slice(0, 25) + (ep.path.length > 25 ? '...' : '') : `${ep.path} - ${ep.description}`}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Custom endpoint input */}
            {selectedEndpoint === 'custom' && (
              <div>
                <input
                  type="text"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  placeholder="/endpoint/path"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-mono"
                />
              </div>
            )}

            {/* Path Parameters */}
            {currentPathParams.length > 0 && (
              <div className="space-y-1.5">
                {currentPathParams.map(param => (
                  <div key={param} className="flex items-center gap-2">
                    <label className="text-xs text-zinc-400 w-24 font-mono truncate">{param}:</label>
                    <input
                      type="text"
                      value={pathParams[param] || ''}
                      onChange={(e) => setPathParams(prev => ({ ...prev, [param]: e.target.value }))}
                      placeholder={param}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Form Fields for GET (query params) */}
            {method === 'GET' && formSchema && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-400">
                  Query Parameters (optional)
                </label>
                {formSchema.fields.map(field => (
                  <div key={field.name} className="flex items-center gap-2">
                    <label className="text-xs text-zinc-400 w-24 truncate" title={field.label}>
                      {field.label}:
                    </label>
                    <input
                      type={field.type}
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Form Fields or JSON Body for POST/PUT/PATCH */}
            {['POST', 'PUT', 'PATCH'].includes(method) && (
              formSchema ? (
                // Render form fields
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-zinc-400">
                    Request Body
                  </label>
                  {formSchema.fields.map(field => (
                    <div key={field.name} className="flex items-center gap-2">
                      <label className="text-xs text-zinc-400 w-24 truncate" title={field.label}>
                        {field.label}:
                      </label>
                      <input
                        type={field.type}
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                // Render JSON textarea
                <div>
                  <textarea
                    value={requestBody}
                    onChange={(e) => validateBody(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={compact ? 3 : 5}
                    className={`w-full bg-zinc-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none font-mono ${
                      bodyError ? 'border-red-500' : 'border-zinc-700 focus:border-zinc-600'
                    }`}
                  />
                  {bodyError && (
                    <p className="text-xs text-red-400 mt-1">{bodyError}</p>
                  )}
                </div>
              )
            )}

            {/* Execute Button */}
            <button
              onClick={executeRequest}
              disabled={!canExecute}
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Send
                </>
              )}
            </button>
          </div>

          {/* Execution Error */}
          {executionError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400">
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{executionError}</span>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              {/* Result Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className={`font-mono text-sm ${
                    result.status >= 200 && result.status < 300 ? 'text-green-400' :
                    result.status >= 400 && result.status < 500 ? 'text-yellow-400' :
                    result.status >= 500 ? 'text-red-400' : 'text-zinc-400'
                  }`}>
                    {result.status || 'Error'}
                  </span>
                </div>
                <span className="text-zinc-500 text-xs">
                  {result.duration_ms}ms
                </span>
              </div>

              {/* Result Error */}
              {result.error && (
                <div className="px-3 py-2 bg-red-500/10 border-b border-zinc-800">
                  <p className="text-red-400 text-xs">{result.error}</p>
                </div>
              )}

              {/* Search Bar */}
              <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && matchCount > 0) {
                        if (e.shiftKey) {
                          goToPrevMatch();
                        } else {
                          goToNextMatch();
                        }
                      }
                    }}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {searchTerm && matchCount > 0 && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={goToPrevMatch}
                      className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={goToNextMatch}
                      className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {searchTerm && (
                  <span className={`text-xs whitespace-nowrap ${matchCount > 0 ? 'text-yellow-400' : 'text-zinc-500'}`}>
                    {matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : '0'}
                  </span>
                )}
              </div>

              {/* Result Body */}
              <div className="p-3">
                <pre 
                  ref={preRef}
                  className={`text-xs bg-zinc-950 border border-zinc-800 p-3 rounded-lg overflow-x-auto font-mono text-zinc-300 leading-relaxed ${
                    compact ? 'max-h-64' : 'max-h-96'
                  }`}
                >
                  {renderHighlightedJson(formattedJson, searchTerm, currentMatchIndex)}
                </pre>
              </div>
            </div>
          )}
        </>
      )}

      {/* === SCENARIOS TAB === */}
      {panelMode === 'scenarios' && (
        <InlineScenarioRunner workspaceId={workspaceId} integration={selectedIntegration} />
      )}

      {panelMode === 'chats' && (
        <TestingChatPanel workspaceId={workspaceId} />
      )}
    </div>
  );
}

// =============================================================================
// TEST SCENARIOS (inline in TestPanel when integration supports them)
// =============================================================================

interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  integration: string;
  fields: Array<{
    name: string;
    label: string;
    placeholder?: string;
    required: boolean;
  }>;
}

interface ScenarioStep {
  step: string;
  status: 'success' | 'failed' | 'skipped';
  data?: unknown;
  error?: string;
  duration_ms?: number;
}

interface ScenarioResult {
  scenario: string;
  success: boolean;
  steps: ScenarioStep[];
  duration_ms: number;
}

/**
 * Inline scenario runner shown inside a TestPanel when the selected
 * integration has available scenarios.
 */
function InlineScenarioRunner({ workspaceId, integration }: { workspaceId: string; integration: string }) {
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/workspaces/${workspaceId}/test-scenario`)
      .then(r => r.json())
      .then(data => {
        const all: ScenarioDefinition[] = data.scenarios ?? [];
        const filtered = all.filter(s => s.integration === integration);
        setScenarios(filtered);
        if (filtered.length > 0) setSelectedScenario(filtered[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceId, integration]);

  const current = scenarios.find(s => s.id === selectedScenario);

  const canRun = current && !running && current.fields.every(
    f => !f.required || fieldValues[f.name]?.trim()
  );

  const runScenario = async () => {
    if (!canRun || !current) return;
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/test-scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: current.id, fields: fieldValues }),
      });
      const data = await res.json();
      if (!res.ok && !data.steps) {
        throw new Error(data.error || 'Scenario failed');
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  if (loading || scenarios.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-white">Scenarios</span>
        <span className="text-[10px] text-zinc-500">End-to-end pipeline tests</span>
      </div>

      {/* Scenario picker (if multiple) */}
      {scenarios.length > 1 && (
        <div className="relative">
          <select
            value={selectedScenario}
            onChange={(e) => {
              setSelectedScenario(e.target.value);
              setFieldValues({});
              setResult(null);
            }}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-zinc-600"
          >
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        </div>
      )}

      {current && (
        <p className="text-xs text-zinc-500">{current.description}</p>
      )}

      {/* Fields */}
      {current?.fields.map(field => (
        <div key={field.name}>
          <label className="block text-xs text-zinc-400 mb-1">
            {field.label} {field.required && <span className="text-red-400">*</span>}
          </label>
          <input
            type="text"
            value={fieldValues[field.name] || ''}
            onChange={(e) => setFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
            placeholder={field.placeholder}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-mono"
            onKeyDown={(e) => e.key === 'Enter' && canRun && runScenario()}
          />
        </div>
      ))}

      {/* Run button */}
      <button
        onClick={runScenario}
        disabled={!canRun}
        className="flex items-center justify-center gap-2 w-full bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-medium py-2 px-3 rounded-lg transition-colors text-sm"
      >
        {running ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            {current ? current.name : 'Run Scenario'}
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-2">
          <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
            result.success
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-red-500/5 border-red-500/20'
          }`}>
            {result.success ? (
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className={`text-xs font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
              {result.success ? 'All steps passed' : 'Scenario failed'}
            </span>
            <span className="text-[10px] text-zinc-500 ml-auto">{result.duration_ms}ms</span>
          </div>

          {result.steps.map((step, idx) => (
            <StepResult key={idx} step={step} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

function StepResult({ step, index }: { step: ScenarioStep; index: number }) {
  const [expanded, setExpanded] = useState(step.status === 'failed');

  return (
    <div className={`border rounded-lg overflow-hidden ${
      step.status === 'success' ? 'border-green-500/20' :
      step.status === 'failed' ? 'border-red-500/20' :
      'border-zinc-700'
    }`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/50 transition-colors"
      >
        {step.status === 'success' ? (
          <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
        ) : step.status === 'failed' ? (
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        ) : (
          <div className="w-3.5 h-3.5 rounded-full border border-zinc-600 shrink-0" />
        )}
        <span className="text-xs text-zinc-500 font-mono w-4 shrink-0">{index + 1}</span>
        <span className="text-xs text-zinc-300 flex-1">{step.step}</span>
        {step.duration_ms != null && (
          <span className="text-[10px] text-zinc-600">{step.duration_ms}ms</span>
        )}
        <ChevronRight className={`w-3 h-3 text-zinc-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 p-3 space-y-2">
          {step.error && (
            <p className="text-xs text-red-400">{step.error}</p>
          )}
          {step.data != null && (
            <pre className="text-[11px] bg-zinc-950 border border-zinc-800 p-2 rounded font-mono text-zinc-400 overflow-x-auto max-h-48">
              {JSON.stringify(step.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Main Testing Tab component - manages integrations and multi-panel view
 */
export function TestingTab({ workspaceId }: TestingTabProps) {
  const [integrations, setIntegrations] = useState<AvailableIntegration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [panelCount, setPanelCount] = useState(1);

  const addPanel = () => setPanelCount(prev => Math.min(prev + 1, 3));
  const removePanel = () => setPanelCount(prev => Math.max(prev - 1, 1));

  // Fetch available integrations
  const fetchIntegrations = useCallback(async () => {
    setLoadingIntegrations(true);
    setIntegrationError(null);
    
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/test-integration`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch integrations');
      }
      
      setIntegrations(data.integrations || []);
    } catch (error) {
      setIntegrationError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoadingIntegrations(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  if (loadingIntegrations) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (integrationError) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load integrations: {integrationError}</span>
        </div>
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
        <p className="text-zinc-400 mb-2">No integrations configured</p>
        <p className="text-zinc-500 text-sm">Add an integration to start testing API endpoints.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Integration Testing</h2>
          <p className="text-zinc-400 text-sm mt-0.5">
            Test API endpoints directly. Secrets are handled server-side.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addPanel}
            disabled={panelCount >= 3}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Panel
          </button>
          <span className="text-zinc-500 text-sm">{panelCount}/3</span>
        </div>
      </div>

      {/* Panels - horizontal first, wrap when too narrow */}
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: panelCount }).map((_, index) => (
          <div 
            key={index} 
            className="flex-1 min-w-[340px]"
          >
            <TestPanel 
              workspaceId={workspaceId} 
              integrations={integrations} 
              compact={panelCount > 1}
              onClose={panelCount > 1 ? removePanel : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

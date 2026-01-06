'use client';

import { useState, useEffect } from 'react';

/**
 * Stripe meta configuration
 */
interface StripeMeta {
  products: Record<string, string>; // productId -> productName
}

interface StripeConfigEditorProps {
  value: string; // JSON string
  onChange: (value: string) => void;
  error?: string;
}

/**
 * Default empty configuration
 */
const DEFAULT_CONFIG: StripeMeta = {
  products: {},
};

/**
 * Parse meta string to StripeMeta, handling invalid JSON
 */
function parseMeta(value: string): StripeMeta {
  if (!value.trim()) {
    return DEFAULT_CONFIG;
  }
  try {
    const parsed = JSON.parse(value);
    return {
      products: parsed.products || {},
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Structured editor for Stripe configuration
 * 
 * Features:
 * - Products section: Map Stripe product IDs to names for routing
 * - JSON toggle: Switch to raw JSON mode for power users
 */
export function StripeConfigEditor({ 
  value, 
  onChange,
  error: externalError,
}: StripeConfigEditorProps) {
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(value);
  const [meta, setMeta] = useState<StripeMeta>(() => parseMeta(value));
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  // New product form state
  const [newProductId, setNewProductId] = useState('');
  const [newProductName, setNewProductName] = useState('');
  
  // Delete confirmation state
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [deleteProductConfirm, setDeleteProductConfirm] = useState('');

  // Sync structured editor to parent
  useEffect(() => {
    if (!isJsonMode) {
      const newJson = JSON.stringify(meta, null, 2);
      onChange(newJson);
    }
  }, [meta, isJsonMode, onChange]);

  // Switch to JSON mode
  function handleSwitchToJson() {
    setJsonText(JSON.stringify(meta, null, 2));
    setIsJsonMode(true);
    setJsonError(null);
  }

  // Switch to structured mode
  function handleSwitchToStructured() {
    try {
      const parsed = JSON.parse(jsonText);
      setMeta({
        products: parsed.products || {},
      });
      setIsJsonMode(false);
      setJsonError(null);
    } catch {
      setJsonError('Invalid JSON - fix before switching to structured mode');
    }
  }

  // Handle JSON text changes
  function handleJsonChange(newText: string) {
    setJsonText(newText);
    setJsonError(null);
    try {
      JSON.parse(newText);
      onChange(newText);
    } catch {
      // Don't update parent if JSON is invalid
      setJsonError('Invalid JSON');
    }
  }

  // Add a new product
  function handleAddProduct() {
    if (!newProductId.trim() || !newProductName.trim()) return;
    
    setMeta(prev => ({
      ...prev,
      products: {
        ...prev.products,
        [newProductId.trim()]: newProductName.trim(),
      },
    }));
    
    setNewProductId('');
    setNewProductName('');
  }

  // Remove a product (with confirmation)
  function confirmRemoveProduct(productId: string) {
    const expectedText = `delete ${productId}`;
    if (deleteProductConfirm !== expectedText) return;
    
    setMeta(prev => {
      const newProducts = { ...prev.products };
      delete newProducts[productId];
      return { ...prev, products: newProducts };
    });
    
    setDeleteProductId(null);
    setDeleteProductConfirm('');
  }

  // Update product name
  function handleUpdateProduct(productId: string, newName: string) {
    setMeta(prev => ({
      ...prev,
      products: {
        ...prev.products,
        [productId]: newName,
      },
    }));
  }

  const productEntries = Object.entries(meta.products);
  const displayError = externalError || jsonError;

  // JSON Mode
  if (isJsonMode) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-zinc-400">JSON Mode</span>
          <button
            type="button"
            onClick={handleSwitchToStructured}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 border border-zinc-700 rounded hover:border-zinc-600"
          >
            Switch to Structured
          </button>
        </div>
        
        <textarea
          value={jsonText}
          onChange={(e) => handleJsonChange(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-white font-mono text-sm"
          rows={10}
          spellCheck={false}
        />
        
        {displayError && (
          <p className="text-red-400 text-sm">{displayError}</p>
        )}
      </div>
    );
  }

  // Structured Mode
  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSwitchToJson}
          className="text-xs text-zinc-400 hover:text-white px-2 py-1 border border-zinc-700 rounded hover:border-zinc-600"
        >
          Switch to JSON
        </button>
      </div>

      {/* Products Section */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Stripe Products</h4>
        <p className="text-xs text-zinc-500 mb-3">
          Map Stripe product IDs to names for routing payments to specific MailerLite groups.
        </p>
        
        {/* Existing products */}
        <div className="space-y-2 mb-4">
          {productEntries.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">No products configured. Add one below.</p>
          ) : (
            productEntries.map(([productId, productName]) => (
              <div 
                key={productId}
                className="flex items-center gap-2 p-3 bg-zinc-950 rounded border border-zinc-800"
              >
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Product ID</label>
                    <span className="text-sm font-mono text-zinc-300 block truncate" title={productId}>
                      {productId}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Product Name</label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => handleUpdateProduct(productId, e.target.value)}
                      className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteProductId(productId)}
                  className="text-red-400/80 hover:text-red-400 text-sm px-2"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add new product form */}
        <div className="flex items-end gap-2 p-3 bg-zinc-900/50 rounded border border-dashed border-zinc-700">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Product ID</label>
            <input
              type="text"
              value={newProductId}
              onChange={(e) => setNewProductId(e.target.value)}
              placeholder="prod_ABC123"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm font-mono text-white"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500 block mb-1">Product Name</label>
            <input
              type="text"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              placeholder="coaching"
              className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-sm text-white"
            />
          </div>
          <button
            type="button"
            onClick={handleAddProduct}
            disabled={!newProductId.trim() || !newProductName.trim()}
            className="px-3 py-1.5 text-sm bg-zinc-800 text-white rounded hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>

        {/* Hint */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-200/80">
          <span className="text-blue-400">💡 Tip:</span> Find your Product IDs in Stripe Dashboard → Products. 
          The product name you set here will be used for routing in MailerLite (e.g., payments for &quot;coaching&quot; 
          can go to a specific group).
        </div>
      </div>

      {displayError && (
        <p className="text-red-400 text-sm">{displayError}</p>
      )}

      {/* Delete Product Confirmation Modal */}
      {deleteProductId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-red-500/30 rounded-lg p-6 max-w-md w-full">
            <h4 className="text-lg font-semibold text-red-400/90 mb-2">Delete Product</h4>
            <p className="text-sm text-zinc-400 mb-3">
              This will remove the product mapping for{' '}
              <span className="font-mono text-white">{deleteProductId}</span>.
            </p>
            <p className="text-xs text-zinc-300 mb-2">
              Type <span className="font-mono font-bold">delete {deleteProductId}</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteProductConfirm}
              onChange={(e) => setDeleteProductConfirm(e.target.value)}
              placeholder={`delete ${deleteProductId}`}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-white text-sm mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => confirmRemoveProduct(deleteProductId)}
                disabled={deleteProductConfirm !== `delete ${deleteProductId}`}
                className="flex-1 px-4 py-2 bg-red-600/80 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Delete Product
              </button>
              <button
                onClick={() => {
                  setDeleteProductId(null);
                  setDeleteProductConfirm('');
                }}
                className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


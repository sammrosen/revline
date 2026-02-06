/**
 * Shared form styling constants
 * 
 * These styles create a modern, polished look with:
 * - Filled background inputs (no borders)
 * - Taller, more generous padding
 * - Bold typography for headers
 */

export const formStyles = {
  // Input with filled background - light theme
  input: "bg-gray-100 border-0 rounded-lg px-4 py-4 w-full text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors",
  
  // Input with filled background - dark theme (for dashboard)
  inputDark: "bg-zinc-800 border-0 rounded-lg px-4 py-4 w-full text-white placeholder:text-zinc-500 focus:bg-zinc-700 focus:ring-2 focus:outline-none transition-colors",
  
  // Select dropdown - light theme
  select: "bg-gray-100 border-0 rounded-lg px-4 py-4 w-full text-gray-900 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors appearance-none cursor-pointer",
  
  // Select dropdown - dark theme
  selectDark: "bg-zinc-800 border-0 rounded-lg px-4 py-4 w-full text-white focus:bg-zinc-700 focus:ring-2 focus:outline-none transition-colors appearance-none cursor-pointer",
  
  // Label above input
  label: "block text-sm font-medium text-gray-600 mb-2",
  
  // Label - dark theme
  labelDark: "block text-sm font-medium text-zinc-400 mb-2",
  
  // Bold section header
  sectionHeader: "text-base font-bold uppercase tracking-wide text-gray-900 mb-4",
  
  // Section header - dark theme
  sectionHeaderDark: "text-base font-bold uppercase tracking-wide text-white mb-4",
  
  // Card container - subtle
  card: "bg-white rounded-xl shadow-sm",
  
  // Card with more padding
  cardPadded: "bg-white rounded-xl shadow-sm p-8",
  
  // Error state for inputs
  inputError: "ring-2 ring-red-500/50",
  
  // Helper/error text
  helperText: "mt-1.5 text-sm text-gray-500",
  errorText: "mt-1.5 text-sm text-red-500",
};

/**
 * Get input styles with optional brand color for focus ring
 */
export function getInputStyle(brandColor?: string): React.CSSProperties {
  return brandColor ? { '--tw-ring-color': `${brandColor}40` } as React.CSSProperties : {};
}

/**
 * Combine base input class with error state if needed
 */
export function inputClassName(hasError?: boolean, dark?: boolean): string {
  const base = dark ? formStyles.inputDark : formStyles.input;
  return hasError ? `${base} ${formStyles.inputError}` : base;
}

/**
 * Combine base select class with error state if needed
 */
export function selectClassName(hasError?: boolean, dark?: boolean): string {
  const base = dark ? formStyles.selectDark : formStyles.select;
  return hasError ? `${base} ${formStyles.inputError}` : base;
}

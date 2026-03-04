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

// =============================================================================
// Typography lookup maps (Tailwind-safe — full class strings for tree-shaking)
// =============================================================================

const SIZE_CLASS_MAP: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
};

const WEIGHT_CLASS_MAP: Record<string, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

export function sizeClass(size: string): string {
  return SIZE_CLASS_MAP[size] || 'text-sm';
}

export function weightClass(weight: string): string {
  return WEIGHT_CLASS_MAP[weight] || 'font-normal';
}

export function typoClass(size: string, weight: string): string {
  return `${sizeClass(size)} ${weightClass(weight)}`;
}

export interface TextClasses {
  sectionHeader: string;
  pageTitle: string;
  body: string;
  label: string;
  caption: string;
}

export function buildTextClasses(t: {
  sectionHeader: { size: string; weight: string };
  pageTitle: { size: string; weight: string };
  body: { size: string; weight: string };
  label: { size: string; weight: string };
  caption: { size: string; weight: string };
}): TextClasses {
  return {
    sectionHeader: typoClass(t.sectionHeader.size, t.sectionHeader.weight),
    pageTitle: typoClass(t.pageTitle.size, t.pageTitle.weight),
    body: typoClass(t.body.size, t.body.weight),
    label: typoClass(t.label.size, t.label.weight),
    caption: typoClass(t.caption.size, t.caption.weight),
  };
}

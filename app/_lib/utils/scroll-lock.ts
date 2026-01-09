/**
 * Scroll Lock Utility
 * 
 * Prevents background scrolling when modals/dialogs are open.
 * Uses CSS class + position fixed to handle iOS Safari quirks.
 */

let scrollY = 0;
let lockCount = 0;

/**
 * Lock body scroll (prevents background scrolling behind modals)
 * Supports nested calls - only unlocks when all locks are released
 */
export function lockScroll(): void {
  if (typeof document === 'undefined') return;
  
  lockCount++;
  
  // Only apply styles on first lock
  if (lockCount === 1) {
    scrollY = window.scrollY;
    document.body.classList.add('scroll-locked');
    document.body.style.top = `-${scrollY}px`;
  }
}

/**
 * Unlock body scroll (restores scrolling)
 * Only actually unlocks when all nested locks are released
 */
export function unlockScroll(): void {
  if (typeof document === 'undefined') return;
  
  lockCount = Math.max(0, lockCount - 1);
  
  // Only remove styles when all locks are released
  if (lockCount === 0) {
    document.body.classList.remove('scroll-locked');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
  }
}

/**
 * Force unlock all scroll locks (use sparingly)
 */
export function forceUnlockScroll(): void {
  if (typeof document === 'undefined') return;
  
  lockCount = 0;
  document.body.classList.remove('scroll-locked');
  document.body.style.top = '';
  window.scrollTo(0, scrollY);
}

/**
 * React hook for scroll locking
 * Automatically locks on mount and unlocks on unmount
 * 
 * @example
 * function Modal({ isOpen }) {
 *   useScrollLock(isOpen);
 *   return isOpen ? <div>Modal content</div> : null;
 * }
 */
export function useScrollLock(shouldLock: boolean): void {
  // This is a stub - actual implementation needs React import
  // Import this from a separate file that imports React
  if (typeof window !== 'undefined' && shouldLock) {
    // Will be properly implemented in the hook file
  }
}

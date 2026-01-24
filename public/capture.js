/**
 * RevLine Capture Script
 * 
 * Lightweight client-side form capture that observes form submissions
 * and sends mapped fields to RevLine without blocking the original form flow.
 * 
 * Usage:
 * <script src="https://revline.app/capture.js"
 *         data-form-id="your-form-id"
 *         data-form-selector="#signup-form"
 *         data-fields="email_field:email,name_field:firstName,barcode:custom.barcode"
 *         async>
 * </script>
 * 
 * Attributes:
 * - data-form-id: Required. The RevLine form ID
 * - data-form-selector: Required. CSS selector for the form to observe
 * - data-fields: Required. Comma-separated mappings of "sourceField:targetField"
 * - data-endpoint: Optional. Override the capture endpoint URL
 * 
 * Security:
 * - Only captures explicitly mapped fields (allowlist)
 * - Denylists password, credit card, and SSN fields
 * - Never blocks the original form submission
 * - Silent failures (never breaks client site)
 */

(function() {
  'use strict';

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  var script = document.currentScript;
  if (!script) {
    // Fallback for older browsers or async loading
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('capture.js') !== -1) {
        script = scripts[i];
        break;
      }
    }
  }

  if (!script) return;

  var FORM_ID = script.getAttribute('data-form-id');
  var FORM_SELECTOR = script.getAttribute('data-form-selector');
  var FIELDS_RAW = script.getAttribute('data-fields') || '';
  var ENDPOINT = script.getAttribute('data-endpoint') || 'https://revline.app/api/v1/capture/';

  // Validate required attributes
  if (!FORM_ID || !FORM_SELECTOR || !FIELDS_RAW) {
    console.warn('[RevLine] Missing required attributes: data-form-id, data-form-selector, data-fields');
    return;
  }

  // Parse field mappings: "source:target,source:target"
  var FIELD_MAP = {};
  var pairs = FIELDS_RAW.split(',');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].trim();
    var colonIndex = pair.indexOf(':');
    if (colonIndex > 0) {
      var source = pair.substring(0, colonIndex).trim();
      var target = pair.substring(colonIndex + 1).trim();
      if (source && target) {
        FIELD_MAP[source] = target;
      }
    }
  }

  // ==========================================================================
  // SECURITY: DENYLIST
  // ==========================================================================

  // Field types to never capture
  var DENYLIST_TYPES = ['password', 'hidden'];

  // Field name patterns to never capture (case-insensitive)
  var DENYLIST_PATTERNS = [
    /password/i,
    /passwd/i,
    /pwd/i,
    /secret/i,
    /token/i,
    /api.?key/i,
    /ssn/i,
    /social.?security/i,
    /credit.?card/i,
    /card.?number/i,
    /cvv/i,
    /cvc/i,
    /expir/i,
    /routing/i,
    /account.?num/i,
    /bank/i
  ];

  /**
   * Check if a form element should be denylisted
   */
  function isDenylisted(element) {
    // Check type
    var type = (element.type || '').toLowerCase();
    if (DENYLIST_TYPES.indexOf(type) !== -1) {
      return true;
    }

    // Check name/id against patterns
    var name = (element.name || element.id || '').toLowerCase();
    for (var i = 0; i < DENYLIST_PATTERNS.length; i++) {
      if (DENYLIST_PATTERNS[i].test(name)) {
        return true;
      }
    }

    return false;
  }

  // ==========================================================================
  // VALUE SANITIZATION
  // ==========================================================================

  var MAX_VALUE_LENGTH = 1000;

  // Patterns that indicate sensitive data in values
  var SENSITIVE_VALUE_PATTERNS = [
    /^\d{13,19}$/,           // Credit card numbers
    /^\d{3}-\d{2}-\d{4}$/,   // SSN format
    /^\d{9}$/                // SSN without dashes
  ];

  /**
   * Check if a value looks like sensitive data
   */
  function isSensitiveValue(value) {
    var trimmed = value.trim();
    for (var i = 0; i < SENSITIVE_VALUE_PATTERNS.length; i++) {
      if (SENSITIVE_VALUE_PATTERNS[i].test(trimmed)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Sanitize a value for transmission
   */
  function sanitizeValue(value) {
    if (typeof value !== 'string') {
      return String(value);
    }
    return value
      .trim()
      .substring(0, MAX_VALUE_LENGTH);
  }

  // ==========================================================================
  // FORM DATA CAPTURE
  // ==========================================================================

  /**
   * Capture mapped fields from a form
   */
  function captureFormData(form) {
    var data = {};
    var elements = form.querySelectorAll('input, select, textarea');

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var sourceName = el.name || el.id;

      // Skip if no name/id
      if (!sourceName) continue;

      // Skip denylisted elements
      if (isDenylisted(el)) continue;

      // Check if this field is in our mapping
      var targetName = FIELD_MAP[sourceName];
      if (!targetName) continue;

      // Get value
      var value = '';
      if (el.type === 'checkbox') {
        value = el.checked ? 'true' : '';
      } else if (el.type === 'radio') {
        if (el.checked) {
          value = el.value;
        } else {
          continue; // Skip unchecked radio buttons
        }
      } else if (el.tagName === 'SELECT') {
        value = el.options[el.selectedIndex] ? el.options[el.selectedIndex].value : '';
      } else {
        value = el.value;
      }

      // Skip empty values
      if (!value) continue;

      // Skip sensitive values
      if (isSensitiveValue(value)) continue;

      // Sanitize and store
      data[targetName] = sanitizeValue(value);
    }

    return data;
  }

  // ==========================================================================
  // DATA TRANSMISSION
  // ==========================================================================

  /**
   * Send captured data to RevLine
   */
  function sendCapture(data) {
    // Email is required
    if (!data.email) {
      return;
    }

    var url = ENDPOINT + FORM_ID;
    var payload = JSON.stringify(data);

    // Prefer sendBeacon for reliability (doesn't block navigation)
    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([payload], { type: 'text/plain' });
        navigator.sendBeacon(url, blob);
        return;
      } catch (e) {
        // Fall through to fetch
      }
    }

    // Fallback to fetch with keepalive
    if (typeof fetch === 'function') {
      try {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
          mode: 'cors',
          credentials: 'omit'
        }).catch(function() {
          // Silent fail - never break client site
        });
      } catch (e) {
        // Silent fail
      }
    }
  }

  // ==========================================================================
  // FORM ATTACHMENT
  // ==========================================================================

  var attached = false;

  /**
   * Attach to the target form
   */
  function attachToForm() {
    if (attached) return;

    var form = document.querySelector(FORM_SELECTOR);
    if (!form) {
      return;
    }

    // Mark as attached
    attached = true;

    // Listen for form submission
    form.addEventListener('submit', function(event) {
      try {
        var data = captureFormData(form);
        sendCapture(data);
      } catch (e) {
        // Silent fail - never break client site
      }
      // Don't prevent default - let original form submit normally
    });
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  function init() {
    // Try to attach immediately
    attachToForm();

    // If not found, try again when DOM is ready
    if (!attached) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachToForm);
      }
    }

    // Also observe DOM for dynamically added forms (SPAs)
    if (!attached && typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function(mutations) {
        if (!attached) {
          attachToForm();
          if (attached) {
            observer.disconnect();
          }
        }
      });

      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });

      // Stop observing after 30 seconds to avoid memory leaks
      setTimeout(function() {
        observer.disconnect();
      }, 30000);
    }
  }

  // Start initialization
  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();

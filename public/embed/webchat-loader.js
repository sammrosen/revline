/**
 * RevLine Webchat Embed Loader
 *
 * Drop-in script for any HTML page. Renders a floating chat bubble that opens
 * an iframe to the hosted RevLine chat panel.
 *
 * Preferred usage (WebchatConfig ID):
 *   <script
 *     src="https://your-revline-domain.com/embed/webchat-loader.js"
 *     data-config="webchat-config-uuid"
 *     async defer
 *   ></script>
 *
 * Legacy usage (backward compat):
 *   <script
 *     src="https://your-revline-domain.com/embed/webchat-loader.js"
 *     data-workspace="your-workspace-slug"
 *     data-agent="your-agent-uuid"
 *     data-color="#2563eb"
 *     data-name="Chat with us"
 *     data-collect-email="true"
 *     async defer
 *   ></script>
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var configId = script.getAttribute('data-config');
  var workspace = script.getAttribute('data-workspace');
  var agent = script.getAttribute('data-agent');

  if (!configId && (!workspace || !agent)) return;

  var color = script.getAttribute('data-color') || '#2563eb';
  var name = script.getAttribute('data-name') || 'Chat';
  var collectEmail = script.getAttribute('data-collect-email') || 'false';
  var position = script.getAttribute('data-position') || 'right';

  var scriptSrc = script.getAttribute('src') || '';
  var origin = scriptSrc.replace(/\/embed\/webchat-loader\.js.*$/, '');
  if (!origin || origin === scriptSrc) {
    origin = window.location.origin;
  }

  var embedUrl;
  if (configId) {
    embedUrl = origin + '/embed/chat?config=' + encodeURIComponent(configId);
  } else {
    embedUrl =
      origin +
      '/embed/chat?workspace=' + encodeURIComponent(workspace) +
      '&agent=' + encodeURIComponent(agent) +
      '&color=' + encodeURIComponent(color) +
      '&name=' + encodeURIComponent(name) +
      '&collectEmail=' + encodeURIComponent(collectEmail);
  }

  var isOpen = false;
  var container = null;
  var iframe = null;
  var bubble = null;

  function createBubble() {
    bubble = document.createElement('div');
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.setAttribute('role', 'button');
    bubble.setAttribute('tabindex', '0');

    var side = position === 'left' ? 'left:24px;' : 'right:24px;';
    bubble.style.cssText =
      'position:fixed;bottom:24px;' + side +
      'width:56px;height:56px;border-radius:50%;cursor:pointer;z-index:2147483646;' +
      'display:flex;align-items:center;justify-content:center;' +
      'background:' + color + ';' +
      'box-shadow:0 4px 12px rgba(0,0,0,.15);' +
      'transition:transform .2s ease,box-shadow .2s ease;';

    bubble.innerHTML =
      '<svg width="24" height="24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">' +
        '<path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>' +
      '</svg>';

    bubble.addEventListener('mouseenter', function () {
      bubble.style.transform = 'scale(1.08)';
      bubble.style.boxShadow = '0 6px 20px rgba(0,0,0,.2)';
    });
    bubble.addEventListener('mouseleave', function () {
      bubble.style.transform = 'scale(1)';
      bubble.style.boxShadow = '0 4px 12px rgba(0,0,0,.15)';
    });
    bubble.addEventListener('click', toggle);
    bubble.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    document.body.appendChild(bubble);
  }

  function createPanel() {
    container = document.createElement('div');
    var side = position === 'left' ? 'left:24px;' : 'right:24px;';
    container.style.cssText =
      'position:fixed;bottom:96px;' + side +
      'width:380px;height:520px;z-index:2147483647;' +
      'border-radius:16px;overflow:hidden;' +
      'box-shadow:0 8px 30px rgba(0,0,0,.12),0 2px 8px rgba(0,0,0,.08);' +
      'opacity:0;transform:translateY(12px) scale(.96);' +
      'transition:opacity .25s ease,transform .25s ease;' +
      'pointer-events:none;';

    iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.setAttribute('title', name);
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:16px;';

    container.appendChild(iframe);
    document.body.appendChild(container);
  }

  function toggle() {
    if (!container) createPanel();

    isOpen = !isOpen;

    if (isOpen) {
      container.style.opacity = '1';
      container.style.transform = 'translateY(0) scale(1)';
      container.style.pointerEvents = 'auto';
      bubble.setAttribute('aria-label', 'Close chat');
      bubble.innerHTML =
        '<svg width="20" height="20" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">' +
          '<path d="M6 18L18 6M6 6l12 12"/>' +
        '</svg>';
    } else {
      container.style.opacity = '0';
      container.style.transform = 'translateY(12px) scale(.96)';
      container.style.pointerEvents = 'none';
      bubble.setAttribute('aria-label', 'Open chat');
      bubble.innerHTML =
        '<svg width="24" height="24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">' +
          '<path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>' +
        '</svg>';
    }
  }

  // Listen for messages from the iframe (close event)
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'revline-chat-close' && isOpen) {
      toggle();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) {
      toggle();
    }
  });

  // Responsive: on narrow viewports, make the panel full-width
  function applyResponsive() {
    if (!container) return;
    var narrow = window.innerWidth < 440;
    if (narrow) {
      container.style.width = 'calc(100vw - 16px)';
      container.style.height = 'calc(100vh - 120px)';
      container.style.left = '8px';
      container.style.right = '8px';
      container.style.bottom = '88px';
      container.style.borderRadius = '16px';
    } else {
      container.style.width = '380px';
      container.style.height = '520px';
      container.style.left = position === 'left' ? '24px' : '';
      container.style.right = position === 'right' ? '24px' : '';
      container.style.bottom = '96px';
    }
  }

  window.addEventListener('resize', applyResponsive);

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createBubble);
  } else {
    createBubble();
  }
})();

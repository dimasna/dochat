import { chatBubbleIcon, closeIcon } from './icons';

(function() {
  let iframe: HTMLIFrameElement | null = null;
  let container: HTMLDivElement | null = null;
  let button: HTMLButtonElement | null = null;
  let isOpen = false;

  // Derive widget URL from this script's own src
  const currentScript = document.currentScript as HTMLScriptElement;
  const WIDGET_URL = currentScript
    ? currentScript.src.replace(/\/widget\.js(\?.*)?$/, '')
    : window.location.origin;

  // Get configuration from script tag
  let organizationId: string | null = null;
  let agentId: string | null = null;
  let position: 'bottom-right' | 'bottom-left' = 'bottom-right';

  if (currentScript) {
    organizationId = currentScript.getAttribute('data-organization-id');
    agentId = currentScript.getAttribute('data-agent-id');
    position = (currentScript.getAttribute('data-position') as 'bottom-right' | 'bottom-left') || 'bottom-right';
  } else {
    // Fallback: find script tag by src
    const scripts = document.querySelectorAll('script[src*="widget.js"]');
    const embedScript = Array.from(scripts).find(script =>
      script.hasAttribute('data-organization-id')
    ) as HTMLScriptElement;

    if (embedScript) {
      organizationId = embedScript.getAttribute('data-organization-id');
      agentId = embedScript.getAttribute('data-agent-id');
      position = (embedScript.getAttribute('data-position') as 'bottom-right' | 'bottom-left') || 'bottom-right';
    }
  }

  // Exit if no organization ID
  if (!organizationId) {
    console.error('Dochat Widget: data-organization-id attribute is required');
    return;
  }

  // Derive API base from widget URL (web app serves the API)
  // The widget app knows its own API base, but embed.ts needs to fetch config
  // from the web app. We'll try the WIDGET_URL's origin to reach /api/embed/config.
  const API_BASE = WIDGET_URL.replace(/:\d+$/, '').replace(/:\d+/, '') || WIDGET_URL;

  // Theme config (fetched from API)
  let themeColor = '#3b82f6';
  let widgetLogo: string | null = null;

  async function fetchConfig() {
    try {
      const params = new URLSearchParams({ orgId: organizationId! });
      if (agentId) params.set('agentId', agentId);

      // Try fetching config from the web app API
      // The widget iframe origin is the widget app, but the config API is on the web app
      // We need to figure out the web app URL. It could be same origin or different.
      // Try multiple approaches:
      const urls = [
        `${WIDGET_URL}/api/config?${params}`,
      ];

      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.themeColor) themeColor = data.themeColor;
            if (data.widgetLogo) widgetLogo = data.widgetLogo;
            return;
          }
        } catch {
          // Try next URL
        }
      }
    } catch {
      // Use defaults
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        fetchConfig().then(render);
      });
    } else {
      fetchConfig().then(render);
    }
  }

  function render() {
    // Create floating action button
    button = document.createElement('button');
    button.id = 'dochat-widget-button';

    // Use logo if available, otherwise use chat icon
    if (widgetLogo) {
      button.innerHTML = `<img src="${widgetLogo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" alt="Chat" />`;
    } else {
      button.innerHTML = chatBubbleIcon;
    }

    button.style.cssText = `
      position: fixed;
      ${position === 'bottom-right' ? 'right: 20px;' : 'left: 20px;'}
      bottom: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${themeColor};
      color: white;
      border: none;
      cursor: pointer;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 24px ${themeColor}59;
      transition: all 0.2s ease;
    `;

    button.addEventListener('click', toggleWidget);
    button.addEventListener('mouseenter', () => {
      if (button) button.style.transform = 'scale(1.05)';
    });
    button.addEventListener('mouseleave', () => {
      if (button) button.style.transform = 'scale(1)';
    });

    document.body.appendChild(button);

    // Create container (hidden by default)
    container = document.createElement('div');
    container.id = 'dochat-widget-container';
    container.style.cssText = `
      position: fixed;
      ${position === 'bottom-right' ? 'right: 20px;' : 'left: 20px;'}
      bottom: 90px;
      width: 400px;
      height: 600px;
      max-width: calc(100vw - 40px);
      max-height: calc(100vh - 110px);
      z-index: 999998;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      display: none;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s ease;
    `;

    // Create iframe
    iframe = document.createElement('iframe');
    iframe.src = buildWidgetUrl();
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `;
    // Add permissions for clipboard
    iframe.allow = 'clipboard-read; clipboard-write';

    container.appendChild(iframe);
    document.body.appendChild(container);

    // Handle messages from widget
    window.addEventListener('message', handleMessage);
  }

  function buildWidgetUrl(): string {
    const params = new URLSearchParams();
    params.append('organizationId', organizationId!);
    if (agentId) {
      params.append('agentId', agentId);
    }
    return `${WIDGET_URL}?${params.toString()}`;
  }

  function handleMessage(event: MessageEvent) {
    if (event.origin !== new URL(WIDGET_URL).origin) return;

    const { type, payload } = event.data;

    switch (type) {
      case 'close':
        hide();
        break;
      case 'resize':
        if (payload.height && container) {
          container.style.height = `${payload.height}px`;
        }
        break;
    }
  }

  function toggleWidget() {
    if (isOpen) {
      hide();
    } else {
      show();
    }
  }

  function show() {
    if (container && button) {
      isOpen = true;
      container.style.display = 'block';
      // Trigger animation
      setTimeout(() => {
        if (container) {
          container.style.opacity = '1';
          container.style.transform = 'translateY(0)';
        }
      }, 10);
      // Change button icon to close
      button.innerHTML = closeIcon;
    }
  }

  function hide() {
    if (container && button) {
      isOpen = false;
      container.style.opacity = '0';
      container.style.transform = 'translateY(10px)';
      // Hide after animation
      setTimeout(() => {
        if (container) container.style.display = 'none';
      }, 300);
      // Change button icon back
      if (widgetLogo) {
        button.innerHTML = `<img src="${widgetLogo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" alt="Chat" />`;
      } else {
        button.innerHTML = chatBubbleIcon;
      }
      button.style.background = themeColor;
    }
  }

  function destroy() {
    window.removeEventListener('message', handleMessage);
    if (container) {
      container.remove();
      container = null;
      iframe = null;
    }
    if (button) {
      button.remove();
      button = null;
    }
    isOpen = false;
  }

  // Function to reinitialize with new config
  function reinit(newConfig: { organizationId?: string; agentId?: string; position?: 'bottom-right' | 'bottom-left' }) {
    destroy();

    if (newConfig.organizationId) {
      organizationId = newConfig.organizationId;
    }
    if (newConfig.agentId) {
      agentId = newConfig.agentId;
    }
    if (newConfig.position) {
      position = newConfig.position;
    }

    init();
  }

  // Expose API to global scope
  (window as any).DochatWidget = {
    init: reinit,
    show,
    hide,
    destroy
  };

  // Auto-initialize
  init();
})();

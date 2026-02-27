declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const GTM_CONTAINER_IDS = (() => {
  const rawIds = (import.meta.env.VITE_GTM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const ids = new Set<string>([...rawIds, 'GTM-K72WFGD']);
  return Array.from(ids);
})();
const ensureTagManager = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!GTM_CONTAINER_IDS.length) {
    return false;
  }

  window.dataLayer = window.dataLayer || [];
  let initialized = false;

  GTM_CONTAINER_IDS.forEach((id) => {
    const scriptId = `gtm-${id}`;
    if (document.getElementById(scriptId)) {
      return;
    }

    window.dataLayer?.push({
      'gtm.start': new Date().getTime(),
      event: 'gtm.js',
      'gtm.id': id,
    });

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
    document.head.appendChild(script);
    initialized = true;
  });

  return initialized;
};

export const initAnalytics = () => {
  ensureTagManager();
};

export const trackPageView = (pagePath: string, pageTitle: string) => {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];

  window.dataLayer.push({
    event: 'page_view',
    page_path: pagePath,
    page_title: pageTitle,
    page_location: window.location.href,
  });
};

export const attachClickTracking = () => {
  const handleClick = (event: MouseEvent) => {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];

    const path = (event.composedPath ? event.composedPath() : []) as EventTarget[];
    let label = '';
    let element = '';
    let targetPath: string | undefined;

    for (const node of path) {
      if (!(node instanceof HTMLElement)) continue;

      const datasetLabel = node.dataset?.gaLabel;
      if (datasetLabel) {
        label = datasetLabel;
      } else if (!label) {
        const text = (node.textContent || '').trim();
        if (text) {
          label = text.slice(0, 80);
        }
      }

      if (!element) {
        element = node.tagName.toLowerCase();
      }

      if (!targetPath && node instanceof HTMLAnchorElement && node.href) {
        try {
          targetPath = new URL(node.href).pathname;
        } catch {
          // ignore invalid URLs
        }
      }

      if (label) break;
    }

    if (!label) return;

    window.dataLayer.push({
      event: 'click',
      event_category: 'interaction',
      event_label: label,
      element,
      target_path: targetPath,
    });
  };

  document.addEventListener('click', handleClick, true);
  return () => document.removeEventListener('click', handleClick, true);
};

export const trackEvent = (eventName: string, params: Record<string, unknown> = {}) => {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];

  window.dataLayer.push({
    event: eventName,
    ...params,
  });
};

import { createOverlayView } from './view.mjs';

/** Mount once per application lifetime; destroy when the owner is unmounted. */
export function mountPraeformaOverlay(options) {
  if (!options?.projectId?.trim()) throw new Error('Praeforma projectId is required');
  const projectId = options.projectId;
  const base = new URL(options.baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Praeforma baseUrl must be an HTTP(S) URL without credentials, query or fragment');
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const host = document.createElement('div');
  let disposed = false, generation = 0, controller;
  let layoutId = options.layoutId;
  const view = createOverlayView(host, () => { void refresh(); });
  (options.target ?? document.body).append(host);
  async function refresh() {
    if (disposed) return;
    const request = ++generation;
    controller?.abort(); controller = new AbortController();
    const signal = controller.signal;
    view.loading();
    try {
      const headers = await options.headers?.();
      if (disposed || signal.aborted) return;
      const url = new URL(`${base.href.replace(/\/$/, '')}/api/projects/${encodeURIComponent(projectId)}/review-overlay`);
      if (layoutId) url.searchParams.set('layout_id', layoutId);
      const response = await fetcher(url.href, { headers, signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const snapshot = await response.json();
      if (!disposed && request === generation) view.render(snapshot);
    } catch (error) {
      if (!disposed && request === generation && !signal.aborted) view.error(error instanceof Error ? error : new Error(String(error)));
    }
  }
  void refresh();
  return {
    refresh,
    setScene(next) { layoutId = next; return refresh(); },
    setVisible(visible) { if (!disposed) host.hidden = !visible; },
    destroy() { if (disposed) return; disposed = true; ++generation; controller?.abort(); host.remove(); },
  };
}

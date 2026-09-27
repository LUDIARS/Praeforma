export interface OverlayOptions {
  baseUrl: string;
  projectId: string;
  layoutId?: string;
  target?: HTMLElement;
  /** Inject the application's authenticated transport. Tokens are never persisted by this library. */
  fetch?: typeof fetch;
  headers?: () => HeadersInit | Promise<HeadersInit>;
}
export interface OverlayHandle {
  refresh(): Promise<void>;
  setScene(layoutId?: string): Promise<void>;
  setVisible(visible: boolean): void;
  destroy(): void;
}
export function mountPraeformaOverlay(options: OverlayOptions): OverlayHandle;

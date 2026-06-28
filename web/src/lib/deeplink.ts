import React from 'react';

// Thaleia (突合サービス) が発行するディープリンク `?tab=&focus=` を消費する補助。
//
// 発行側契約は Thaleia の `src/links/deeplink.ts` (praeformaTabUrl) を正本とする:
//   tab   ∈ {domains, specs, layouts}
//   focus = domains → domain.name / specs → spec.code / layouts → layout.name
// 発行側に無い tab 値は受け付けない (勝手に拡張しない)。

/** Thaleia がディープリンクで指定し得る Praeforma のタブ。 */
export type DeeplinkTab = 'domains' | 'specs' | 'layouts';

const DEEPLINK_TABS: readonly DeeplinkTab[] = ['domains', 'specs', 'layouts'];

/** `?tab` クエリ値を検証し、 発行側契約に一致する場合のみ返す (不一致/未指定は null)。 */
export function parseDeeplinkTab(raw: string | null | undefined): DeeplinkTab | null {
  if (!raw) return null;
  return (DEEPLINK_TABS as readonly string[]).includes(raw) ? (raw as DeeplinkTab) : null;
}

/** CSS セレクタに focus 値を安全に埋め込む (CSS.escape が無い環境向けの素朴な代替付き)。 */
function escapeAttr(value: string): string {
  const g = globalThis as { CSS?: { escape?: (s: string) => string } };
  if (g.CSS?.escape) return g.CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}

export interface FocusState {
  /** 見つからなかった focus 値。 null = 未指定 or 解決済み。 UI で明示するために返す。 */
  notFound: string | null;
}

/**
 * `?focus=<id>` に一致する要素 (`[data-focus]`) へスクロール + ハイライトする。
 *
 * 該当タブのデータ取得完了 (`ready`) 後に focus ごとに一度だけ実行し、
 * 要素が見つからなければ console.warn + `notFound` を返す (無言フォールバック禁止)。
 * ページ着地自体は呼び出し側で維持する (本フックは着地に介入しない)。
 */
export function useFocusEntity(focus: string | null, ready: boolean): FocusState {
  const [notFound, setNotFound] = React.useState<string | null>(null);
  const handledRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!focus) {
      setNotFound(null);
      handledRef.current = null;
      return;
    }
    if (!ready) return;
    if (handledRef.current === focus) return; // 同一 focus は一度だけ処理する
    handledRef.current = focus;

    const el = document.querySelector<HTMLElement>(`[data-focus="${escapeAttr(focus)}"]`);
    if (!el) {
      console.warn(`[deeplink] focus="${focus}" に一致するエンティティが見つかりません (該当タブに不在)`);
      setNotFound(focus);
      return;
    }
    setNotFound(null);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('focus-highlight');
    const timer = window.setTimeout(() => el.classList.remove('focus-highlight'), 2400);
    return () => window.clearTimeout(timer);
  }, [focus, ready]);

  return { notFound };
}

const expected: Record<string, readonly string[]> = {
  tabs: ['ダッシュボード</button>', '仕様確認</button>', '遷移図</button>', 'UX定義</button>'],
  dashboard: ['pf-event-day', 'event-kind-actor', 'event-kind-spec', '仕様の更新'],
  review: ['spec-review-structured', 'spec-review-fragments', 'data-state="review"', 'data-state="implemented"', 'data-state="integrated"'],
  scenes: ['読み取り専用', '編集モード', '開始地点', '行き先 (1)', '入ってくる遷移 2', '仕様 (0)'],
  ux: ['ux-vision', 'ux-scenarios', 'ux-domains', 'ux-visuals'].flatMap(id => [`href="#${id}"`, `id="${id}"`]),
};

export default {
  post(html: string, view: string): true | string {
    const missing = expected[view]?.filter(token => !html.includes(token));
    if (!missing) return 'unknown view';
    if (missing.length) return `missing: ${missing.join(', ')}`;
    if (view === 'dashboard' && html.split('class="pf-event-day"').length !== 3) return 'expected two calendar days';
    return true;
  },
};

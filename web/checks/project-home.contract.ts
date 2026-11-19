const expected: Record<string, readonly string[]> = {
  tabs: ['ダッシュボード</button>', '仕様確認</button>', '遷移図</button>', 'UX定義</button>'],
  dashboard: ['pf-event-day', 'event-kind-actor', 'event-kind-spec', '仕様の更新'],
  review: ['spec-review-tab-structured', 'spec-review-tab-fragments', 'spec-review-tab-pending', 'spec-review-badge', 'spec-category-interaction', 'data-state="review"', '廃止した仕様 (1)'],
  scenes: ['読み取り専用', '配置を編集', 'ボタン配置を編集', 'scene-node', '開始地点', 'キャプチャなし', '仕様 0', '全体を表示'],
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

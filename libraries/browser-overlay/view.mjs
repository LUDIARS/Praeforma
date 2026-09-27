import { node, showSpecifications } from './content.mjs';
import { showElements } from './elements.mjs';
import { showStatus } from './status.mjs';

const style = `:host{all:initial;position:fixed;inset:12px 12px auto auto;z-index:2147483000;font:14px/1.5 system-ui;color:#eef2ff}:host([hidden]){display:none}button,select{font:inherit;color:inherit;background:#263454;border:1px solid #627294;border-radius:6px;padding:6px;cursor:pointer}button:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #91cdff}button[aria-pressed=true]{background:#375784}.panel{background:#111c30;border:1px solid #60708f;border-radius:10px;padding:14px;width:min(420px,calc(100vw - 52px));max-height:calc(100vh - 80px);overflow:auto;box-shadow:0 8px 28px #0008}nav{display:flex;gap:8px;flex-wrap:wrap}h2{font-size:18px}h3{font-size:16px}p{white-space:pre-wrap;overflow-wrap:anywhere}article{border-top:1px solid #53607a;padding:8px 0}.error{color:#ffb8ad}.meta{color:#bad3ef}summary{cursor:pointer}.elements-preview{position:relative;width:100%;background:#1d2c43;border:1px solid #667c99;overflow:hidden}.element-box{position:absolute;box-sizing:border-box;border:1px solid #91cdff;background:#36547470;font-size:11px;overflow:hidden}select{max-width:100%}`;

/** Specifications are text nodes; no HTML from Pf enters the host document. */
export function createOverlayView(host, refresh) {
  const root = host.attachShadow({ mode: 'closed' }); root.append(node('style', style));
  const panel = node('section'); panel.className = 'panel'; panel.setAttribute('aria-label', 'Praeforma 仕様と実装状況');
  const open = node('button', 'Pf 仕様と実装状況'); open.setAttribute('aria-expanded', 'true');
  open.onclick = () => { panel.hidden = !panel.hidden; open.setAttribute('aria-expanded', String(!panel.hidden)); };
  const reload = node('button', '更新'); reload.onclick = refresh;
  const content = node('div'); content.setAttribute('aria-live', 'polite');
  panel.append(reload, content); root.append(open, panel);
  let selected = '', mode = 'elements';
  return {
    loading() { content.replaceChildren(node('p', '仕様を取得中…')); },
    error(error) { const message = node('p', '取得できませんでした: ' + error.message); message.className = 'error'; message.setAttribute('role', 'alert'); content.replaceChildren(message); },
    render(snapshot) {
      if (!snapshot || !Array.isArray(snapshot.specs) || !Array.isArray(snapshot.scenarios) || !snapshot.acceptance?.results) throw new Error('Pf の応答形式を確認してください');
      content.replaceChildren(node('h2', snapshot.projectName + (snapshot.scene ? ' / ' + snapshot.scene.name : '')));
      const label = node('label', '関連するシナリオ '), select = node('select'); select.append(new Option('選択してください', ''));
      snapshot.scenarios.forEach(item => select.append(new Option((item.category === 'expression' ? '表現: ' : 'ゲームプレイ: ') + item.name, item.id)));
      if (!snapshot.scenarios.some(item => item.id === selected)) selected = '';
      select.value = selected; label.append(select);
      const nav = node('nav'); nav.setAttribute('aria-label', '表示内容');
      const body = node('div'); const buttons = new Map();
      const show = () => {
        body.replaceChildren(); buttons.forEach((button, key) => button.setAttribute('aria-pressed', String(key === mode)));
        const scenario = snapshot.scenarios.find(item => item.id === selected);
        ({ elements: showElements, specs: showSpecifications, status: showStatus })[mode](body, snapshot, scenario);
      };
      [['elements', '要素'], ['specs', '仕様'], ['status', '実装・テスト']].forEach(([key, title]) => {
        const button = node('button', title); button.onclick = () => { mode = key; show(); }; buttons.set(key, button); nav.append(button);
      });
      select.onchange = () => { selected = select.value; show(); };
      content.append(label, nav, body); show();
    },
  };
}

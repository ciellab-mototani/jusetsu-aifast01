/* r47 ページを移ったら必ず一番上から（関さん 2026-10-29「各セクション押したら一番下に行く…一番上からスタート」）。
   確認用ページは枠の中で開くので、前のページの位置が残ることがある。#付きの行き先だけはその場所へ */
(() => {
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch {}
  const top = () => { if (location.hash) return; scrollTo(0, 0); document.documentElement.scrollIntoView?.({ block: 'start' }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', top, { once: true }); else top();
  addEventListener('pageshow', (e) => { if (e.persisted) top(); });
})();
/* r42：ヘッダーの開閉・浮く問い合わせ（×で閉じる）・FAQ の検索と分類・導入の道のり（下へ送ると延びる）・図の入り。
   JS が動かなくても中身は全部見える（隠すのは .r42-js が付いたときだけ。lp-3d-stage 決まり8）。 */
(() => {
  const root = document.documentElement;
  root.classList.add('r42-js');
  const still = () => root.classList.contains('r40-still') || matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ヘッダー（スマホは開閉式）
  const menu = document.querySelector('.r42-menu'), nav = document.getElementById('r42-nav');
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
  });
  nav?.addEventListener('click', (e) => { if (e.target.closest('a')) { menu?.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); } });

  // 浮く問い合わせ：最初の画面を過ぎたら出す。×で閉じたら、このタブの間は出さない
  const float = document.querySelector('.r42-float');
  let closed = false;
  try { closed = sessionStorage.getItem('r42-float-closed') === '1'; } catch {}
  const onScroll = () => { if (float && !closed) float.hidden = scrollY < innerHeight * 0.9; };
  float?.querySelector('.r42-float-x')?.addEventListener('click', () => {
    closed = true; float.hidden = true;
    try { sessionStorage.setItem('r42-float-closed', '1'); } catch {}
  });

  // 導入の道のり：章の中を下へ送った量で線が延びる
  const road = document.querySelector('.r42-road');
  const onRoad = () => {
    if (!road) return;
    if (still()) { road.style.setProperty('--rp', '1'); return; }
    const r = road.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.9)));
    road.style.setProperty('--rp', p.toFixed(3));
  };
  let ticking = false;
  addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); onRoad(); }); }, { passive: true });
  onScroll(); onRoad();

  // 図の入り（公開GIS の札が落ちてくる）
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.25 }) : null;
  document.querySelectorAll('.r42-diagram').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));

  // FAQ：言葉と分類でしぼる（全部閉じたまま。当たった問いの数を読み上げる）
  const faq = document.querySelector('.r42-faq-tools');
  if (faq) {
    const input = faq.querySelector('input[type=search]');
    const chips = [...faq.querySelectorAll('[data-filter]')];
    const items = [...document.querySelectorAll('.r42-faq .faq-item')];
    const count = faq.querySelector('.r42-faq-count'), none = document.querySelector('.r42-faq-none');
    const norm = (s) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
    const text = new Map(items.map((d) => [d, norm(d.textContent)]));
    let cat = '';
    const apply = () => {
      const q = norm(input.value);
      let n = 0;
      for (const d of items) {
        const ok = (!cat || d.dataset.category === cat) && (!q || text.get(d).includes(q));
        d.hidden = !ok; if (ok) n++;
      }
      count.textContent = `${n}件の質問`;
      none.hidden = n > 0;
    };
    input.addEventListener('input', apply);
    chips.forEach((b) => b.addEventListener('click', () => {
      cat = b.dataset.filter;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      apply();
    }));
    apply();
  }
})();

/* RPG の「転職」：fv-scene.js が書く場面（data-phase）を見て、言葉の窓に1文字ずつ出し、仲間の窓のレベルを上げる。
   場面の進め方は fv-scene.js のまま（ここは表示だけ）。動きを減らす設定では文を一度に出す */
(() => {
  const scene = document.querySelector('#fv .power-scene');
  const win = scene?.querySelector('.r42-rpg'), text = win?.querySelector('.r42-rpg-text'), party = scene?.querySelector('.r42-party');
  if (!scene || !win || !text || !party) return;
  const calm = () => document.documentElement.classList.contains('r40-still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LINES = {
    support: ['ファストは 重説AIの じゅもんを となえた！'],
    transforming: ['重説AIファストの ちからが 4人を つつみこむ！'],
    transformed: ['営業マン2人と 営業事務2人が パワーアップした！', '営業も バックオフィスも、みんな レベル99に あがった！'],
  };
  let timers = [], seq = 0;
  const stop = () => { timers.forEach(clearTimeout); timers = []; seq++; };
  const type = (s, id) => new Promise((done) => {
    win.classList.add('on'); win.classList.remove('done');
    if (calm()) { text.textContent = s; win.classList.add('done'); return done(); }
    let i = 0; text.textContent = '';
    const step = () => { if (id !== seq) return; text.textContent = s.slice(0, ++i); if (i < s.length) timers.push(setTimeout(step, 38)); else { win.classList.add('done'); done(); } };
    step();
  });
  const wait = (ms) => new Promise((ok) => timers.push(setTimeout(ok, calm() ? 0 : ms)));
  const levelUp = (id) => {
    party.classList.add('on');
    party.querySelectorAll('em').forEach((em, k) => {
      if (calm()) { em.textContent = '99'; scene.classList.add('lv99'); return; }
      let lv = 1; const tick = () => { if (id !== seq) return; lv = Math.min(99, lv + 7 + k); em.textContent = String(lv); if (lv >= 99 && k === 3) scene.classList.add('lv99'); if (lv < 99) timers.push(setTimeout(tick, 60)); };
      timers.push(setTimeout(tick, 200 + k * 150));
    });
  };
  // 場面の切り替えは速い（合図 0.7秒・変身 0.65秒）ので、文は自分の順番で読ませる。最初に戻す・止めるときだけ消す
  let running = false;
  const reset = () => { stop(); running = false; win.classList.remove('on', 'done'); text.textContent = ''; party.classList.remove('on'); scene.classList.remove('lv99'); party.querySelectorAll('em').forEach((e) => (e.textContent = '1')); };
  const until = (want, id) => new Promise((ok) => { const chk = () => { if (id !== seq) return; if (scene.dataset.phase === want) ok(); else timers.push(setTimeout(chk, 80)); }; chk(); });
  const script = async () => {
    stop(); running = true; const id = seq;
    await type(LINES.support[0], id); await wait(500);
    if (id !== seq) return; await type(LINES.transforming[0], id); await until('transformed', id); await wait(400);
    if (id !== seq) return; await type(LINES.transformed[0], id); await wait(1300);
    if (id !== seq) return; await type(LINES.transformed[1], id); levelUp(id);
  };
  new MutationObserver(() => {
    const ph = scene.dataset.phase;
    if (ph === 'idle' || ph === 'paused' || ph === 'awaiting-material') reset();
    else if (!running && (ph === 'activate' || ph === 'support' || ph === 'transforming')) script();
  }).observe(scene, { attributes: true, attributeFilter: ['data-phase'] });
})();

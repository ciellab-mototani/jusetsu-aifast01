/* r41：機能ページの3Dの舞台。下へ送った量（--p：0→1）と、PC ではマウスの位置（--mx・--my：-0.5→0.5）を CSS へ渡すだけ。
   形と動きは mp.css が持つ。止まっている間は何もしない（毎フレーム回し続けない）。 */
(() => {
  const root = document.documentElement;
  const still = document.querySelector('.mp-still');
  still?.addEventListener('click', () => {
    const on = root.classList.toggle('r40-still');
    still.setAttribute('aria-pressed', String(on));
    still.textContent = on ? '動きを再開' : '動きを止める';
  });
  const hero = document.querySelector('.mp-hero');
  const stage = hero?.querySelector('.mp-stage');
  if (!stage || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const now = { p: 0, mx: 0, my: 0 }, want = { p: 0, mx: 0, my: 0 };
  let raf = 0;
  const tick = () => {
    raf = 0;
    let moving = false;
    for (const k in now) {
      const d = want[k] - now[k];
      if (Math.abs(d) > 0.0005) { now[k] += d * 0.12; moving = true; } else now[k] = want[k];
      stage.style.setProperty('--' + k, now[k].toFixed(4));
    }
    if (moving) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const onScroll = () => {
    const r = hero.getBoundingClientRect();
    want.p = Math.min(1, Math.max(0, -r.top / (r.height * 0.8)));
    kick();
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
  if (fine) hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    want.mx = (e.clientX - r.left) / r.width - 0.5;
    want.my = (e.clientY - r.top) / r.height - 0.5;
    kick();
  });
})();

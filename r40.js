/* r40: 下へ送ると順に出てくる動き（設計7）と、「動きを停止」で全部の動きを止める（設計8）。 */
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // パネルの「動きを停止」ボタンで、ページ全体の動きも止める
  const stopButton = document.querySelector('#fv .panel-controls button');
  stopButton?.addEventListener('click', () => root.classList.toggle('r40-still', stopButton.textContent.trim() === '動きを再開'));
  if (reduced.matches || !('IntersectionObserver' in window)) return;
  // 章の見出し・カード・画面の枠。FV（パネルの複製を含む）と、仕組みの章の切り替わる画面は対象外
  const targets = [...document.querySelectorAll([
    'main .intro', 'main section > header', 'main .evidence-workspace', 'main .diagram', 'main .bridge',
    'main .stage', 'main article', 'main .price-plan', 'main .steps > li', 'main details', '.workflow-overview header'
  ].join(','))].filter(el => !el.closest('#fv, .overview-device, dialog'));
  root.classList.add('r40-motion');
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('r40-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  for (const el of targets) {
    el.classList.add('r40-reveal');
    // すでに画面に入っている物は、待たせずにすぐ出す
    if (el.getBoundingClientRect().top < innerHeight) el.classList.add('r40-in'); else io.observe(el);
  }
})();

/* r47：①問い合わせのボタンを押すと、元のLP（ai-fast.jp）と同じ項目のフォームが画面に出る（関さん 2026-10-29「問い合わせフォームがバンと出てくるように」）。
   送信はcontact.js経由でPHPへ。項目の配置と既存の画面演出を維持する。
   ②7つの機能の目次で、いま見ている番号を光らせる */
(() => {
  const TYPES = [['demo', '無料トライアルの予約', '無料トライアルを予約する'], ['doc', '資料請求（料金表つき）', '料金表つきの資料を請求する'], ['ask', 'お問い合わせ', 'この内容で問い合わせる']];
  const kindOf = (el) => { const s = `${el.textContent} ${el.dataset.cta || ''} ${el.dataset.contact || ''} ${el.dataset.inquiry || ''}`; return /資料|request/.test(s) ? 'doc' : /デモ|トライアル|demo|trial/.test(s) ? 'demo' : 'ask'; };
  let dlg = null, openedAt = null, opener = null, pushed = false;
  addEventListener('popstate', () => { if (dlg && dlg.open) { pushed = false; dlg.close(); } });
  const build = () => {
    dlg = document.createElement('dialog');
    dlg.addEventListener('close', () => {
      if (pushed) { pushed = false; try { history.back(); } catch (e) {} }
      if (openedAt) { const p = openedAt; openedAt = null; requestAnimationFrame(() => scrollTo(p[0], p[1])); }
      if (opener && opener.focus) { try { opener.focus({ preventScroll: true }); } catch (e) {} opener = null; }
    });
    dlg.className = 'r47-form-dlg';
    dlg.setAttribute('aria-labelledby', 'r47-form-t');
    const opt = (a) => a.map((x) => `<label><input type="checkbox" name="${x[0]}" value="${x[1]}">${x[1]}</label>`).join('');
    dlg.innerHTML = `<form class="r47-form" method="post" action="contact.php" novalidate>
<button type="button" class="r47-form-x" aria-label="閉じる">×</button>
<h2 id="r47-form-t"><small>宅建業者さま限定</small><span class="r47-form-h">無料トライアル予約・資料請求</span></h2>
<label>お問い合わせ種別<em>必須</em><select name="kind" required>${TYPES.map((t) => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select></label>
<label>会社名<em>必須</em><input name="company" required autocomplete="organization"></label>
<div class="row"><label>姓<em>必須</em><input name="family" required autocomplete="family-name"></label><label>名<em>必須</em><input name="given" required autocomplete="given-name"></label></div>
<label>メールアドレス<em>必須</em><input type="email" name="email" required autocomplete="email" inputmode="email"></label>
<label>ご連絡のつきやすい電話番号<em>必須</em><input type="tel" name="tel" required autocomplete="tel" inputmode="tel"></label>
<fieldset><legend>お使いの書式<i>任意</i></legend>${opt([['form', '全宅連（ハトサポ）'], ['form', '全日（ラビーネット）'], ['form', 'FRK'], ['form', '自社の独自書式'], ['form', 'わからない']])}</fieldset>
<fieldset><legend>主な物件種別<i>任意・複数可</i></legend>${opt([['type', '区分所有マンション'], ['type', '土地・戸建'], ['type', '一棟物'], ['type', 'その他']])}</fieldset>
<div class="row"><label>部署名<i>任意</i><input name="dept" autocomplete="organization-title"></label><label>役職<i>任意</i><input name="role"></label></div>
<label>相談事項<i>任意</i><textarea name="note" rows="3"></textarea></label>
<label class="agree"><input type="checkbox" name="agree" required><span><a href="https://skynet-biz.jp/policy" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>に同意する</span><em>必須</em></label>
<div hidden aria-hidden="true"><label>この項目は入力しないでください<input name="website" tabindex="-1" autocomplete="off"></label></div>
<div class="r47-verification"><div class="r47-turnstile"></div><p class="r47-verification-status" role="status"></p><button type="button" class="r47-verification-retry">認証をやり直す</button></div>
<button type="submit">無料トライアルを予約する</button>
<p class="done" role="status" hidden></p>
<button type="button" class="r47-done-close" hidden>閉じる</button>
<p class="r47-tel" hidden>お電話でも受け付けています：<a href="tel:0120-138-870">0120-138-870</a></p></form>`;
    document.body.append(dlg);
    const f = dlg.querySelector('form'), sel = f.elements.kind, btn = f.querySelector('button[type=submit]'), done = f.querySelector('.done');
    const doneClose = f.querySelector('.r47-done-close'), tel = f.querySelector('.r47-tel'), vstat = f.querySelector('.r47-verification-status');
    const sync = () => { const t = TYPES.find((x) => x[0] === sel.value); btn.textContent = t[2]; f.querySelector('.r47-form-h').textContent = t[1]; };
    sel.addEventListener('change', sync);
    f.querySelector('.r47-form-x').addEventListener('click', () => dlg.close());
    doneClose.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    const prepareVerification = force => window.aifastContact.prepare(f.querySelector('.r47-turnstile'), f.querySelector('.r47-verification-status'), force).catch(() => {});
    f.querySelector('.r47-verification-retry').addEventListener('click', () => prepareVerification(true));
    dlg.r47prepare = () => prepareVerification(false);
    const FAIL = /できませんでした|読み込めません|時間切れ|ご利用いただけません|利用できません/;
    const syncTel = () => { tel.hidden = !(FAIL.test(vstat.textContent) || done.dataset.state === 'error'); };
    new MutationObserver(() => { if (vstat.textContent === '認証を準備しています。' && f.querySelector('.r47-turnstile iframe')) vstat.textContent = ''; syncTel(); })
      .observe(f.querySelector('.r47-verification'), {childList: true, subtree: true, characterData: true});
    new MutationObserver(syncTel).observe(done, {childList: true, characterData: true, subtree: true, attributes: true});
    const limits = {company:200, family:80, given:80, email:254, tel:40, dept:120, role:120, note:4000};
    Object.entries(limits).forEach(([name, max]) => { f.elements[name].maxLength = max; });
    let submitting = false, sent = false, requestId = null, signature = null;
    dlg.r47reset = () => {
      if (submitting) return;
      if (sent) { f.reset(); sent = false; requestId = null; signature = null; f.classList.remove('is-sent'); doneClose.hidden = true; done.hidden = true; delete done.dataset.state; }
      btn.disabled = false;
    };
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitting || sent || !f.reportValidity()) return;
      done.hidden = false;
      submitting = true; btn.disabled = true; btn.classList.add('is-busy'); btn.textContent = '送信しています…'; delete done.dataset.state; f.setAttribute('aria-busy', 'true');
      done.textContent = '送信しています。しばらくお待ちください。';
      const fd = new FormData(f);
      const payload = Object.fromEntries(['kind', ...Object.keys(limits), 'website'].map(name => [name, fd.get(name) || '']));
      payload.form = fd.getAll('form'); payload.type = fd.getAll('type'); payload.agree = fd.get('agree') !== null;
      try {
        const nextSignature = JSON.stringify(payload);
        if (signature !== nextSignature || !requestId) { requestId = window.aifastContact.id(); signature = nextSignature; }
        const result = await window.aifastContact.send({...payload, request_id: requestId});
        sent = true; done.textContent = result.message; f.classList.add('is-sent'); doneClose.hidden = false; setTimeout(() => doneClose.focus({ preventScroll: true }), 0);
        window.aifastTrack?.('generate_lead', {inquiry_type: payload.kind});
      } catch (error) {
        done.dataset.state = 'error';
        done.textContent = error.name === 'AbortError' || error instanceof TypeError
          ? '送信結果を確認できませんでした。入力内容は保持しています。同じ内容で再度お試しいただくか、0120-138-870までお電話ください。'
          : error.message;
      } finally { submitting = false; btn.disabled = sent; btn.classList.remove('is-busy'); if (!sent) sync(); f.removeAttribute('aria-busy'); }
    });
    dlg.r47sync = sync;
  };
  const open = (kind) => {
    if (!dlg) build();
    const f = dlg.querySelector('form');
    if (!dlg.open) dlg.r47reset();
    f.elements.kind.value = kind; dlg.r47sync();
    f.querySelector('.done').hidden = true;
    if (!dlg.open) { openedAt = [scrollX, scrollY]; opener = document.activeElement; dlg.showModal(); try { history.pushState({ r47: 1 }, ''); pushed = true; } catch (e) {} }
    dlg.r47prepare();
    if (!matchMedia('(pointer: coarse)').matches) f.elements.company.focus({ preventScroll: true });
  };
  // 問い合わせのボタン（#sales-contact へのリンク・最初の画面の data-contact・問い合わせ章の data-inquiry）を、先回りして受け取る
  document.addEventListener('click', (e) => {
    const el = e.target.closest('a[href$="#sales-contact"],button[data-contact],button[data-inquiry]');
    if (!el || el.closest('.r47-form-dlg')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    open(kindOf(el));
  }, true);

  // 7つの機能の目次：いま見ている機能を光らせる
  const toc = document.querySelector('.r47-toc');
  if (toc && 'IntersectionObserver' in window) {
    const links = new Map([...toc.querySelectorAll('a')].map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((es) => es.forEach((x) => {
      if (!x.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      const a = links.get(x.target.id);
      if (a) { a.setAttribute('aria-current', 'true'); a.scrollIntoView({ block: 'nearest', inline: 'center' }); }
    }), { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('.r47-feat').forEach((s) => io.observe(s));
  }
})();

/* r49 画面カード：①②③を押すと、画面の囲みと札が切り替わる（関さん F09「丸1丸2で移動させて」） */
document.querySelectorAll('.r49-card').forEach((card) => {
  const set = (i) => {
    card.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.step === String(i))));
    card.querySelectorAll('.r49-box,.r49-label').forEach((x) => x.classList.toggle('on', x.dataset.step === String(i)));
  };
  card.addEventListener('click', (e) => { const b = e.target.closest('[role=tab]'); if (b) set(b.dataset.step); });
});
/* r49 よくある質問：分類でしぼったとき、問いが1つも見えない分類の見出しを隠す・#sales-faq-NN で来たらその問いを開く */
(() => {
  const list = document.querySelector('.faq-list'); if (!list) return;
  const sync = () => list.querySelectorAll('.r49-faq-cat').forEach((h) => {
    let n = h.nextElementSibling, any = false;
    while (n && !n.matches('.r49-faq-cat')) { if (n.matches('.faq-item') && !n.hidden && getComputedStyle(n).display !== 'none') any = true; n = n.nextElementSibling; }
    if (h.hidden !== !any) h.hidden = !any; // 同じ値を書き直すと見張りがまた動き、止まらずに回ってページが落ちた（2026-10-30 関さん「検索の窓口、文字打てへん」）
  });
  let busy = 0; // 見出しを書き換えている間に起きた変化では、もう一度回さない
  new MutationObserver((ms) => { if (busy || ms.every((m) => m.target.matches?.('.r49-faq-cat'))) return; busy = requestAnimationFrame(() => { sync(); busy = 0; }); }).observe(list, { subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
  const open = () => { const d = location.hash && document.querySelector(location.hash); if (d && d.matches('details.faq-item')) { d.open = true; d.scrollIntoView({ block: 'start' }); } };
  addEventListener('hashchange', open); open();
})();
/* r51 1〜2字（「。」だけも含む）が次の行に落ちるのを防ぐ（関さん 10-29「丸が下に行ったりもしてる」・門 tools/lp/r49-gamen-mon.mjs が数える）。
   落ちている所だけ、最後の4字を1つにくっつけて、前の行から字を連れて行く（組版の「泣き別れ」防ぎ）。文は変えない */
(() => {
  const SEL = 'h1,h2,h3,button,a,.tag,b,strong,small,figcaption,.r49-sub,.r48-gain b,.benefit,li,p,span';
  const lastLine = (e) => {
    const tops = []; const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) for (let i = 0; i < n.length; i++) { if (/\s/.test(n.data[i])) continue; const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const q = r.getClientRects()[0]; if (q && q.width > 0) tops.push(Math.round(q.top)); }
    if (tops.length < 5) return 99;
    const lines = []; for (const y of tops) { const l = lines.find((L) => Math.abs(L.y - y) < 4); if (l) l.n++; else lines.push({ y, n: 1 }); }
    return lines.length < 2 ? 99 : lines.sort((a, b) => a.y - b.y).at(-1).n;
  };
  const glue = (e) => {
    const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let last = null;
    for (let n; (n = w.nextNode());) if (n.data.trim()) last = n;
    if (!last || last.parentElement.classList.contains('r51-glue')) return;
    const s = last.data.replace(/\s+$/, ''); if (s.length < 4) return;
    const tail = document.createElement('span'); tail.className = 'r51-glue'; tail.style.whiteSpace = 'nowrap'; tail.textContent = s.slice(-4);
    last.data = s.slice(0, -4); last.after(tail);
  };
  const run = () => document.querySelectorAll(SEL).forEach((e) => {
    if (e.closest('.r42-rpg,.panel-grid,.tile-face,script,style,[aria-hidden="true"]') || e.offsetParent === null) return;
    const t = e.innerText.replace(/\s+/g, ''); if (t.length < 5 || t.length > 80) return;
    if ([...e.querySelectorAll('*')].some((c) => !/^inline/.test(getComputedStyle(c).display) && getComputedStyle(c).display !== 'none' && c.tagName !== 'BR')) return;
    if (lastLine(e) <= 2) glue(e);
  });
  const go = () => (document.fonts?.ready || Promise.resolve()).then(() => requestAnimationFrame(run));
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
  let t = 0; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(run, 300); }, { passive: true });
})();

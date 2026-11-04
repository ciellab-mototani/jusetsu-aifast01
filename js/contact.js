/* Turnstile + CSRF transport. Secret keys and SMTP credentials never reach the browser. */
(() => {
  const endpoint = new URL('../contact.php', document.currentScript.src);
  let scriptPromise, widget = null, token = '', siteKey = '', message, container, preparing;
  const setMessage = text => { if (message) message.textContent = text; };
  const request = async options => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(endpoint, {credentials: 'same-origin', cache: 'no-store', ...options, signal: controller.signal});
      let data;
      try { data = await response.json(); } catch { throw new Error('現在フォームをご利用いただけません。時間をおいて再度お試しください。'); }
      if (!response.ok || data.ok !== true) throw new Error(data.message || '送信できませんでした。時間をおいて再度お試しください。');
      return data;
    } finally { clearTimeout(timer); }
  };
  const headers = {'X-Requested-With': 'aifast-contact'};
  const loadScript = () => {
    if (window.turnstile) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const fail = () => { clearTimeout(timer); script.remove(); reject(new Error('認証を読み込めませんでした。「認証をやり直す」を押してください。')); };
      const timer = setTimeout(fail, 15000);
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => { if (!window.turnstile) return fail(); clearTimeout(timer); resolve(); };
      script.onerror = fail; document.head.append(script);
    }).catch(error => { scriptPromise = null; throw error; });
    return scriptPromise;
  };
  const reset = () => {
    token = '';
    if (widget !== null && window.turnstile) { setMessage('認証を確認しています。'); window.turnstile.reset(widget); }
  };
  const prepare = (target, status, force = false) => {
    container = target; message = status;
    if (preparing) return preparing;
    if (!force && widget !== null) { if (!token) reset(); return Promise.resolve(); }
    setMessage('認証を準備しています。');
    preparing = (async () => {
      const session = await request({headers});
      if (typeof session.siteKey !== 'string' || !session.siteKey) throw new Error('現在フォームをご利用いただけません。');
      await loadScript();
      if (widget !== null) window.turnstile.remove(widget);
      token = ''; siteKey = session.siteKey;
      widget = window.turnstile.render(container, {
        sitekey: siteKey, action: 'contact', language: 'ja', theme: 'light',
        size: container.clientWidth < 300 ? 'compact' : 'normal',
        'response-field': false,
        callback: value => { token = value; setMessage('認証が完了しました。'); },
        'expired-callback': () => { token = ''; setMessage('認証の有効期限が切れました。再認証をお待ちいただくか「認証をやり直す」を押してください。'); },
        'error-callback': () => { token = ''; setMessage('認証できませんでした。「認証をやり直す」を押してください。'); return true; },
        'timeout-callback': () => { token = ''; setMessage('認証が時間切れになりました。「認証をやり直す」を押してください。'); },
        'unsupported-callback': () => { token = ''; setMessage('このブラウザでは認証を利用できません。別のブラウザでお試しいただくか、お電話ください。'); }
      });
    })().catch(error => { setMessage(error.name === 'AbortError' ? '認証の準備が時間切れになりました。もう一度お試しください。' : error.message); throw error; }).finally(() => { preparing = null; });
    return preparing;
  };
  window.aifastContact = {
    prepare,
    id: () => [...crypto.getRandomValues(new Uint8Array(16))].map(v => v.toString(16).padStart(2, '0')).join(''),
    send: async payload => {
      if (preparing) await preparing;
      if (!token || widget === null || window.turnstile.isExpired(widget)) {
        reset(); throw new Error('認証の完了をお待ちいただいてから、もう一度送信してください。');
      }
      const challenge = token; token = '';
      try {
        const session = await request({headers});
        if (session.siteKey !== siteKey) throw new Error('認証設定が更新されました。「認証をやり直す」を押してください。');
        return await request({method: 'POST', headers: {...headers, 'Content-Type': 'application/json', 'X-CSRF-Token': session.token}, body: JSON.stringify({...payload, turnstile_token: challenge})});
      } catch (error) { reset(); throw error; }
    }
  };
})();

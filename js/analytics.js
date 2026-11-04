/* Production only. Keep direct GA4 until GA4 is deliberately migrated into GTM. */
(() => {
  if (location.protocol !== 'https:' || location.hostname !== 'ai-fast.jp') return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  const safeLocation = location.origin + location.pathname; // Do not collect query strings or fragments.
  window.gtag('js', new Date());
  window.gtag('config', 'G-JTJ5249XSK', {page_location: safeLocation, page_referrer: document.referrer.split(/[?#]/)[0]});
  const ga = document.createElement('script'); ga.async = true;
  ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-JTJ5249XSK'; document.head.append(ga);
  window.dataLayer.push({'gtm.start': Date.now(), event: 'gtm.js'});
  const gtm = document.createElement('script'); gtm.async = true;
  gtm.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-WK48T3XH'; document.head.append(gtm);
  window.aifastTrack = (event, params) => {
    // Only fixed event names and enum values; never send form values or free text.
    if (!['cta_click', 'generate_lead'].includes(event)) return;
    const kind = ['demo', 'doc', 'ask'].includes(params.inquiry_type) ? params.inquiry_type : 'ask';
    window.gtag('event', event, {inquiry_type: kind, send_to: 'G-JTJ5249XSK'});
  };
  document.addEventListener('click', e => {
    const cta = e.target.closest('a[href$="#sales-contact"],button[data-contact],button[data-inquiry]');
    if (!cta || cta.closest('.r47-form-dlg')) return;
    const text = `${cta.textContent} ${cta.dataset.cta || ''} ${cta.dataset.contact || ''} ${cta.dataset.inquiry || ''}`;
    window.aifastTrack('cta_click', {inquiry_type: /資料|request/.test(text) ? 'doc' : /デモ|トライアル|demo|trial/.test(text) ? 'demo' : 'ask'});
  }, true);
})();

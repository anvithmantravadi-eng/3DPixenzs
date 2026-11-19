(() => {
  const key = 'strata-privacy-v1';
  const lifetime = 183 * 24 * 60 * 60 * 1000;
  const globalOptOut = navigator.globalPrivacyControl === true;
  let preference = null;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && saved.acknowledged === true && typeof saved.fonts === 'boolean' && Number.isFinite(saved.savedAt) &&
        saved.savedAt <= Date.now() && Date.now() - saved.savedAt < lifetime) preference = saved;
  } catch {}
  function applyFonts(enabled) {
    let link = document.getElementById('optional-google-fonts');
    if (!enabled || globalOptOut) { link?.remove(); return; }
    if (!link) {
      link = document.createElement('link');
      link.id = 'optional-google-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap';
      document.head.append(link);
    }
  }
  applyFonts(preference?.fonts === true);
  const banner = document.createElement('aside');
  banner.className = 'privacy-banner';
  banner.setAttribute('aria-label','Privacy choices');
  banner.innerHTML = '<div><strong>Your privacy choices</strong><p>We save your bag on this device. Optional Google Fonts is off until you enable it. <a href="cookies.html">Cookies &amp; storage</a></p><label class="check-label"><input type="checkbox" data-notice-ack><span>I have read the <a href="privacy.html">Privacy notice</a> and <a href="cookies.html">Cookies &amp; storage policy</a>.</span></label></div><div class="privacy-actions"><button class="button" data-essential disabled>USE ESSENTIALS</button><button class="privacy-secondary" data-open-settings>SETTINGS</button></div>';
  const dialog = document.createElement('dialog');
  dialog.className = 'privacy-dialog';
  dialog.setAttribute('aria-labelledby','privacy-title');
  dialog.innerHTML = '<div class="dialog-head"><h2 id="privacy-title">Privacy settings</h2><button type="button" data-dismiss aria-label="Close privacy settings">×</button></div><p>Essential browser storage keeps your chosen bag and welcome code. Analytics and advertising trackers are absent from the current storefront.</p><label class="check-label"><input id="optional-font-toggle" type="checkbox"><span>Allow Google Fonts. Your browser will connect to Google to load the site’s fonts.</span></label><p id="global-control-note"></p><label class="check-label"><input type="checkbox" data-dialog-ack><span>I have read the Privacy notice and Cookies &amp; storage policy.</span></label><button class="button wide" data-save disabled>SAVE CHOICES</button><button class="bundle" data-clear>CLEAR SAVED BAG &amp; EMAIL</button><p class="privacy-clear-status" role="status"></p><p><a href="cookies.html">Cookies &amp; storage policy</a> · <a href="privacy-rights.html">Privacy requests</a></p>';
  document.body.append(banner,dialog);
  const toggle = dialog.querySelector('#optional-font-toggle');
  toggle.disabled = globalOptOut;
  dialog.querySelector('#global-control-note').textContent = globalOptOut
    ? 'Global Privacy Control detected. Optional fonts stay off. This storefront does not sell data or use targeted advertising.'
    : 'You can change your choices here at any time.';
  banner.hidden = preference !== null;
  const acknowledgment=banner.querySelector('[data-notice-ack]');
  const dialogAcknowledgment=dialog.querySelector('[data-dialog-ack]');
  acknowledgment.onchange=()=>{banner.querySelector('[data-essential]').disabled=!acknowledgment.checked;};
  dialogAcknowledgment.onchange=()=>{dialog.querySelector('[data-save]').disabled=!dialogAcknowledgment.checked;};
  function showSettings() {
    dialogAcknowledgment.checked=preference?.acknowledged===true||acknowledgment.checked;
    dialog.querySelector('[data-save]').disabled=!dialogAcknowledgment.checked;
    toggle.checked = !globalOptOut && preference?.fonts === true;
    if (!dialog.open) dialog.showModal();
  }
  function save(fonts) {
    preference = {fonts:fonts && !globalOptOut,acknowledged:true,savedAt:Date.now()};
    try { localStorage.setItem(key,JSON.stringify(preference)); } catch {}
    applyFonts(preference.fonts);
    banner.hidden = true;
    dialog.close();
  }
  function clearData() {
    try { localStorage.removeItem('strata-v2'); sessionStorage.removeItem('strata-welcome-email'); } catch {}
    window.dispatchEvent(new Event('strata-data-cleared'));
    document.querySelectorAll('.privacy-clear-status').forEach(status => {
      status.textContent = 'Saved bag and email cleared from this browser. Sent messages and seller-held records require a separate request.';
    });
  }
  banner.querySelector('[data-essential]').onclick = () => {if(acknowledgment.checked)save(false);};
  banner.querySelector('[data-open-settings]').onclick = showSettings;
  dialog.querySelector('[data-dismiss]').onclick = () => dialog.close();
  dialog.querySelector('[data-save]').onclick = () => {if(dialogAcknowledgment.checked)save(toggle.checked);};
  dialog.querySelector('[data-clear]').onclick = clearData;
  document.querySelectorAll('[data-privacy-settings]').forEach(button => button.onclick = showSettings);
  document.querySelectorAll('[data-clear-site]').forEach(button => button.onclick = clearData);
  const form = document.getElementById('privacy-request');
  if (form) form.onsubmit = event => {
    event.preventDefault();
    const reference = document.getElementById('request-reference').value.trim();
    if (!reference) return;
    const text = ['EXTRUDE PRIVACY REQUEST',document.getElementById('request-type').value,
      'Reference: ' + reference,document.getElementById('request-notes').value.trim()].filter(Boolean).join('\n');
    const link = document.getElementById('privacy-send');
    const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    link.href = 'sms:+19084154730' + (isAppleMobile ? '&body=' : '?body=') + encodeURIComponent(text);
    link.hidden = false;
    document.getElementById('privacy-request-status').textContent = 'Request prepared. Open your texting app and tap Send to deliver it to (908) 415-4730.';
  };
})();

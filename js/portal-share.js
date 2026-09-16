(function initializePortalSharing(global) {
  'use strict';

  const buttons = Array.prototype.slice.call(document.querySelectorAll('[data-share-url]'));
  const toast = document.querySelector('[data-share-toast]');
  let toastTimer = 0;

  function fallbackCopy(value) {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, field.value.length);
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
    field.remove();
    return copied;
  }

  async function copyLink(url) {
    if (global.navigator.clipboard && typeof global.navigator.clipboard.writeText === 'function' && global.isSecureContext) {
      try { await global.navigator.clipboard.writeText(url); return true; } catch (error) { /* use final fallback */ }
    }
    return fallbackCopy(url);
  }

  function showToast(message, isError) {
    if (!toast) return;
    global.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle('is-error', Boolean(isError));
    toast.classList.add('is-visible');
    toastTimer = global.setTimeout(function () { toast.classList.remove('is-visible'); }, 3200);
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', async function () {
      const shareData = { title: button.dataset.shareTitle, text: button.dataset.shareText, url: button.dataset.shareUrl };
      if (typeof global.navigator.share === 'function') {
        try { await global.navigator.share(shareData); return; }
        catch (error) { if (error && error.name === 'AbortError') return; }
      }
      const copied = await copyLink(shareData.url);
      showToast(copied ? (button.dataset.copyMessage || 'Login link copied successfully.') : 'Unable to copy the link. Please copy it from the address bar.', !copied);
    });
  });
}(window));

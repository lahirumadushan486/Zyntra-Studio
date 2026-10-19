const ENABLE_ZYNTRA_PAGE_LOADER = true;

// To remove the loader later, delete its HTML block plus the zyntra-loader.css and zyntra-loader.js references.
(function initializeZyntraPageLoader() {
  "use strict";

  var loader = null;
  var safetyTimer = null;
  var exitTimer = null;
  var startedAt = Date.now();
  var sessionKey = "zyntra-page-loader-seen";
  var minimumDisplayTime = 780;
  var exitDuration = 380;
  var safetyTimeout = 1500;
  var isClosing = false;

  function removeLoader() {
    if (safetyTimer !== null) window.clearTimeout(safetyTimer);
    if (exitTimer !== null) window.clearTimeout(exitTimer);
    if (!loader) return;
    var loaderElement = loader;
    loader = null;
    try {
      loaderElement.style.pointerEvents = "none";
      loaderElement.style.display = "none";
      loaderElement.setAttribute("aria-hidden", "true");
      if (loaderElement.parentNode) loaderElement.parentNode.removeChild(loaderElement);
    } catch (removalError) {
      try {
        loaderElement.style.display = "none";
        if (typeof loaderElement.remove === "function") loaderElement.remove();
      } catch (fallbackError) {
        // The element was already made non-interactive before the removal attempt.
      }
    }
  }

  function closeLoader() {
    if (!loader || isClosing) return;
    try {
      isClosing = true;
      loader.classList.add("zyntra-loader-exit");
      loader.setAttribute("aria-hidden", "true");
      loader.style.pointerEvents = "none";
      exitTimer = window.setTimeout(removeLoader, exitDuration);
    } catch (exitError) {
      removeLoader();
    }
  }

  function closeWhenReady() {
    try {
      var remainingMinimum = Math.max(0, minimumDisplayTime - (Date.now() - startedAt));
      window.setTimeout(closeLoader, remainingMinimum);
    } catch (readyError) {
      removeLoader();
    }
  }

  try {
    loader = document.getElementById("zyntra-page-loader");
    if (!loader || !ENABLE_ZYNTRA_PAGE_LOADER) {
      removeLoader();
      return;
    }

    try {
      if (window.sessionStorage.getItem(sessionKey) === "1") {
        removeLoader();
        return;
      }
      window.sessionStorage.setItem(sessionKey, "1");
    } catch (storageError) {
      removeLoader();
      return;
    }

    safetyTimer = window.setTimeout(removeLoader, safetyTimeout);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", closeWhenReady, { once: true });
    } else {
      closeWhenReady();
    }
  } catch (loaderError) {
    removeLoader();
  } finally {
    // The loader never changes body scrolling, so existing page initialization remains independent.
  }
})();

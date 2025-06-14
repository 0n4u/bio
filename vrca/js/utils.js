import {
  CARD_HEIGHT_ESTIMATE,
  VISIBLE_BUFFER,
  IMAGE_LOAD_TIMEOUT,
  state,
  elements,
} from "./state.js";

const TRANSPARENT_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const ERROR_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgdmlld0JveD0nMCAwIDEwMCAxMDAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHJlY3Qgd2lkdGg9JzEwMCUnIGhlaWdodD0nMTAwJScgc3R5bGU9J2ZpbGw6I2VlZScvPjxsaW5lIHgxPScwJyB5MT0nMCcgeDI9JzEwMCcgeTI9JzEwMCcgc3R5bGU9J3N0cm9rZTojY2MwMDAnIHN0cm9rZS13aWR0aDoyJy8+PGxpbmUgeDE9JzEwMCcgeTE9JzAnIHgyPScwJyB5Mj0nMTAwJyBzdHlsZT0nc3Ryb2tlOiNjYzAwMDsgc3Ryb2tlLXdpZHRoOjInLz48L3N2Zz4=";

export function setLoading(isLoading, message = "", progress = 0) {
  if (isLoading) {
    elements.loadingText.textContent = message;
    elements.loadingIndicator.hidden = false;
    if (progress > 0) {
    }
  } else {
    elements.loadingText.textContent = "";
    elements.loadingIndicator.hidden = true;
  }
  state.isLoading = isLoading;
}

export function showToast(message, type = "info", duration = 5000) {
  const toastContainer =
    document.querySelector(".toast-container") ||
    (() => {
      const container = document.createElement("div");
      container.className = "toast-container";
      container.setAttribute("aria-live", "assertive");
      container.setAttribute("role", "alert");
      document.body.appendChild(container);
      return container;
    })();

  if (toastContainer.children.length > 5) {
    toastContainer.removeChild(toastContainer.children[0]);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute("role", "alert");
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, duration);
}

export function updateButtonStates() {
  const hasSelection = state.selectedAvatarIds.size > 0;
  elements.exportSelectedBtn.disabled = !hasSelection;
  elements.bulkDeleteBtn.disabled = !hasSelection;
  elements.anonymizeBtn.disabled = !hasSelection;
}

export function updateHeaderCount() {
  const total = state.vrcasData.length;
  const filtered = state.filteredVRCas.length;
  const selected = state.selectedAvatarIds.size;
  let countText = `VRCa Count: ${filtered}`;

  if (filtered !== total) {
    countText += ` (filtered from ${total})`;
  }

  if (selected > 0) {
    countText += ` | Selected: ${selected}`;
  }

  elements.headerTitle.textContent = `VRCAssetArchiveBrowser (${countText})`;
}

export function highlightText(text, query) {
  if (!query || !text) return text;

  const cacheKey = text + "|" + query;
  if (state.highlightCache && state.highlightCache.has(cacheKey)) {
    return state.highlightCache.get(cacheKey);
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const start = lowerText.indexOf(lowerQuery);

  if (start === -1) return text;

  const end = start + query.length;
  const result = [
    text.slice(0, start),
    `<span class="highlight">${text.slice(start, end)}</span>`,
    text.slice(end),
  ].join("");

  if (state.highlightCache) {
    state.highlightCache.set(cacheKey, result);
    if (state.highlightCache.size > 1000) {
      const firstKey = state.highlightCache.keys().next().value;
      state.highlightCache.delete(firstKey);
    }
  }

  return result;
}

export function sizeToBytes(sizeStr) {
  if (!sizeStr) return 0;

  const match = sizeStr.match(/^([\d.]+)\s*([KMG]?B)$/i);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  switch (unit) {
    case "KB":
      return num * 1024;
    case "MB":
      return num * 1024 * 1024;
    case "GB":
      return num * 1024 * 1024 * 1024;
    default:
      return num;
  }
}

export function debounce(func, wait, immediate = false) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

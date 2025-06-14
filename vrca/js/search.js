import {
  MODEL_LOAD_TIMEOUT,
  EMBEDDING_FIELDS,
  state,
  elements,
} from "./state.js";

import {
  setLoading,
  showToast,
  sizeToBytes,
  highlightText,
  updateButtonStates,
  updateHeaderCount,
} from "./utils.js";

import { updateCardPositions, sortResults, updateVisibleRange } from "./ui.js";

export const searchWorker = new Worker("./js/slave.js");

searchWorker.onmessage = ({ data }) => {
  const { type, filtered, error, message, progress } = data;

  if (type === "progress") {
    setLoading(true, message, progress);
    return;
  }

  if (type === "init_done") {
    state.workerReady = true;
    if (error) {
      showToast(`Search limited to basic matching: ${error}`, "warning");
    } else {
      showToast("Embeddings ready", "success");
    }

    state.workerSearchQueue.forEach(({ query, searchField }) => {
      searchWorker.postMessage({
        type: "search",
        data: {
          query,
          searchField,
        },
      });
    });

    state.workerSearchQueue = [];
    setLoading(false);
    return;
  }

  if (type === "result") {
    if (error) {
      showToast(`Search error: ${error}`, "error");
    } else {
      state.filteredVRCas = filtered || [];
      updateCardPositions();
      sortResults();
      updateVisibleRange();
      updateHeaderCount();
    }
    return;
  }
};

searchWorker.onerror = (error) => {
  console.error("Worker error:", error);
  showToast("Search worker error", "error");
  setLoading(false);
};

export function handleSearchInput() {
  const query = elements.searchBox.value.trim();
  if (query.length >= 2) showSearchSuggestions(query);
  else hideSearchSuggestions();
}

export function showSearchSuggestions(partial) {
  if (!partial || partial.length < 2) {
    hideSearchSuggestions();
    return;
  }

  if (state.suggestionCache.has(partial)) {
    renderSuggestions(state.suggestionCache.get(partial));
    return;
  }

  const suggestions = Array.from(
    new Set(
      state.vrcasData.flatMap((item) =>
        EMBEDDING_FIELDS.map((field) => (item[field] || "").toLowerCase())
      )
    )
  )
    .filter((text) => text.includes(partial.toLowerCase()) && text.length > 0)
    .slice(0, 20);

  state.currentSearchSuggestions = suggestions;
  state.suggestionCache.set(partial, suggestions);
  renderSuggestions(suggestions);
}

export function hideSearchSuggestions() {
  const suggestionBox = document.getElementById("searchSuggestions");
  if (suggestionBox) suggestionBox.style.display = "none";
}

export function renderSuggestions(suggestions) {
  let suggestionBox = document.getElementById("searchSuggestions");

  if (!suggestionBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.id = "searchSuggestions";
    suggestionBox.className = "search-suggestions";
    elements.searchBox.parentNode.appendChild(suggestionBox);
  }

  const startIndex = 0;
  const endIndex = Math.min(suggestions.length, 20);
  const visibleSuggestions = suggestions.slice(startIndex, endIndex);

  suggestionBox.innerHTML = visibleSuggestions
    .map((s) => {
      return `<div class="suggestion" data-suggestion="${s}" tabindex="0">${s}</div>`;
    })
    .join("");

  suggestionBox.style.display = "block";

  suggestionBox.querySelectorAll(".suggestion").forEach((suggestion) => {
    suggestion.addEventListener("click", () => {
      elements.searchBox.value = suggestion.dataset.suggestion;
      vectorSearch(true);
      hideSearchSuggestions();
    });
  });
}

export function handleSearchKeydown(e) {
  if (e.key === "Enter") {
    vectorSearch(true);
    elements.searchBox.blur();
  } else if (e.key === "Escape") {
    elements.searchBox.blur();
    hideSearchSuggestions();
  }
}

export async function vectorSearch(forceSearch = false) {
  const query = elements.searchBox.value.trim();
  const searchField = elements.searchField.value;

  if (state.currentSearchAbortController) {
    state.currentSearchAbortController.abort();
    state.currentSearchAbortController = null;
  }

  if (!forceSearch && query === state.lastQuery) return;

  state.lastQuery = query;
  setLoading(true, "Searching...");
  state.currentSearchAbortController = new AbortController();
  const abortSignal = state.currentSearchAbortController.signal;

  try {
    if (!query) {
      state.filteredVRCas = [...state.vrcasData];
      updateCardPositions();
      sortResults();
      updateVisibleRange();
      updateHeaderCount();
      return;
    }
    if (searchField === "avatarId" || searchField === "userId") {
      const exactMatch = state.vrcasData.filter((item) => {
        const idValue = String(item[searchField] || "").toLowerCase();
        return idValue === query.toLowerCase();
      });

      state.filteredVRCas = exactMatch;
      updateCardPositions();
      sortResults();
      updateVisibleRange();
      updateHeaderCount();
      return;
    }

    if (!state.workerReady) {
      state.workerSearchQueue.push({
        query,
        searchField,
      });
      return;
    }

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Search timeout")), MODEL_LOAD_TIMEOUT)
    );

    const searchPromise = new Promise((resolve) => {
      const workerHandler = ({ data }) => {
        if (data.type === "result") {
          searchWorker.removeEventListener("message", workerHandler);
          resolve(data);
        }
      };

      searchWorker.addEventListener("message", workerHandler);
      searchWorker.postMessage({
        type: "search",
        data: {
          query,
          searchField,
        },
      });

      abortSignal.addEventListener("abort", () => {
        searchWorker.postMessage({
          type: "abort",
        });
      });
    });

    const result = await Promise.race([searchPromise, timeoutPromise]);

    if (result.error) {
      showToast(`Search error: ${result.error}`, "error");
    }

    state.filteredVRCas = result.filtered || [];
    updateCardPositions();
    sortResults();
    updateVisibleRange();
    updateHeaderCount();
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Search error:", error);
      showToast("Search failed, using simple search", "warning");
      state.filteredVRCas = state.vrcasData.filter((item) => {
        const fieldValue = String(item[searchField] || "").toLowerCase();
        const queryLower = query.toLowerCase();

        if (searchField === "avatarId" || searchField === "userId") {
          return fieldValue === queryLower;
        }

        return fieldValue.includes(queryLower);
      });

      updateCardPositions();
      sortResults();
      updateVisibleRange();
      updateHeaderCount();
    }
  } finally {
    state.currentSearchAbortController = null;
    setLoading(false);
  }
}

export function resetSearch() {
  if (state.currentSearchAbortController) {
    state.currentSearchAbortController.abort();
    state.currentSearchAbortController = null;
  }
  setLoading(false);
  elements.searchBox.value = "";
  state.lastQuery = "";
  state.filteredVRCas = [...state.vrcasData];
  updateCardPositions();
  sortResults();
  updateVisibleRange();
  updateHeaderCount();
  hideSearchSuggestions();
}

export async function bulkDelete() {
  if (state.selectedAvatarIds.size === 0) {
    showToast("No items selected for deletion", "warning");
    return;
  }
  if (!confirm(`Delete ${state.selectedAvatarIds.size} selected items?`)) {
    return;
  }
  try {
    const deletedCount = state.selectedAvatarIds.size;
    const remaining = state.vrcasData.filter(
      (item) => !state.selectedAvatarIds.has(item.avatarId)
    );

    state.vrcasData = remaining;
    state.filteredVRCas = remaining.filter((item) =>
      state.filteredVRCas.some((f) => f.avatarId === item.avatarId)
    );
    state.selectedAvatarIds.clear();

    updateCardPositions();
    updateVisibleRange();
    updateHeaderCount();

    showToast(`Deleted ${deletedCount} items`, "success");
  } catch (error) {
    console.error("Bulk delete error:", error);
    showToast("Failed to delete items", "error");
  }
}

export async function anonymizeData() {
  if (state.selectedAvatarIds.size === 0) {
    showToast("No items selected for anonymization", "warning");
    return;
  }
  if (!confirm(`Anonymize ${state.selectedAvatarIds.size} selected items?`)) {
    return;
  }
  try {
    const anonymizedCount = state.selectedAvatarIds.size;
    const anonymized = state.vrcasData.map((item) => {
      if (state.selectedAvatarIds.has(item.avatarId)) {
        return {
          ...item,
          author: "Anonymous",
          userId: "usr_anonymous",
          description: "Anonymized data",
        };
      }
      return item;
    });

    state.vrcasData = anonymized;
    state.filteredVRCas = anonymized.filter((item) =>
      state.filteredVRCas.some((f) => f.avatarId === item.avatarId)
    );
    state.selectedAvatarIds.clear();

    updateCardPositions();
    updateVisibleRange();
    updateHeaderCount();

    showToast(`Anonymized ${anonymizedCount} items`, "success");
  } catch (error) {
    console.error("Anonymization error:", error);
    showToast("Failed to anonymize data", "error");
  }
}

export async function exportSelected() {
  if (state.selectedAvatarIds.size === 0) {
    showToast("No items selected for export", "warning");
    return;
  }

  try {
    const selected = state.filteredVRCas.filter((item) =>
      state.selectedAvatarIds.has(item.avatarId)
    );
    const blob = new Blob([JSON.stringify(selected, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const dlAnchor = document.createElement("a");
    dlAnchor.href = url;
    dlAnchor.download = `vrca_export_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    document.body.removeChild(dlAnchor);

    setTimeout(() => URL.revokeObjectURL(url), 100);
    showToast(`Exported ${selected.length} items`, "success");
  } catch (error) {
    console.error("Export failed:", error);
    showToast("Export failed", "error");
  }
}

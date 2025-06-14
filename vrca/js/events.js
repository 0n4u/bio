import { debounce, updateButtonStates } from "./utils.js";

import { elements, state, DEBOUNCE_DELAY } from "./state.js";

import { updateVisibleRange, toggleSortDirection } from "./ui.js";

import {
  handleSearchInput,
  handleSearchKeydown,
  vectorSearch,
  resetSearch,
  exportSelected,
} from "./search.js";

export function setupEventListeners() {
  elements.container.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const card = e.target.closest(".vrca-card");
      if (card) {
        const link = card.querySelector(".avatar-link");
        if (link) link.click();
        e.preventDefault();
      }
    }
  });

  elements.bulkSelectAll.addEventListener("change", () => {
    const checked = elements.bulkSelectAll.checked;

    if (checked) {
      state.filteredVRCas.forEach((item) => {
        state.selectedAvatarIds.add(item.avatarId);
      });
    } else {
      state.selectedAvatarIds.clear();
    }

    updateVisibleRange();
    updateButtonStates();
  });

  elements.exportSelectedBtn.addEventListener("click", exportSelected);
  elements.searchBox.addEventListener(
    "input",
    debounce(handleSearchInput, DEBOUNCE_DELAY)
  );
  elements.searchBox.addEventListener("keydown", handleSearchKeydown);

  elements.searchBtn.addEventListener("click", () => vectorSearch(true));
  elements.refreshBtn.addEventListener("click", resetSearch);
  elements.sortOrderBtn.addEventListener("click", toggleSortDirection);

  elements.searchField.addEventListener("change", () => {
    state.lastQuery = "";
    resetSearch();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      resetSearch();
    } else if (e.ctrlKey && e.key === "f") {
      e.preventDefault();
      elements.searchBox.focus();
    }
  });
}

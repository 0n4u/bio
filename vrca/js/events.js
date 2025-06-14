import { debounce } from "./utils.js";
import { elements, state, DEBOUNCE_DELAY } from "./state.js";
import { updateVisibleRange, toggleSortDirection } from "./ui.js";
import {
  handleSearchInput,
  handleSearchKeydown,
  vectorSearch,
  resetSearch,
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

  document.addEventListener("appReady", () => {
    elements.searchBox.disabled = false;
    elements.searchBtn.disabled = false;
    elements.refreshBtn.disabled = false;
    elements.sortOrderBtn.disabled = false;
    elements.searchField.disabled = false;
  });
}

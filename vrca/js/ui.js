import {
  CARD_HEIGHT_ESTIMATE,
  VISIBLE_BUFFER,
  IMAGE_LOAD_TIMEOUT,
  state,
  elements,
} from "./state.js";

import {
  highlightText,
  updateButtonStates,
  showToast,
  sizeToBytes,
  debounce,
} from "./utils.js";

const FALLBACK_IMAGE_SRC =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjZGRkZGRkIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkeT0iLjM1ZW0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTFweCIgZmlsbD0iI2ZmZiI+SW1hZ2UgRXJyb3I8L3RleHQ+PC9zdmc+";

export function initVirtualScroll() {
  updateCardPositions();
  elements.container.addEventListener("scroll", handleScroll, {
    passive: true,
  });

  const resizeObserver = new ResizeObserver(() => {
    state.containerHeight = elements.container.clientHeight;
    updateVisibleRange();
  });

  resizeObserver.observe(elements.container);
  updateVisibleRange();
}

export function updateCardPositions() {
  const totalHeight = state.filteredVRCas.length * CARD_HEIGHT_ESTIMATE;

  if (elements.spacer) {
    elements.spacer.style.height = `${totalHeight}px`;
  } else {
    elements.scrollContent.style.height = `${totalHeight}px`;
  }

  state.cardPositions = [];
  let top = 0;
  for (let i = 0; i < state.filteredVRCas.length; i++) {
    state.cardPositions.push(top);
    top += CARD_HEIGHT_ESTIMATE;
  }
}

const handleScroll = debounce(() => {
  if (!state.isLoading) {
    state.scrollTop = elements.container.scrollTop;
    updateVisibleRange();
  }
}, 16);

export function updateVisibleRange() {
  if (state.filteredVRCas.length === 0) {
    state.visibleItemRange = [0, 0];
    renderVisibleCards();
    return;
  }

  const scrollTop = elements.container.scrollTop;
  const containerHeight =
    elements.container.clientHeight || state.containerHeight;

  const startIdx = Math.max(
    0,
    Math.floor(scrollTop / CARD_HEIGHT_ESTIMATE) - VISIBLE_BUFFER
  );
  const endIdx = Math.min(
    state.filteredVRCas.length,
    Math.ceil((scrollTop + containerHeight) / CARD_HEIGHT_ESTIMATE) +
      VISIBLE_BUFFER
  );

  if (
    startIdx !== state.visibleItemRange[0] ||
    endIdx !== state.visibleItemRange[1]
  ) {
    state.visibleItemRange = [startIdx, endIdx];
    renderVisibleCards();
  }
}

export function renderVisibleCards() {
  const [startIdx, endIdx] = state.visibleItemRange;
  const fragment = document.createDocumentFragment();
  const existingCards = new Map();

  Array.from(elements.scrollContent.children).forEach((card) => {
    if (card.dataset.index) {
      existingCards.set(parseInt(card.dataset.index), card);
    }
  });

  existingCards.forEach((card, index) => {
    if (index < startIdx || index >= endIdx) {
      cleanupCardImages(card);
      card.remove();
    }
  });

  for (let i = startIdx; i < endIdx; i++) {
    const vrca = state.filteredVRCas[i];
    let card = existingCards.get(i);

    if (!card) {
      const cachedCard = state.renderCache?.get(vrca.avatarId);
      card = cachedCard
        ? cachedCard.cloneNode(true)
        : createCardElement(vrca, state.lastQuery);

      if (!cachedCard && state.renderCache) {
        state.renderCache.set(vrca.avatarId, card.cloneNode(true));
      }

      card.dataset.index = i;
      card.style.position = "absolute";
      card.style.top = `${state.cardPositions[i]}px`;
      card.style.width = "100%";
    }

    const checkbox = card.querySelector(".bulkSelectItem");
    if (checkbox) {
      checkbox.checked = state.selectedAvatarIds.has(vrca.avatarId);
    }

    fragment.appendChild(card);
  }

  elements.scrollContent.appendChild(fragment);

  initImageObserver();
}

function cleanupCardImages(card) {
  const images = card.querySelectorAll("img");
  images.forEach((img) => {
    const timeoutId = state.pendingImageLoads?.get(img);
    if (timeoutId) {
      clearTimeout(timeoutId);
      state.pendingImageLoads.delete(img);
    }
    if (state.imageObserver) {
      state.imageObserver.unobserve(img);
    }
  });
}

export function initImageObserver() {
  if (state.imageObserver) {
    state.imageObserver.disconnect();
    state.pendingImageLoads?.clear();
  }

  state.imageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          if (src) {
            loadImageWithFallback(img, src);
            state.imageObserver.unobserve(img);
          }
        }
      });
    },
    {
      rootMargin: "300px 0px",
    }
  );

  document.querySelectorAll("img[data-src]").forEach((img) => {
    state.imageObserver.observe(img);
  });
}

function loadImageWithFallback(img, src) {
  if (img.src === src) return;

  img.style.opacity = 0;

  const tempImg = new Image();
  tempImg.src = src;

  if ("decode" in tempImg) {
    tempImg
      .decode()
      .then(() => {
        img.src = src;
        img.style.opacity = 1;
      })
      .catch(() => {
        img.src = FALLBACK_IMAGE_SRC;
        img.style.opacity = 1;
      })
      .finally(() => {
        clearImageTimeout(img);
      });
  } else {
    tempImg.onload = () => {
      img.src = src;
      img.style.opacity = 1;
      clearImageTimeout(img);
    };
    tempImg.onerror = () => {
      img.src = FALLBACK_IMAGE_SRC;
      img.style.opacity = 1;
      clearImageTimeout(img);
    };
  }

  const timeoutId = setTimeout(() => {
    if (!img.complete) {
      img.dispatchEvent(new Event("error"));
    }
  }, IMAGE_LOAD_TIMEOUT);

  if (!state.pendingImageLoads) {
    state.pendingImageLoads = new Map();
  }
  state.pendingImageLoads.set(img, timeoutId);
}

function clearImageTimeout(img) {
  if (state.pendingImageLoads) {
    const timeoutId = state.pendingImageLoads.get(img);
    if (timeoutId) {
      clearTimeout(timeoutId);
      state.pendingImageLoads.delete(img);
    }
  }
}

export function createCardElement(vrca, query) {
  const cacheKey = `${vrca.avatarId}_${query || "noquery"}`;
  if (state.renderCache && state.renderCache.has(cacheKey)) {
    const cachedCard = state.renderCache.get(cacheKey).cloneNode(true);
    const checkbox = cachedCard.querySelector(".bulkSelectItem");
    if (checkbox) {
      checkbox.checked = state.selectedAvatarIds?.has(vrca.avatarId) || false;
      checkbox.addEventListener("change", (e) => {
        if (!state.selectedAvatarIds) state.selectedAvatarIds = new Set();
        if (e.target.checked) {
          state.selectedAvatarIds.add(vrca.avatarId);
        } else {
          state.selectedAvatarIds.delete(vrca.avatarId);
        }
        updateButtonStates?.();
      });
    }
    return cachedCard;
  }

  const card = document.createElement("div");
  card.className = "vrca-card";
  card.setAttribute("role", "listitem");
  card.tabIndex = 0;
  card.dataset.avatarId = vrca.avatarId;
  card.setAttribute("aria-labelledby", `title-${vrca.avatarId}`);
  card.setAttribute("aria-describedby", `desc-${vrca.avatarId}`);
  card.style.contain = "content";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "bulkSelectItem";
  checkbox.dataset.avatarid = vrca.avatarId;
  checkbox.setAttribute("aria-label", `Select VRCA item ${vrca.title}`);
  checkbox.checked = state.selectedAvatarIds?.has(vrca.avatarId) || false;
  checkbox.addEventListener("change", (e) => {
    if (!state.selectedAvatarIds) state.selectedAvatarIds = new Set();
    if (e.target.checked) {
      state.selectedAvatarIds.add(vrca.avatarId);
    } else {
      state.selectedAvatarIds.delete(vrca.avatarId);
    }
    updateButtonStates?.();
  });
  card.appendChild(checkbox);

  const imageContainer = document.createElement("div");
  imageContainer.className = "image-container";

  const img = document.createElement("img");
  img.className = "vrca-image";
  img.loading = "lazy";
  img.dataset.src = vrca.image;
  img.alt = `Image of ${vrca.title}`;
  img.style.opacity = 0;

  const imageLink = document.createElement("a");
  imageLink.href = vrca.image;
  imageLink.target = "_blank";
  imageLink.rel = "noopener noreferrer";
  imageLink.appendChild(img);
  imageContainer.appendChild(imageLink);
  card.appendChild(imageContainer);

  const details = document.createElement("div");
  details.className = "vrca-details";

  const titleDiv = document.createElement("div");
  titleDiv.className = "vrca-title";

  const avatarLink = document.createElement("a");
  avatarLink.href = `https://vrchat.com/home/avatar/${vrca.avatarId}`;
  avatarLink.target = "_blank";
  avatarLink.rel = "noopener noreferrer";
  avatarLink.className = "avatar-link";
  avatarLink.id = `title-${vrca.avatarId}`;
  avatarLink.innerHTML = highlightText(vrca.title, query);
  titleDiv.appendChild(avatarLink);

  const authorLine = document.createElement("div");
  authorLine.className = "author-line";
  authorLine.innerHTML = `By <a href="https://vrchat.com/home/user/${
    vrca.userId
  }" target="_blank" rel="noopener noreferrer" class="author-link">${highlightText(
    vrca.author,
    query
  )}</a>`;
  titleDiv.appendChild(authorLine);
  details.appendChild(titleDiv);

  const metaRight = document.createElement("div");
  metaRight.className = "meta-right";

  const dateDiv = document.createElement("div");
  dateDiv.className = "date-time";
  dateDiv.textContent = vrca.dateTime;
  metaRight.appendChild(dateDiv);

  const versionSizeDiv = document.createElement("div");
  versionSizeDiv.textContent = `${vrca.version} | ${vrca.size}`;
  metaRight.appendChild(versionSizeDiv);
  details.appendChild(metaRight);

  const descDiv = document.createElement("div");
  descDiv.className = "vrca-description";
  descDiv.id = `desc-${vrca.avatarId}`;
  descDiv.innerHTML = `Description: ${highlightText(vrca.description, query)}`;
  details.appendChild(descDiv);

  card.appendChild(details);

  if (!state.renderCache) {
    state.renderCache = new Map();
  }
  state.renderCache.set(cacheKey, card.cloneNode(true));

  return card;
}

export function sortResults() {
  const field = elements.searchField?.value;
  if (!field || field === "avatarId" || field === "userId") return;

  state.filteredVRCas.sort((a, b) => {
    if (field === "dateTime") {
      return compareDates(a.dateTime, b.dateTime);
    }

    if (field === "size") {
      const aSize = sizeToBytes(a.size || "");
      const bSize = sizeToBytes(b.size || "");
      return state.sortAsc ? aSize - bSize : bSize - aSize;
    }

    const aValue = String(a[field] || "").toLowerCase();
    const bValue = String(b[field] || "").toLowerCase();
    return state.sortAsc
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  });
}

function compareDates(dateA, dateB) {
  const parseDate = (str) => {
    if (!str) return 0;
    const [datePart, timePart] = str.split("|").map((s) => s.trim());
    return new Date(`${datePart} ${timePart}`).getTime();
  };

  const aDate = parseDate(dateA);
  const bDate = parseDate(dateB);
  return state.sortAsc ? aDate - bDate : bDate - aDate;
}

export function toggleSortDirection() {
  state.sortAsc = !state.sortAsc;

  if (elements.sortOrderBtn) {
    const svg = elements.sortOrderBtn.querySelector("svg");
    if (svg) {
      svg.style.transform = state.sortAsc ? "rotate(180deg)" : "rotate(0)";
    }
    elements.sortOrderBtn.setAttribute(
      "aria-label",
      state.sortAsc ? "Sort descending" : "Sort ascending"
    );
  }

  sortResults();
  updateVisibleRange();
  showToast?.(`Sort order: ${state.sortAsc ? "Ascending" : "Descending"}`);
}

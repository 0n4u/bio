(async () => {
  const ITEMS_PER_PAGE = 20;
  const EMBEDDING_FIELDS = ['title', 'author', 'description'];
  const MAX_UNDO_STEPS = 5;
  const DEBOUNCE_DELAY = 400;
  const MODEL_LOAD_TIMEOUT = 15000;
  const CARD_HEIGHT_ESTIMATE = 220;
  const VISIBLE_BUFFER = 5;
  const IMAGE_LOAD_TIMEOUT = 5000;
  const DB_NAME = 'VRCAArchiveDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'vrcas';
  const $ = id => document.getElementById(id);
  const elements = {
    header: $("vrcaHeader"),
    container: $("vrcaContainer"),
    scrollContent: $("scrollContent"),
    searchField: $("searchField"),
    sortOrderBtn: $("sortOrderBtn"),
    searchBox: $("searchBox"),
    searchBtn: $("searchBtn"),
    refreshBtn: $("refreshBtn"),
    loadingIndicator: $("loadingIndicator"),
    loadingText: $("loadingText"),
    bulkSelectAll: $("bulkSelectAll"),
    exportSelectedBtn: $("exportSelectedBtn"),
    cancelSearchBtn: $("cancelSearchBtn"),
    searchHistoryDropdown: $("searchHistory"),
    loadingMoreIndicator: $("loadingMoreIndicator"),
    headerTitle: document.querySelector('.header-title')
  };
  const state = {
    vrcasData: [],
    filteredVRCas: [],
    renderedCount: 0,
    isLoading: false,
    lastQuery: '',
    workerReady: false,
    workerSearchQueue: [],
    sortAsc: false,
    searchHistory: JSON.parse(localStorage.getItem('vrcaSearchHistory') || '[]'),
    currentSearchSuggestions: [],
    currentSearchAbortController: null,
    visibleItemRange: [0, 0],
    pendingImageLoads: new Map(),
    intersectionObserver: null,
    imageObserver: null,
    db: null,
    selectedAvatarIds: new Set(),
    renderCache: new Map(),
    cardPositions: [],
    scrollTop: 0,
    containerHeight: 0,
    suggestionCache: new Map(),
    highlightCache: new Map()
  };

  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  function initVirtualScroll() {
    updateCardPositions();
    elements.container.addEventListener('scroll', handleScroll);
    const resizeObserver = new ResizeObserver(() => {
      state.containerHeight = elements.container.clientHeight;
      updateVisibleRange();
    });
    resizeObserver.observe(elements.container);
    updateVisibleRange();
  }

  function updateCardPositions() {
    state.cardPositions = [];
    let top = 0;
    for (let i = 0; i < state.filteredVRCas.length; i++) {
      state.cardPositions.push(top);
      top += CARD_HEIGHT_ESTIMATE;
    }
    elements.scrollContent.style.height = `${top}px`;
  }

  function handleScroll() {
    state.scrollTop = elements.container.scrollTop;
    updateVisibleRange();
  }

  function updateVisibleRange() {
    if (state.filteredVRCas.length === 0) {
      state.visibleItemRange = [0, 0];
      renderVisibleCards();
      return;
    }
    const startIdx = Math.max(0, Math.floor(state.scrollTop / CARD_HEIGHT_ESTIMATE) - VISIBLE_BUFFER);
    const endIdx = Math.min(
      state.filteredVRCas.length,
      startIdx + Math.ceil(state.containerHeight / CARD_HEIGHT_ESTIMATE) + VISIBLE_BUFFER * 2
    );
    state.visibleItemRange = [startIdx, endIdx];
    renderVisibleCards();
  }

  function renderVisibleCards() {
    const [startIdx, endIdx] = state.visibleItemRange;
    const fragment = document.createDocumentFragment();
    const existingCards = new Map();
    Array.from(elements.scrollContent.children).forEach(card => {
      if (card.dataset.index) {
        existingCards.set(parseInt(card.dataset.index), card);
      }
    });
    existingCards.forEach((card, index) => {
      if (index < startIdx || index >= endIdx) {
        elements.scrollContent.removeChild(card);
      }
    });
    for (let i = startIdx; i < endIdx; i++) {
      const vrca = state.filteredVRCas[i];
      let card = existingCards.get(i);
      if (!card) {
        const cachedCard = state.renderCache.get(vrca.avatarId);
        if (cachedCard) {
          card = cachedCard.cloneNode(true);
        } else {
          card = createCardElement(vrca, state.lastQuery);
          state.renderCache.set(vrca.avatarId, card.cloneNode(true));
        }
        card.dataset.index = i;
        card.style.position = 'absolute';
        card.style.top = `${state.cardPositions[i]}px`;
        card.style.width = '100%';
      }
      const checkbox = card.querySelector('.bulkSelectItem');
      if (checkbox) {
        checkbox.checked = state.selectedAvatarIds.has(vrca.avatarId);
      }
      fragment.appendChild(card);
    }
    elements.scrollContent.appendChild(fragment);
  }
  async function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (event) => {
        console.error('Database error:', event.target.error);
        reject(event.target.error);
      };
      request.onsuccess = (event) => {
        state.db = event.target.result;
        resolve(state.db);
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'avatarId'
          });
          store.createIndex('title', 'title', {
            unique: false
          });
          store.createIndex('author', 'author', {
            unique: false
          });
        }
      };
    });
  }
  async function loadDataFromDB() {
    if (!state.db) return [];
    return new Promise((resolve, reject) => {
      const transaction = state.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (event) => {
        console.error('Error loading data from DB:', event.target.error);
        resolve([]);
      };
    });
  }
  async function saveDataToDB(vrcas) {
    if (!state.db) return;
    return new Promise((resolve, reject) => {
      const transaction = state.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear().onsuccess = () => {
        const requests = vrcas.map(vrca => store.put(vrca));
        Promise.all(requests).then(() => {
          transaction.oncomplete = () => resolve();
        }).catch(error => {
          console.error('Error saving data to DB:', error);
          reject(error);
        });
      };
    });
  }
  const searchWorker = new Worker('./js/slave.js');
  searchWorker.onmessage = ({
    data
  }) => {
    const {
      type,
      filtered,
      error,
      progress,
      message
    } = data;
    if (type === 'progress') {
      setLoading(true, message);
      return;
    }
    if (type === 'init_done') {
      state.workerReady = true;
      if (error) {
        showToast(`Search limited to basic matching: ${error}`, 'warning');
      }
      state.workerSearchQueue.forEach(({
        query,
        searchField
      }) => {
        searchWorker.postMessage({
          type: 'search',
          data: {
            query,
            searchField
          }
        });
      });
      state.workerSearchQueue = [];
      setLoading(false);
    }
    if (type === 'result') {
      if (error) {
        showToast(`Search error: ${error}`, 'error');
        setLoading(false);
        return;
      }
      state.filteredVRCas = filtered || [];
      updateCardPositions();
      sortResults();
      updateVisibleRange();
      updateHeaderCount();
      setLoading(false);
      if (state.lastQuery) {
        updateSearchHistory(state.lastQuery);
      }
    }
  };
  searchWorker.onerror = (error) => {
    console.error('Worker error:', error);
    showToast('Search worker error', 'error');
    setLoading(false);
  };

  function sizeToBytes(sizeStr) {
    if (!sizeStr) return 0;
    const units = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3
    };
    const [val, unit] = sizeStr.split(' ');
    return parseFloat(val) * (units[unit.toUpperCase()] || 1);
  }
  const escapeRegExp = (() => {
    const cache = new Map();
    return (string) => {
      if (cache.has(string)) return cache.get(string);
      const result = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cache.set(string, result);
      return result;
    };
  })();

  function highlightText(text, query) {
    if (!query || !text) return text;
    const cacheKey = `${text}_${query}`;
    if (state.highlightCache && state.highlightCache.has(cacheKey)) {
      return state.highlightCache.get(cacheKey);
    }
    const regex = new RegExp(escapeRegExp(query), 'gi');
    const result = text.replace(regex, match => `<span class="highlight">${match}</span>`);
    if (!state.highlightCache) {
      state.highlightCache = new Map();
    }
    state.highlightCache.set(cacheKey, result);
    return result;
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  function setLoading(loading, message = '') {
    state.isLoading = loading;
    elements.loadingIndicator.hidden = !loading;
    elements.loadingText.textContent = message;
    elements.cancelSearchBtn.style.display = loading ? 'inline-block' : 'none';
    [
      elements.searchBtn,
      elements.refreshBtn,
      elements.searchBox,
      elements.searchField,
      elements.sortOrderBtn,
      elements.bulkSelectAll,
      elements.exportSelectedBtn
    ].forEach(el => el.disabled = loading);
    updateButtonStates();
  }

  function updateButtonStates() {
    elements.exportSelectedBtn.disabled = state.selectedAvatarIds.size === 0 || state.isLoading;
    elements.bulkSelectAll.checked = state.selectedAvatarIds.size === state.filteredVRCas.length && state.filteredVRCas.length > 0;
    elements.bulkSelectAll.indeterminate = state.selectedAvatarIds.size > 0 && state.selectedAvatarIds.size < state.filteredVRCas.length;
  }

  function updateHeaderCount() {
    if (elements.headerTitle) {
      elements.headerTitle.textContent = `VRCAssetArchiveBrowser (VRCA Count: ${state.filteredVRCas.length})`;
    }
  }

  function sortResults() {
    const field = elements.searchField.value;
    if (field === 'avatarId' || field === 'userId') {
      return;
    }
    state.filteredVRCas.sort((a, b) => {
      if (field === 'dateTime') {
        const aDate = new Date((a.dateTime || '').replace('|', '').trim());
        const bDate = new Date((b.dateTime || '').replace('|', '').trim());
        return state.sortAsc ? aDate - bDate : bDate - aDate;
      }
      if (field === 'size') {
        const aSize = sizeToBytes(a.size || '');
        const bSize = sizeToBytes(b.size || '');
        return state.sortAsc ? aSize - bSize : bSize - aSize;
      }
      let aValue = String(a[field] || '').toLowerCase();
      let bValue = String(b[field] || '').toLowerCase();
      return state.sortAsc ?
        aValue.localeCompare(bValue) :
        bValue.localeCompare(aValue);
    });
  }

  function toggleSortDirection() {
    state.sortAsc = !state.sortAsc;
    elements.sortOrderBtn.querySelector('svg').style.transform = state.sortAsc ? 'rotate(180deg)' : 'rotate(0)';
    elements.sortOrderBtn.setAttribute('aria-label', state.sortAsc ? 'Sort descending' : 'Sort ascending');
    sortResults();
    updateVisibleRange();
    showToast(`Sort order: ${state.sortAsc ? 'Ascending' : 'Descending'}`);
  }

  function renderSearchHistory() {
    if (!elements.searchHistoryDropdown) return;
    elements.searchHistoryDropdown.innerHTML = '';
    state.searchHistory.forEach(term => {
      const option = document.createElement('option');
      option.value = term;
      elements.searchHistoryDropdown.appendChild(option);
    });
  }

  function updateSearchHistory(query) {
    if (!query || state.searchHistory.includes(query)) return;
    state.searchHistory.unshift(query);
    if (state.searchHistory.length > 10) state.searchHistory.pop();
    localStorage.setItem('vrcaSearchHistory', JSON.stringify(state.searchHistory));
    renderSearchHistory();
  }

  function initImageObserver() {
    state.imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            state.imageObserver.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '100px 0px'
    });
  }

  function createCardElement(vrca, query) {
    const card = document.createElement('div');
    card.className = 'vrca-card';
    card.setAttribute('role', 'listitem');
    card.tabIndex = 0;
    card.dataset.avatarId = vrca.avatarId;
    card.setAttribute('aria-labelledby', `title-${vrca.avatarId}`);
    card.setAttribute('aria-describedby', `desc-${vrca.avatarId}`);
    card.style.contain = 'content';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'bulkSelectItem';
    checkbox.dataset.avatarid = vrca.avatarId;
    checkbox.setAttribute('aria-label', `Select VRCA item ${vrca.title}`);
    checkbox.checked = state.selectedAvatarIds.has(vrca.avatarId);
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.selectedAvatarIds.add(vrca.avatarId);
      } else {
        state.selectedAvatarIds.delete(vrca.avatarId);
      }
      updateButtonStates();
    });
    card.appendChild(checkbox);
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-container';
    const img = document.createElement('img');
    img.className = 'vrca-image';
    img.loading = 'lazy';
    img.dataset.src = vrca.image;
    img.alt = `Image of ${vrca.title}`;
    img.style.opacity = 0;
    img.onload = () => {
      clearTimeout(state.pendingImageLoads.get(img));
      state.pendingImageLoads.delete(img);
      img.style.opacity = 1;
    };
    img.onerror = () => {
      clearTimeout(state.pendingImageLoads.get(img));
      state.pendingImageLoads.delete(img);
      img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTE5IDV2MTRINVY1aDE0bTAtMmE1IDUgMCAwIDAgNS01SDVhNSA1IDAgMCAwLTUgNXYxNGE1IDUgMCAwIDAgNSA1aDE0YTUgNSAwIDAgMCA1LTVWNXoiLz48L3N2Zz4=';
      img.alt = `Failed to load image for ${vrca.title}`;
      img.style.opacity = 1;
    };
    state.imageObserver.observe(img);
    const imageLink = document.createElement('a');
    imageLink.href = vrca.image;
    imageLink.target = '_blank';
    imageLink.rel = 'noopener noreferrer';
    imageLink.appendChild(img);
    imageContainer.appendChild(imageLink);
    card.appendChild(imageContainer);
    const details = document.createElement('div');
    details.className = 'vrca-details';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'vrca-title';
    const avatarLink = document.createElement('a');
    avatarLink.href = `https://vrchat.com/home/avatar/${vrca.avatarId}`;
    avatarLink.target = '_blank';
    avatarLink.rel = 'noopener noreferrer';
    avatarLink.className = 'avatar-link';
    avatarLink.id = `title-${vrca.avatarId}`;
    avatarLink.innerHTML = highlightText(vrca.title, query);
    titleDiv.appendChild(avatarLink);
    const authorLine = document.createElement('div');
    authorLine.className = 'author-line';
    authorLine.innerHTML = `By <a href="https://vrchat.com/home/user/${vrca.userId}" target="_blank" rel="noopener noreferrer" class="author-link">${highlightText(vrca.author, query)}</a>`;
    titleDiv.appendChild(authorLine);
    details.appendChild(titleDiv);
    const metaRight = document.createElement('div');
    metaRight.className = 'meta-right';
    const dateDiv = document.createElement('div');
    dateDiv.className = 'date-time';
    dateDiv.textContent = vrca.dateTime;
    metaRight.appendChild(dateDiv);
    const versionSizeDiv = document.createElement('div');
    versionSizeDiv.textContent = `${vrca.version} | ${vrca.size}`;
    metaRight.appendChild(versionSizeDiv);
    details.appendChild(metaRight);
    const descDiv = document.createElement('div');
    descDiv.className = 'vrca-description';
    descDiv.id = `desc-${vrca.avatarId}`;
    descDiv.innerHTML = `Description: ${highlightText(vrca.description, query)}`;
    details.appendChild(descDiv);
    card.appendChild(details);
    return card;
  }

  function handleSearchInput() {
    const query = elements.searchBox.value.trim();
    if (query.length >= 2) {
      showSearchSuggestions(query);
    } else {
      hideSearchSuggestions();
    }
  }

  function showSearchSuggestions(partial) {
    if (!partial || partial.length < 2) {
      hideSearchSuggestions();
      return;
    }
    if (state.suggestionCache && state.suggestionCache.has(partial)) {
      renderSuggestions(state.suggestionCache.get(partial));
      return;
    }
    const suggestions = Array.from(
      new Set(
        state.vrcasData.flatMap(item =>
          EMBEDDING_FIELDS.map(field =>
            (item[field] || '').toLowerCase()
          )
        )
      )
    ).filter(text =>
      text.includes(partial.toLowerCase()) && text.length > 0
    ).slice(0, 5);
    state.currentSearchSuggestions = suggestions;
    if (!state.suggestionCache) {
      state.suggestionCache = new Map();
    }
    state.suggestionCache.set(partial, suggestions);
    renderSuggestions(suggestions);
  }

  function renderSuggestions(suggestions) {
    const suggestionBox = document.getElementById('searchSuggestions') ||
      document.createElement('div');
    suggestionBox.id = 'searchSuggestions';
    suggestionBox.className = 'search-suggestions';
    suggestionBox.innerHTML = suggestions.map(s =>
      `<div class="suggestion" data-suggestion="${s}" tabindex="0">${s}</div>`
    ).join('');
    if (!document.getElementById('searchSuggestions')) {
      elements.searchBox.parentNode.appendChild(suggestionBox);
    }
  }

  function hideSearchSuggestions() {
    const suggestionBox = document.getElementById('searchSuggestions');
    if (suggestionBox) {
      suggestionBox.remove();
    }
  }

  function handleSearchKeydown(e) {
    if (e.key === 'Enter') {
      vectorSearch(true);
      elements.searchBox.blur();
    } else if (e.key === 'Escape') {
      elements.searchBox.blur();
      hideSearchSuggestions();
    }
  }
  async function vectorSearch(forceSearch = false) {
    const query = elements.searchBox.value.trim();
    const searchField = elements.searchField.value;
    if (state.currentSearchAbortController) {
      state.currentSearchAbortController.abort();
      state.currentSearchAbortController = null;
    }
    if (!forceSearch && query === state.lastQuery) return;
    state.lastQuery = query;
    setLoading(true, 'Searching...');
    elements.cancelSearchBtn.style.display = 'inline-block';
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
      if (searchField === 'avatarId' || searchField === 'userId') {
        const exactMatch = state.vrcasData.filter(item => {
          const idValue = String(item[searchField] || '').toLowerCase();
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
          searchField
        });
        return;
      }
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Search timeout')), MODEL_LOAD_TIMEOUT)
      );
      const searchPromise = new Promise((resolve) => {
        const workerHandler = ({
          data
        }) => {
          if (data.type === 'result') {
            searchWorker.removeEventListener('message', workerHandler);
            resolve(data);
          }
        };
        searchWorker.addEventListener('message', workerHandler);
        searchWorker.postMessage({
          type: 'search',
          data: {
            query,
            searchField
          }
        });
        abortSignal.addEventListener('abort', () => {
          searchWorker.postMessage({
            type: 'abort'
          });
        });
      });
      const result = await Promise.race([searchPromise, timeoutPromise]);
      if (result.error) {
        showToast(`Search error: ${result.error}`, 'error');
      }
      state.filteredVRCas = result.filtered || [];
      updateCardPositions();
      sortResults();
      updateVisibleRange();
      updateHeaderCount();
      if (query) updateSearchHistory(query);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Search error:', error);
        showToast('Search failed, using simple search', 'warning');
        state.filteredVRCas = state.vrcasData.filter(item => {
          const fieldValue = String(item[searchField] || '').toLowerCase();
          const queryLower = query.toLowerCase();
          if (searchField === 'avatarId' || searchField === 'userId') {
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

  function cancelSearch() {
    if (state.currentSearchAbortController) {
      state.currentSearchAbortController.abort();
      state.currentSearchAbortController = null;
    }
    setLoading(false);
  }

  function resetSearch() {
    cancelSearch();
    elements.searchBox.value = '';
    state.lastQuery = '';
    state.filteredVRCas = [...state.vrcasData];
    updateCardPositions();
    sortResults();
    updateVisibleRange();
    updateHeaderCount();
    hideSearchSuggestions();
  }
  async function exportSelected() {
    if (state.selectedAvatarIds.size === 0) {
      showToast('No items selected for export', 'warning');
      return;
    }
    try {
      const selected = state.filteredVRCas.filter(item =>
        state.selectedAvatarIds.has(item.avatarId)
      );
      const blob = new Blob([JSON.stringify(selected, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const dlAnchor = document.createElement('a');
      dlAnchor.href = url;
      dlAnchor.download = `vrca_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(dlAnchor);
      dlAnchor.click();
      document.body.removeChild(dlAnchor);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      showToast(`Exported ${selected.length} items`, 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Export failed', 'error');
    }
  }

  function setupEventListeners() {
    elements.container.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.vrca-card');
        if (card) {
          const link = card.querySelector('.avatar-link');
          if (link) link.click();
          e.preventDefault();
        }
      }
    });
    elements.bulkSelectAll.addEventListener('change', () => {
      const checked = elements.bulkSelectAll.checked;
      if (checked) {
        state.filteredVRCas.forEach(item => {
          state.selectedAvatarIds.add(item.avatarId);
        });
      } else {
        state.selectedAvatarIds.clear();
      }
      updateVisibleRange();
      updateButtonStates();
    });
    elements.exportSelectedBtn.addEventListener('click', exportSelected);
    elements.cancelSearchBtn.addEventListener('click', cancelSearch);
    elements.searchBox.addEventListener('input', debounce(handleSearchInput, DEBOUNCE_DELAY));
    elements.searchBox.addEventListener('keydown', handleSearchKeydown);
    elements.searchBox.addEventListener('focus', () => {
      if (elements.searchBox.value.length >= 2) {
        showSearchSuggestions(elements.searchBox.value);
      }
    });
    elements.searchBox.addEventListener('blur', () => {
      setTimeout(hideSearchSuggestions, 200);
    });
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('suggestion')) {
        elements.searchBox.value = e.target.dataset.suggestion;
        hideSearchSuggestions();
        vectorSearch(true);
      }
    });
    elements.searchBtn.addEventListener('click', () => vectorSearch(true));
    elements.refreshBtn.addEventListener('click', resetSearch);
    elements.sortOrderBtn.addEventListener('click', toggleSortDirection);
    elements.searchField.addEventListener('change', () => {
      state.lastQuery = '';
      vectorSearch(true);
    });
  }
  async function init() {
    try {
      console.log("Initializing app...");
      await initDB();
      console.log("Database initialized");
      state.vrcasData = await loadDataFromDB();
      console.log("Data loaded from DB:", state.vrcasData.length);
      if (state.vrcasData.length === 0 && typeof vrcas !== 'undefined' && vrcas.length > 0) {
        console.log("Using hardcoded data from data.js");
        state.vrcasData = vrcas;
        await saveDataToDB(state.vrcasData);
      } else if (typeof vrcas === 'undefined') {
        console.log("vrcas data not found in data.js");
      }
      state.filteredVRCas = [...state.vrcasData];
      console.log("Total VRCA items:", state.vrcasData.length);
      initImageObserver();
      state.containerHeight = elements.container.clientHeight;
      initVirtualScroll();
      renderSearchHistory();
      setupEventListeners();
      sortResults();
      updateVisibleRange();
      updateHeaderCount();
      searchWorker.postMessage({
        type: 'init',
        data: {
          vrcas: state.vrcasData
        }
      });
      setLoading(true, 'Initializing search...');
      window.addEventListener('beforeunload', () => {
        state.pendingImageLoads.forEach((timeout, img) => {
          clearTimeout(timeout);
        });
      });
    } catch (error) {
      console.error('Initialization error:', error);
      showToast('Failed to initialize database', 'error');
      if (typeof vrcas !== 'undefined' && vrcas.length > 0) {
        state.vrcasData = vrcas;
        state.filteredVRCas = [...state.vrcasData];
      } else {
        state.vrcasData = [];
        state.filteredVRCas = [];
      }
      renderSearchHistory();
      setupEventListeners();
      sortResults();
      updateVisibleRange();
      updateHeaderCount();
      searchWorker.postMessage({
        type: 'init',
        data: {
          vrcas: state.vrcasData
        }
      });
      setLoading(true, 'Initializing search...');
    }
  }
  await init();
})();
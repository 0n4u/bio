(async () => {
  const ITEMS_PER_PAGE = 10;
  const EMBEDDING_FIELDS = ['title', 'author', 'description'];

  const $ = id => document.getElementById(id);

  const headerEl = $("vrcaHeader");
  const container = $("vrcaContainer");
  const searchFieldEl = $("searchField");
  const sortFieldEl = $("sortField");
  const searchBoxEl = $("searchBox");
  const searchBtn = $("searchBtn");
  const refreshBtn = $("refreshBtn");
  const loadingIndicator = $("loadingIndicator");
  const bulkSelectAllCheckbox = $("bulkSelectAll");
  const exportSelectedBtn = $("exportSelectedBtn");
  const deleteSelectedBtn = $("deleteSelectedBtn"); // new button for deletion
  const searchHistoryDropdown = $("searchHistory"); // new dropdown for history

  const loadingMoreIndicator = document.createElement('div');
  loadingMoreIndicator.textContent = "Loading more...";
  loadingMoreIndicator.style.cssText = `
    text-align:center; 
    padding:8px 0; 
    display:none; 
    font-style: italic; 
    color: #666;
    animation: pulse 1.5s infinite alternate;
  `;
  container.after(loadingMoreIndicator);

  const vrcasData = [...vrcas];
  let filteredVRCa = [...vrcasData];
  let renderedCount = 0;
  let isLoading = false;
  let lastQuery = '';
  let workerReady = false;
  let workerSearchQueue = [];
  let sortAsc = false; // new: ascending/descending toggle
  let searchHistory = JSON.parse(localStorage.getItem('vrcaSearchHistory') || '[]');

  const searchWorker = new Worker('./js/slave.js');

  // --- UTILITIES ---
  const sizeToBytes = sizeStr => {
    if (!sizeStr) return 0;
    const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
    const [val, unit] = sizeStr.split(' ');
    return parseFloat(val) * (units[unit.toUpperCase()] || 1);
  };

  const escapeRegExp = string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const highlightText = (text, query) => {
    if (!query) return text;
    const regex = new RegExp(escapeRegExp(query), 'gi');
    return text.replace(regex, match => `<span class="highlight">${match}</span>`);
  };

  function setLoading(loading) {
    isLoading = loading;
    loadingIndicator.style.display = loading ? 'inline-block' : 'none';
    [searchBtn, refreshBtn, searchBoxEl, searchFieldEl, sortFieldEl, bulkSelectAllCheckbox, deleteSelectedBtn]
      .forEach(el => el.disabled = loading);
    updateExportButtonState();
  }

  function updateExportButtonState() {
    const checkboxes = container.querySelectorAll('.bulkSelectItem');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    exportSelectedBtn.disabled = checkedCount === 0;
    deleteSelectedBtn.disabled = checkedCount === 0;
    bulkSelectAllCheckbox.checked = checkedCount === checkboxes.length && checkboxes.length > 0;
    bulkSelectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  }

  // --- SORTING ---
  const sortResults = () => {
    const field = sortFieldEl.value;
    filteredVRCa.sort((a, b) => {
      let comp = 0;
      if (field === 'dateTime') {
        comp = new Date(b.dateTime.replace('|', '').trim()) - new Date(a.dateTime.replace('|', '').trim());
      } else if (field === 'size') {
        comp = sizeToBytes(b.size) - sizeToBytes(a.size);
      } else {
        comp = (a[field] || '').localeCompare((b[field] || ''), undefined, { sensitivity: 'base' });
      }
      return sortAsc ? -comp : comp;
    });
  };

  // --- CREATE CARD ---
  const createCardElement = ({ title, author, description, image, avatarId, userId, dateTime, version, size }, query) => {
    const card = document.createElement('div');
    card.className = 'vrca-card';
    card.setAttribute('role', 'listitem');
    card.tabIndex = 0;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'bulkSelectItem';
    checkbox.setAttribute('data-avatarid', avatarId);
    checkbox.setAttribute('aria-label', `Select VRCA item ${title}`);
    card.appendChild(checkbox);

    const imageLink = document.createElement('a');
    imageLink.href = image;
    imageLink.target = '_blank';
    imageLink.rel = 'noopener noreferrer';

    const img = document.createElement('img');
    img.className = 'vrca-image';
    img.loading = 'lazy';
    img.src = image;
    img.alt = `Image of ${title}`;
    img.onerror = () => { img.src = 'fallback.png'; };

    imageLink.appendChild(img);
    card.appendChild(imageLink);

    const details = document.createElement('div');
    details.className = 'vrca-details';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'vrca-title';

    const avatarLink = document.createElement('a');
    avatarLink.href = `https://vrchat.com/home/avatar/${avatarId}`;
    avatarLink.target = '_blank';
    avatarLink.rel = 'noopener noreferrer';
    avatarLink.className = 'avatar-link';
    avatarLink.innerHTML = highlightText(title, query);

    titleDiv.appendChild(avatarLink);

    const authorLine = document.createElement('div');
    authorLine.className = 'author-line';
    authorLine.innerHTML = `By <a href="https://vrchat.com/home/user/${userId}" target="_blank" rel="noopener noreferrer" class="author-link">${highlightText(author, query)}</a>`;
    titleDiv.appendChild(authorLine);

    details.appendChild(titleDiv);

    const metaRight = document.createElement('div');
    metaRight.className = 'meta-right';

    const dateDiv = document.createElement('div');
    dateDiv.className = 'date-time';
    dateDiv.textContent = dateTime;
    metaRight.appendChild(dateDiv);

    const versionSizeDiv = document.createElement('div');
    versionSizeDiv.textContent = `${version} | ${size}`;
    metaRight.appendChild(versionSizeDiv);

    details.appendChild(metaRight);

    const descDiv = document.createElement('div');
    descDiv.className = 'vrca-description';
    descDiv.innerHTML = `Description: ${highlightText(description, query)}`;
    details.appendChild(descDiv);

    card.appendChild(details);

    return card;
  };

  // --- RENDER ---
  const renderMoreItems = () => {
    if (renderedCount >= filteredVRCa.length) return false;
    const fragment = document.createDocumentFragment();
    const query = searchBoxEl.value.trim();

    for (let i = renderedCount; i < Math.min(renderedCount + ITEMS_PER_PAGE, filteredVRCa.length); i++) {
      const card = createCardElement(filteredVRCa[i], query);
      fragment.appendChild(card);
    }
    container.appendChild(fragment);
    renderedCount += Math.min(ITEMS_PER_PAGE, filteredVRCa.length - renderedCount);
    updateExportButtonState();
    return true;
  };

  const renderInitialItems = () => {
    container.innerHTML = '';
    renderedCount = 0;
    if (!renderMoreItems()) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-msg';
      emptyMsg.tabIndex = 0;
      emptyMsg.textContent = 'No results found.';
      container.appendChild(emptyMsg);
    }
    updateExportButtonState();
  };

  // --- KEYBOARD NAVIGATION ---
  container.addEventListener('keydown', e => {
    const focusableCards = [...container.querySelectorAll('.vrca-card')];
    if (!focusableCards.length) return;

    const currentIndex = focusableCards.indexOf(document.activeElement);
    if (currentIndex === -1) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(currentIndex + 1, focusableCards.length - 1);
      focusableCards[nextIndex].focus();
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(currentIndex - 1, 0);
      focusableCards[prevIndex].focus();
    }
  });

  // --- SCROLL INFINITE LOAD ---
  let ticking = false;
  container.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        if (container.scrollHeight - (container.scrollTop + container.clientHeight) <= 150 &&
          (!loadingMoreIndicator.style.display || loadingMoreIndicator.style.display === 'none')) {
          if (renderedCount < filteredVRCa.length) {
            loadingMoreIndicator.style.display = 'block';
            setTimeout(() => { // animation delay for UX
              renderMoreItems();
              loadingMoreIndicator.style.display = 'none';
            }, 300);
          }
        }
        ticking = false;
      });
      ticking = true;
    }
  });

  // --- BULK SELECT AND ACTIONS ---
  container.addEventListener('change', e => {
    if (e.target.classList.contains('bulkSelectItem')) updateExportButtonState();
  });

  bulkSelectAllCheckbox.addEventListener('change', () => {
    const checked = bulkSelectAllCheckbox.checked;
    container.querySelectorAll('.bulkSelectItem').forEach(cb => cb.checked = checked);
    updateExportButtonState();
  });

  exportSelectedBtn.addEventListener('click', () => {
    const checkboxes = container.querySelectorAll('.bulkSelectItem');
    const selected = [];
    let idx = 0;
    for (const cb of checkboxes) {
      if (cb.checked && filteredVRCa[idx]) selected.push(filteredVRCa[idx]);
      idx++;
    }
    if (!selected.length) return;

    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const dlAnchor = document.createElement('a');
    dlAnchor.href = url;

    // dynamic filename with timestamp
    dlAnchor.download = `vrca_export_${new Date().toISOString().slice(0,10)}.json`;

    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    document.body.removeChild(dlAnchor);
    URL.revokeObjectURL(url);
  });

  // New: delete selected with confirmation
  deleteSelectedBtn.addEventListener('click', () => {
    const checkboxes = container.querySelectorAll('.bulkSelectItem');
    const selectedIndexes = [];
    let idx = 0;
    for (const cb of checkboxes) {
      if (cb.checked) selectedIndexes.push(idx);
      idx++;
    }
    if (!selectedIndexes.length) return;
    if (!confirm(`Delete ${selectedIndexes.length} selected VRCA items? This action is irreversible.`)) return;

    // Remove from data source
    filteredVRCa = filteredVRCa.filter((_, i) => !selectedIndexes.includes(i));
    // Also remove from original data to keep in sync
    for (const i of selectedIndexes.sort((a,b) => b - a)) {
      vrcasData.splice(i, 1);
    }

    renderInitialItems();
  });

  // --- SEARCH HISTORY ---
  function updateSearchHistory(query) {
    if (!query || searchHistory.includes(query)) return;
    searchHistory.unshift(query);
    if (searchHistory.length > 10) searchHistory.pop();
    localStorage.setItem('vrcaSearchHistory', JSON.stringify(searchHistory));
    renderSearchHistory();
  }

  function renderSearchHistory() {
    searchHistoryDropdown.innerHTML = '';
    searchHistory.forEach(term => {
      const option = document.createElement('option');
      option.value = term;
      searchHistoryDropdown.appendChild(option);
    });
  }

  renderSearchHistory();

  searchHistoryDropdown.addEventListener('change', () => {
    const val = searchHistoryDropdown.value;
    if (val) {
      searchBoxEl.value = val;
      vectorSearch(true);
    }
  });

  // --- SEARCH ---
  let debounceTimer = null;
  const debounceDelay = 600;

  const vectorSearch = (forceSearch = false) => {
    const query = searchBoxEl.value.trim();
    const searchField = searchFieldEl.value;

    if (!workerReady) {
      setLoading(true);
      workerSearchQueue.push({ query, searchField });
      return;
    }

    if (!forceSearch && query === lastQuery) return;
    lastQuery = query;
    setLoading(true);
    searchWorker.postMessage({ type: 'search', data: { query, searchField } });
  };

  searchBoxEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => vectorSearch(), debounceDelay);
  });

  searchBoxEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      clearTimeout(debounceTimer);
      vectorSearch(true);
      searchBoxEl.blur();
    }
  });

  sortFieldEl.addEventListener('click', () => { // toggle asc/desc on click
    sortAsc = !sortAsc;
    sortResults();
    renderInitialItems();
  });

  searchFieldEl.addEventListener('change', () => {
    lastQuery = '';
    vectorSearch(true);
  });

  searchBtn.addEventListener('click', () => vectorSearch(true));

  refreshBtn.addEventListener('click', () => {
    searchBoxEl.value = '';
    lastQuery = '';
    filteredVRCa = [...vrcasData];
    sortResults();
    renderInitialItems();
  });

  // --- WORKER MESSAGES ---
  searchWorker.onmessage = ({ data }) => {
    const { type, filtered } = data;
    if (type === 'init_done') {
      workerReady = true;
      workerSearchQueue.forEach(({ query, searchField }) =>
        searchWorker.postMessage({ type: 'search', data: { query, searchField } })
      );
      workerSearchQueue = [];
      setLoading(false);
    }
    if (type === 'result') {
      filteredVRCa = filtered;
      sortResults();
      renderInitialItems();
      setLoading(false);

      // save search to history on success
      if (lastQuery) updateSearchHistory(lastQuery);
      
      // fallback: if no results, perform fuzzy filter locally
      if (!filteredVRCa.length && lastQuery) {
        const fallbackResults = vrcasData.filter(item =>
          EMBEDDING_FIELDS.some(field =>
            item[field]?.toLowerCase().includes(lastQuery.toLowerCase())
          )
        );
        if (fallbackResults.length) {
          filteredVRCa = fallbackResults;
          sortResults();
          renderInitialItems();
        }
      }
    }
  };

  // --- INIT ---
  searchWorker.postMessage({ type: 'init', data: { vrcas: vrcasData } });
  setLoading(true);

  const init = async () => {
    headerEl.textContent = `VRCAssetArchiveBrowser (VRCa Count: ${vrcasData.length})`;
    exportSelectedBtn.disabled = true;
    deleteSelectedBtn.disabled = true;
    sortResults();
    renderInitialItems();
  };

  await init();
  setLoading(false);
})();

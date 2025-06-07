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

  const loadingMoreIndicator = Object.assign(document.createElement('div'), {
    textContent: "Loading more...",
    style: "text-align: center; padding: 8px 0; display: none;"
  });
  container.after(loadingMoreIndicator);

  const vrcasData = [...vrcas];
  let filteredVRCa = [...vrcasData];
  let renderedCount = 0;
  let debounceTimeout = null;

  const searchWorker = new Worker('./js/slave.js');
  let workerReady = false;
  let workerSearchQueue = [];

  searchWorker.onmessage = ({ data }) => {
    const { type, filtered } = data;
    try {
      if (type === 'init_done') {
        workerReady = true;
        workerSearchQueue.forEach(({ query, searchField }) =>
          searchWorker.postMessage({ type: 'search', data: { query, searchField } })
        );
        workerSearchQueue = [];
      } else if (type === 'result') {
        if (!Array.isArray(filtered)) throw new Error("Invalid filtered result from worker");
        filteredVRCa = filtered;
        sortResults();
        renderInitialItems();
      }
    } catch (err) {
      console.error("Worker processing error:", err);
      filteredVRCa = [];
      container.innerHTML = '<div class="empty-msg" tabindex="0">An error occurred while processing results.</div>';
    } finally {
      setLoading(false);
    }
  };

  searchWorker.onerror = e => {
    console.error("Worker error:", e.message);
    filteredVRCa = [];
    container.innerHTML = '<div class="empty-msg" tabindex="0">Search failed due to a worker error.</div>';
    setLoading(false);
  };

  searchWorker.postMessage({ type: 'init', data: { vrcas: vrcasData } });

  const setLoading = isLoading => {
    loadingIndicator.style.display = isLoading ? 'inline-block' : 'none';
    [searchBtn, refreshBtn, searchBoxEl, searchFieldEl, sortFieldEl, bulkSelectAllCheckbox]
      .forEach(el => el.disabled = isLoading);
    updateExportButtonState();
  };

  const sizeToBytes = sizeStr => {
    if (!sizeStr) return 0;
    const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
    const [val, unit] = sizeStr.split(' ');
    return parseFloat(val) * (units[unit.toUpperCase()] || 1);
  };

  const highlightText = (text, query) => {
    if (!query) return text;
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return text.replace(regex, m => `<span class="highlight">${m}</span>`);
  };

  const sortResults = () => {
    const field = sortFieldEl.value;
    filteredVRCa.sort((a, b) => {
      if (field === 'dateTime') {
        return new Date(b.dateTime.replace('|', '').trim()) - new Date(a.dateTime.replace('|', '').trim());
      }
      if (field === 'size') return sizeToBytes(b.size) - sizeToBytes(a.size);
      return (a[field] || '').localeCompare((b[field] || ''), undefined, { sensitivity: 'base' });
    });
  };

  const renderMoreItems = () => {
    if (renderedCount >= filteredVRCa.length) return false;
    const query = searchBoxEl.value.trim();
    const items = filteredVRCa.slice(renderedCount, renderedCount + ITEMS_PER_PAGE);

    const html = items.map(({ title, author, description, image, avatarId, userId, dateTime, version, size }) => `
      <div class="vrca-card" role="listitem" tabindex="0">
        <input type="checkbox" class="bulkSelectItem" data-avatarid="${avatarId}" aria-label="Select VRCA item" />
        <a href="${image}" target="_blank" rel="noopener noreferrer">
          <img class="vrca-image" loading="lazy" src="${image}" alt="Image of ${title}" onerror="this.src='fallback.png';" />
        </a>
        <div class="vrca-details">
          <div class="vrca-title">
            <a href="https://vrchat.com/home/avatar/${avatarId}" target="_blank" rel="noopener noreferrer" class="avatar-link">
              ${highlightText(title, query)}
            </a>
            <div class="author-line">
              By <a href="https://vrchat.com/home/user/${userId}" target="_blank" rel="noopener noreferrer" class="author-link">
                ${highlightText(author, query)}
              </a>
            </div>
          </div>
          <div class="meta-right">
            <div class="date-time">${dateTime}</div>
            <div>${version} | ${size}</div>
          </div>
          <div class="vrca-description">Description: ${highlightText(description, query)}</div>
        </div>
      </div>`).join('');

    container.insertAdjacentHTML('beforeend', html);
    renderedCount += items.length;
    updateExportButtonState();
    return true;
  };

  const renderInitialItems = () => {
    container.innerHTML = '';
    renderedCount = 0;
    if (!renderMoreItems()) {
      container.innerHTML = '<div class="empty-msg" tabindex="0">No results found.</div>';
    }
    updateExportButtonState();
  };

  const updateExportButtonState = () => {
    const checkboxes = container.querySelectorAll('.bulkSelectItem');
    const checked = [...checkboxes].filter(cb => cb.checked);
    exportSelectedBtn.disabled = checked.length === 0;
    bulkSelectAllCheckbox.checked = checked.length === checkboxes.length;
    bulkSelectAllCheckbox.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
  };

  container.addEventListener('scroll', () => {
    if (container.scrollHeight - (container.scrollTop + container.clientHeight) <= 150 &&
      loadingMoreIndicator.style.display === 'none') {
      if (renderedCount < filteredVRCa.length) {
        loadingMoreIndicator.style.display = "block";
        renderMoreItems();
        loadingMoreIndicator.style.display = "none";
      }
    }
  });

  container.addEventListener('change', e => {
    if (e.target.classList.contains('bulkSelectItem')) updateExportButtonState();
  });

  bulkSelectAllCheckbox.addEventListener('change', () => {
    const checked = bulkSelectAllCheckbox.checked;
    container.querySelectorAll('.bulkSelectItem').forEach(cb => cb.checked = checked);
    updateExportButtonState();
  });

  exportSelectedBtn.addEventListener('click', () => {
    const selected = [...container.querySelectorAll('.bulkSelectItem')]
      .map(cb => cb.checked ? filteredVRCa.find(item => item.avatarId === cb.dataset.avatarid) : null)
      .filter(Boolean);

    if (!selected.length) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dlAnchor = Object.assign(document.createElement('a'), {
      href: url,
      download: "vrca_export.json"
    });
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    document.body.removeChild(dlAnchor);
    URL.revokeObjectURL(url);
  });

  const vectorSearch = () => {
    const query = searchBoxEl.value.trim();
    const searchField = searchFieldEl.value;
    if (!workerReady) {
      setLoading(true);
      workerSearchQueue.push({ query, searchField });
    } else {
      setLoading(true);
      searchWorker.postMessage({ type: 'search', data: { query, searchField } });
    }
  };

  searchBoxEl.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(vectorSearch, 300);
  });

  sortFieldEl.addEventListener('change', () => {
    sortResults();
    renderInitialItems();
  });

  searchFieldEl.addEventListener('change', vectorSearch);
  searchBtn.addEventListener('click', vectorSearch);
  refreshBtn.addEventListener('click', () => {
    searchBoxEl.value = '';
    filteredVRCa = [...vrcasData];
    sortResults();
    renderInitialItems();
  });

  const init = async () => {
    headerEl.textContent = `VRCAssetArchiveBrowser (VRCa Count: ${vrcasData.length})`;
    exportSelectedBtn.disabled = true;
    sortResults();
    renderInitialItems();
  };

  await init();
})();

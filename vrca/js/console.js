(function () {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      --cp-bg: #1e1e1e;
      --cp-panel-bg: #252526;
      --cp-header-bg: rgba(45, 45, 45, 0.9);
      --cp-text: #ccc;
      --cp-border: #333;
      --cp-shadow: rgba(0, 0, 0, 0.4);
      --cp-btn-bg: #3c3c3c;
      --cp-btn-hover: #505050;
      --cp-btn-active: #666;
      --cp-success: #4ec9b0;
      --cp-warning: #e7c547;
      --cp-error: #f26f6f;
      --cp-info: #4fc1ff;
      --cp-search-clear: #888;
    }
    
    #consoleBox {
      position: absolute;
      width: 540px;
      height: 260px;
      background: var(--cp-panel-bg);
      border-radius: 12px;
      border: 1px solid var(--cp-border);
      box-shadow: 0 6px 20px var(--cp-shadow);
      display: flex;
      flex-direction: column;
      resize: none;
      overflow: hidden;
      min-width: 400px;
      min-height: 180px;
      max-width: calc(100vw - 40px);
      max-height: calc(100vh - 40px);
      z-index: 9999;
      transition: opacity 0.2s;
    }
    
    .cp-header {
      background: var(--cp-header-bg);
      color: var(--cp-text);
      font-size: 13px;
      padding: 8px 12px;
      cursor: grab;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--cp-border);
      user-select: none;
      position: relative;
      flex-shrink: 0;
    }
    
    .cp-controls {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: nowrap;
    }
    
    .cp-controls button, 
    .cp-controls input[type="text"] {
      background: var(--cp-btn-bg);
      border: none;
      color: var(--cp-text);
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.2s;
      height: 24px;
      line-height: 16px;
      flex-shrink: 0;
    }
    
    .cp-controls button:hover {
      background: var(--cp-btn-hover);
    }
    
    .cp-controls button.active {
      background: var(--cp-btn-active);
    }
    
    .cp-search-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
      flex-shrink: 1;
      min-width: 80px;
    }
    
    .cp-search-wrapper input[type="text"] {
      font-size: 11px;
      outline: none;
      width: 120px;
      padding: 4px 20px 4px 8px;
      flex-shrink: 1;
      height: 24px;
    }
    
    .cp-log-container {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
      scrollbar-color: #666 #222;
      scrollbar-width: thin;
      contain: strict;
      overscroll-behavior: contain;
    }
    
    .cp-entry {
      font-family: Consolas, monospace;
      font-size: 12px;
      padding: 8px 12px;
      white-space: pre-wrap;
      word-break: break-word;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      border-bottom: 1px solid #2f2f2f;
      line-height: 1.5;
      contain: content;
    }
    
    .cp-entry .cp-time {
      color: #666;
      font-size: 10px;
      min-width: 70px;
      flex-shrink: 0;
    }
    
    .cp-entry .cp-content {
      flex: 1;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    
    .cp-entry.log { color: var(--cp-text); } 
    .cp-entry.error { color: var(--cp-error); }
    .cp-entry.warn { color: var(--cp-warning); } 
    .cp-entry.info { color: var(--cp-info); }
    .cp-entry.debug { color: var(--cp-success); }
    
    .cp-resize-handle {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 16px;
      height: 16px;
      background: transparent;
      cursor: nwse-resize;
    }
    
    .cp-resize-handle::after {
      content: "";
      position: absolute;
      right: 2px;
      bottom: 2px;
      width: 10px;
      height: 10px;
      border-right: 2px solid #555;
      border-bottom: 2px solid #555;
    }
    
    .cp-hidden { 
      display: none !important; 
    }
    
    #consoleToggle {
      position: fixed;
      top: 12px;
      right: 12px;
      background: var(--cp-btn-bg);
      color: var(--cp-text);
      border: none;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      z-index: 10000;
      transition: transform 0.2s;
    }
    
    #consoleToggle:hover { 
      background: var(--cp-btn-hover);
      transform: scale(1.05);
    }
    
    .cp-search-clear {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--cp-search-clear);
      cursor: pointer;
      padding: 0;
      font-size: 12px;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }
    
    .cp-search-clear:hover {
      background: rgba(255,255,255,0.1);
    }
    
    .cp-filter-controls {
      display: flex;
      gap: 4px;
      margin-left: 8px;
      flex-shrink: 0;
    }
    
    .cp-filter-btn {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      font-size: 10px;
      flex-shrink: 0;
    }
    
    .cp-export-btn {
      margin-left: 4px;
      flex-shrink: 0;
    }
    
    .cp-fade-in {
      animation: cp-fadeIn 0.3s ease-out;
    }
    
    @keyframes cp-fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);

  const toggleBtn = document.createElement("button");
  toggleBtn.id = "consoleToggle";
  toggleBtn.textContent = "📜";
  document.body.appendChild(toggleBtn);

  const consoleBox = document.createElement("div");
  consoleBox.id = "consoleBox";
  consoleBox.classList.add("cp-hidden", "cp-fade-in");

  const header = document.createElement("div");
  header.className = "cp-header";
  header.id = "cp-dragHandle";
  header.innerHTML = `
    <span>🧾 Console</span>
    <div class="cp-controls">
      <div class="cp-search-wrapper">
        <input type="text" id="cp-searchInput" placeholder="Search…" />
        <button id="cp-searchClear" class="cp-search-clear">✕</button>
      </div>
      <div class="cp-filter-controls">
        <button id="cp-filterLog" class="cp-filter-btn active" title="Logs">L</button>
        <button id="cp-filterInfo" class="cp-filter-btn active" title="Info">I</button>
        <button id="cp-filterWarn" class="cp-filter-btn active" title="Warnings">W</button>
        <button id="cp-filterError" class="cp-filter-btn active" title="Errors">E</button>
      </div>
      <button id="cp-scrollLockBtn" class="active" title="Scroll Lock">🔒</button>
      <button id="cp-exportBtn" class="cp-export-btn" title="Export Logs">📥</button>
      <button id="cp-clearBtn" title="Clear">Clear</button>
      <button id="cp-closeBtn" title="Close">✖</button>
    </div>
  `;

  const logContainer = document.createElement("div");
  logContainer.className = "cp-log-container";
  logContainer.id = "cp-logContainer";

  const resizeHandle = document.createElement("div");
  resizeHandle.className = "cp-resize-handle";
  resizeHandle.id = "cp-resizeHandle";

  consoleBox.appendChild(header);
  consoleBox.appendChild(logContainer);
  consoleBox.appendChild(resizeHandle);
  document.body.appendChild(consoleBox);

  const scrollLockBtn = header.querySelector("#cp-scrollLockBtn");
  const clearBtn = header.querySelector("#cp-clearBtn");
  const closeBtn = header.querySelector("#cp-closeBtn");
  const searchInput = header.querySelector("#cp-searchInput");
  const searchClear = header.querySelector("#cp-searchClear");
  const exportBtn = header.querySelector("#cp-exportBtn");
  const filterLog = header.querySelector("#cp-filterLog");
  const filterInfo = header.querySelector("#cp-filterInfo");
  const filterWarn = header.querySelector("#cp-filterWarn");
  const filterError = header.querySelector("#cp-filterError");

  let isDragging = false,
    isResizing = false;
  let offsetX = 0,
    offsetY = 0;
  let scrollLock = true;
  let activeFilters = {
    log: true,
    info: true,
    warn: true,
    error: true,
  };

  let searchTimeout = null;
  const searchDebounceTime = 300;

  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  function saveState() {
    localStorage.setItem(
      "consolePanelState",
      JSON.stringify({
        left: consoleBox.style.left,
        top: consoleBox.style.top,
        width: consoleBox.style.width,
        height: consoleBox.style.height,
        isVisible: !consoleBox.classList.contains("cp-hidden"),
        scrollLock,
      })
    );
  }

  function loadState() {
    const state = JSON.parse(localStorage.getItem("consolePanelState"));
    if (state) {
      if (state.left) consoleBox.style.left = state.left;
      if (state.top) consoleBox.style.top = state.top;
      if (state.width) consoleBox.style.width = state.width;
      if (state.height) consoleBox.style.height = state.height;

      if (state.isVisible) {
        consoleBox.classList.remove("cp-hidden");
      }

      if (state.scrollLock !== undefined) {
        scrollLock = state.scrollLock;
        scrollLockBtn.classList.toggle("active", scrollLock);
      }
    }
  }

  loadState();

  header.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".cp-controls")) {
      isDragging = true;
      offsetX = e.clientX - consoleBox.offsetLeft;
      offsetY = e.clientY - consoleBox.offsetTop;
      document.body.style.userSelect = "none";
    }
  });

  const moveHandler = throttle((e) => {
    if (isDragging) {
      const left = e.clientX - offsetX;
      const top = e.clientY - offsetY;

      consoleBox.style.left = `${Math.max(
        0,
        Math.min(window.innerWidth - 50, left)
      )}px`;
      consoleBox.style.top = `${Math.max(
        0,
        Math.min(window.innerHeight - 50, top)
      )}px`;
      consoleBox.style.bottom = "auto";

      saveState();
    } else if (isResizing) {
      const minWidth = 400,
        minHeight = 180,
        maxWidth = window.innerWidth - 40,
        maxHeight = window.innerHeight - 40;

      const newWidth = Math.max(
        minWidth,
        Math.min(e.clientX - consoleBox.offsetLeft, maxWidth)
      );
      const newHeight = Math.max(
        minHeight,
        Math.min(e.clientY - consoleBox.offsetTop, maxHeight)
      );

      consoleBox.style.width = newWidth + "px";
      consoleBox.style.height = newHeight + "px";

      saveState();
    }
  }, 50);

  document.addEventListener("mousemove", moveHandler);

  document.addEventListener("mouseup", () => {
    isDragging = false;
    isResizing = false;
    document.body.style.userSelect = "auto";
  });

  resizeHandle.addEventListener("mousedown", (e) => {
    isResizing = true;
    e.preventDefault();
  });

  scrollLockBtn.addEventListener("click", () => {
    scrollLock = !scrollLock;
    scrollLockBtn.classList.toggle("active", scrollLock);
    if (scrollLock) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
    saveState();
  });

  clearBtn.addEventListener("click", () => {
    logContainer.innerHTML = "";
    searchInput.value = "";
  });

  closeBtn.addEventListener("click", () => {
    consoleBox.classList.add("cp-hidden");
    saveState();
  });

  toggleBtn.addEventListener("click", () => {
    if (consoleBox.classList.contains("cp-hidden")) {
      showConsolePanel();
    } else {
      consoleBox.classList.add("cp-hidden");
    }
    saveState();
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, searchDebounceTime);
  });

  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    applyFilters();
    searchInput.focus();
  });

  exportBtn.addEventListener("click", exportLogs);

  filterLog.addEventListener("click", () => toggleFilter("log", filterLog));
  filterInfo.addEventListener("click", () => toggleFilter("info", filterInfo));
  filterWarn.addEventListener("click", () => toggleFilter("warn", filterWarn));
  filterError.addEventListener("click", () =>
    toggleFilter("error", filterError)
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "`" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      toggleBtn.click();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      if (!consoleBox.classList.contains("cp-hidden")) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });

  function throttle(fn, wait) {
    let lastTime = 0;
    return function () {
      const now = Date.now();
      if (now - lastTime >= wait) {
        fn.apply(this, arguments);
        lastTime = now;
      }
    };
  }

  function showConsolePanel() {
    consoleBox.classList.remove("cp-hidden");

    if (!consoleBox.style.left || !consoleBox.style.top) {
      consoleBox.style.left = `${
        (window.innerWidth - consoleBox.offsetWidth) / 2
      }px`;
      consoleBox.style.top = `${
        (window.innerHeight - consoleBox.offsetHeight) / 3
      }px`;
    }

    consoleBox.style.bottom = "auto";
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function getTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now
      .getMilliseconds()
      .toString()
      .padStart(3, "0")}`;
  }

  function formatArgs(args) {
    return args
      .map((arg) => {
        if (typeof arg === "object" && arg !== null) {
          try {
            return JSON.stringify(
              arg,
              (key, value) => {
                if (typeof value === "function") return "<function>";
                if (value instanceof Node)
                  return `<${value.nodeName.toLowerCase()}>`;
                return value;
              },
              2
            );
          } catch (e) {
            return "[Unserializable Object]";
          }
        }
        return String(arg);
      })
      .join(" ");
  }

  function logToCustomConsole(type, ...args) {
    if (!activeFilters[type]) return;

    const entry = document.createElement("div");
    entry.className = `cp-entry ${type}`;

    const time = document.createElement("span");
    time.className = "cp-time";
    time.textContent = getTime();

    const message = document.createElement("span");
    message.className = "cp-content";
    message.textContent = formatArgs(args);

    entry.appendChild(time);
    entry.appendChild(message);

    requestAnimationFrame(() => {
      logContainer.appendChild(entry);
      applyFilters();
      if (scrollLock) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    });
  }

  function applyFilters() {
    const term = searchInput.value.trim().toLowerCase();

    requestAnimationFrame(() => {
      document.querySelectorAll(".cp-entry").forEach((entry) => {
        const isVisible =
          activeFilters[entry.classList[1]] &&
          (!term || entry.textContent.toLowerCase().includes(term));
        entry.style.display = isVisible ? "flex" : "none";
      });
    });
  }

  function toggleFilter(type, element) {
    activeFilters[type] = !activeFilters[type];
    element.classList.toggle("active", activeFilters[type]);
    applyFilters();
  }

  function exportLogs() {
    const entries = Array.from(logContainer.querySelectorAll(".cp-entry"));
    const content = entries
      .map((entry) => {
        return `[${entry.querySelector(".cp-time").textContent}] [${
          entry.classList[1]
        }] ${entry.querySelector(".cp-content").textContent}`;
      })
      .join("\n");

    const blob = new Blob([content], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `console-log-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  ["log", "warn", "error", "info", "debug"].forEach((type) => {
    console[type] = function (...args) {
      logToCustomConsole(type, ...args);
      originalConsole[type].apply(console, args);
    };
  });

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const [url, options = {}] = args;
    const method = options.method || "GET";
    const start = performance.now();

    try {
      const response = await originalFetch(...args);
      const duration = (performance.now() - start).toFixed(1);
      const status = response.status;

      logToCustomConsole(
        status >= 400 ? "error" : "info",
        `🌐 [fetch] ${method} ${url} → ${status} (${duration}ms)`
      );

      if (status >= 400) {
        try {
          const clone = response.clone();
          const errorData = await clone.json();
          logToCustomConsole("error", "Response error:", errorData);
        } catch {}
      }

      return response;
    } catch (err) {
      const duration = (performance.now() - start).toFixed(1);
      logToCustomConsole(
        "error",
        `🌐 [fetch] ${method} ${url} → FAILED (${duration}ms)`,
        err.message
      );
      throw err;
    }
  };

  const OriginalXHR = window.XMLHttpRequest;
  class XHRProxy extends OriginalXHR {
    constructor() {
      super();
      const open = this.open;
      this.open = function (method, url) {
        this._method = method;
        this._url = url;
        this._startTime = performance.now();
        open.apply(this, arguments);
      };

      const send = this.send;
      this.send = function (...args) {
        this.addEventListener("loadend", () => {
          const duration = (performance.now() - this._startTime).toFixed(1);
          const status = this.status;
          const type = status >= 400 ? "error" : "info";

          logToCustomConsole(
            type,
            `📡 [xhr] ${this._method} ${this._url} → ${status} (${duration}ms)`
          );

          if (status >= 400 && this.responseText) {
            try {
              const errorData = JSON.parse(this.responseText);
              logToCustomConsole("error", "Response error:", errorData);
            } catch {
              logToCustomConsole("error", "Response error:", this.responseText);
            }
          }
        });

        send.apply(this, args);
      };
    }
  }
  window.XMLHttpRequest = XHRProxy;
})();

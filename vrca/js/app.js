import { initDB, loadDataFromDB } from "./data.js";
import { vrcas } from "./data.js";
import { state, elements } from "./state.js";
import { setLoading, updateHeaderCount, showToast } from "./utils.js";
import {
  initVirtualScroll,
  initImageObserver,
  updateVisibleRange,
  sortResults,
} from "./ui.js";
import { setupEventListeners } from "./events.js";
import { searchWorker } from "./search.js";
async function initializeUI() {
  try {
    initImageObserver();
    state.containerHeight = elements.container.clientHeight;
    initVirtualScroll();
    setupEventListeners();
    sortResults();
    updateVisibleRange();
    updateHeaderCount();
  } catch (error) {
    console.error("UI initialization error:", error);
    throw error;
  }
}
async function initializeWorker() {
  try {
    searchWorker.postMessage({
      type: "init",
      data: {
        vrcas: state.vrcasData,
      },
    });
  } catch (error) {
    console.warn("Search worker init failed:", error);
    showToast("Search worker failed to initialize", "warning");
    throw error;
  }
}
async function init() {
  try {
    console.log("Initializing app...");
    setLoading(true, "Initializing...");
    await initDB();
    console.log("Database initialized");
    state.vrcasData = await loadDataFromDB();
    console.log("Data loaded from DB:", state.vrcasData.length);
    if (state.vrcasData.length === 0 && vrcas.length > 0) {
      console.log("Using hardcoded data from data.js");
      showToast("Loaded fallback data from file", "info");
      state.vrcasData = vrcas;
    }
    state.filteredVRCas = [...state.vrcasData];
    console.log("Total VRCA items:", state.vrcasData.length);
    await Promise.all([initializeUI(), initializeWorker()]);
    document.dispatchEvent(new Event("appReady"));
  } catch (error) {
    console.error("Initialization error:", error);
    showToast("Initialization failed, using fallback mode", "error");
    if (vrcas.length > 0) {
      console.warn("Using fallback data due to init failure");
      showToast("Using fallback data", "warning");
      state.vrcasData = vrcas;
      state.filteredVRCas = [...state.vrcasData];
    } else {
      state.vrcasData = [];
      state.filteredVRCas = [];
    }
    try {
      await initializeUI();
    } catch (uiError) {
      console.error("Fallback UI init failed:", uiError);
    }
    document.dispatchEvent(new Event("appReady"));
  } finally {
    setLoading(false);
  }
}
(async () => {
  await init();
})();

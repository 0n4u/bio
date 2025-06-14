export const ITEMS_PER_PAGE = 20;
export const EMBEDDING_FIELDS = ["title", "author", "description"];
export const MAX_UNDO_STEPS = 5;
export const DEBOUNCE_DELAY = 400;
export const MODEL_LOAD_TIMEOUT = 15000;
export const CARD_HEIGHT_ESTIMATE = 220;
export const VISIBLE_BUFFER = 5;
export const IMAGE_LOAD_TIMEOUT = 5000;
export const DB_NAME = "VRCAArchiveDB";
export const DB_VERSION = 2;
export const STORE_NAME = "vrcas";

export const $ = (id) => document.getElementById(id);

export const elements = {
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
  headerTitle: document.querySelector(".header-title"),
};

export const state = {
  vrcasData: [],
  filteredVRCas: [],
  renderedCount: 0,
  isLoading: false,
  lastQuery: "",
  workerReady: false,
  workerInitialized: false,
  workerSearchQueue: [],
  sortAsc: false,
  searchHistory: JSON.parse(localStorage.getItem("vrcaSearchHistory") || "[]"),
  currentSearchSuggestions: [],
  currentSearchAbortController: null,
  visibleItemRange: [0, 0],
  pendingImageLoads: new Map(),
  intersectionObserver: null,
  imageObserver: null,
  db: null,
  renderCache: new Map(),
  cardPositions: [],
  scrollTop: 0,
  containerHeight: 0,
  suggestionCache: new Map(),
  highlightCache: new Map(),
};

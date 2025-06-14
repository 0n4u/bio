const DB_NAME = "VRCAArchiveDB";
const DB_VERSION = 3;
const STORE_NAME = "vrcas";

let db = null;
let initPromise = null;

export async function initDB() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("DB open error:", event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        reject(new Error(`Object store ${STORE_NAME} not found`));
        return;
      }

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log("Creating object store:", STORE_NAME);
        db.createObjectStore(STORE_NAME, {
          keyPath: "avatarId",
        });
      }
    };

    request.onblocked = (event) => {
      console.warn("DB blocked:", event);
      reject(new Error("Database upgrade blocked"));
    };
  });

  return initPromise;
}

export async function loadDataFromDB() {
  try {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = (event) => {
        resolve(event.target.result || []);
      };

      request.onerror = (event) => {
        console.error("DB load error:", event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error("Failed to load data from DB:", error);
    throw error;
  }
}

export const vrcas = [
  {
    title: "BestDoctor",
    description: "BestDoctor",
    author: "Qyr",
    userId: "usr_a47154ef-3126-49ab-9960-6ffe54081994",
    avatarId: "avtr_e376e021-80fc-4c08-83f0-3afd57ae7fb0",
    dateTime: "May 17, 2025 | 12:11:23 PM",
    version: "Version 5",
    size: "0.968 MB",
    image:
      "https://files.vrchat.cloud/thumbnails/file_6646446e-2f83-4bae-8229-311e7101c21e.940aef9e20019425b64b950b4a2c4c75a1b67f024af7426842eba55b276a921a.2.thumbnail-512.png?Expires=1751500800&Key-Pair-Id=K3JAQ0Y971TV2Z&Signature=c5zkrfXR6LtVTz8u4-1capTALr8GL2qX5oJxI8JzpfPZNWkDsU6FZS0T4SaWeqA4rb0ljybkDqHAk-FrjQVeR6WChHR776aLfKLXWaBQo7ejog0wa7pQXvsyluR~nKkONEhf2ccOQJdI0RtpaMB28rh~G8Ro94rbj8YWjpmlNxGMRUL-wTQ8oEwrZ08KH1ldJ6ot~NosjrIVu0bf6btS6h890YI6gN5U1CrfkfiOX~2DqGaKLyvJOXs2RMZz~3k9JYz0QDDsW7U2J1xTrKqONFTKokQF-1fYnbCd5Fqac5wJp9YZRfnedWXX3zlQulVyhCWChz7PuzPBih~HZ2CIbQ__",
  },
  {
    title: "Elvis Presley 50's",
    description: "elvis",
    author: "dr_coincidental",
    userId: "usr_88ab2118-a18d-4028-91df-1a1777a13c88",
    avatarId: "avtr_3ee140ae-e4fa-4ad5-a872-4f1f0a742b39",
    dateTime: "May 17, 2025 | 12:11:16 PM",
    version: "Version 11",
    size: "9.332 MB",
    image:
      "https://files.vrchat.cloud/thumbnails/file_c13d2de4-0463-40a1-8692-5d13cd506fcc.31ed247277082297d6c8da2ce6dfbf100d881fd075ce67f9cfb126b2c775b290.2.thumbnail-512.png?Expires=1751500800&Key-Pair-Id=K3JAQ0Y971TV2Z&Signature=btxA0JR2A9Iwp1Ef6ge~5AR9RST8iIuFlo4tRZsMKTxkBShjFCTlUDHXZktQPoNvD2scecS9d5msnkhiBMHegWoNQ6Z05TPFmEVgh2r5~pxi-fmaU2HxaTCfWfpXynBokAAHkp3fTrsZHnM7T5lAY0B1mL4iGF8n534LYPsFskWb-DEY2ajRU66m~oO6-j~zDknrPnqfaUlN5L2FPbmb2Xq6OAs~wVr0RLMCZpQEiPvAuTjiOxf8Okw-P9lYJ18x4IQLGDZc~h7is8ywr1eHtJworZ962VlwlMZwXXEWq07CFofMnPigMveLXEUFmQiF~SKxNeVpZdhoSXVC2t1mbw__",
  },
];

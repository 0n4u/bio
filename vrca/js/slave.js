importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder');

// Load hnswlib wasm + js bundle (hosted on jsDelivr or your preferred CDN)
importScripts('https://cdn.jsdelivr.net/npm/hnswlib-wasm@0.1.4/dist/hnswlib.min.js');

let model = null;
let vrcasData = [];
const EMBEDDING_FIELDS = ['title', 'author', 'description'];

const embeddingsCache = {};   // { field: Float32Array[][] }
const annIndices = {};        // { field: HNSWLibIndex instance }

self.onmessage = async ({ data: { type, data } }) => {
  if (type === 'init') {
    vrcasData = data.vrcas || [];
    model = await use.load();

    for (const field of EMBEDDING_FIELDS) {
      if (!vrcasData.length) break;

      // Extract texts, skip if empty all
      const texts = vrcasData.map(item => item[field] || '');
      if (texts.every(t => !t)) continue;

      // Compute embeddings
      const embeddingsTensor = await model.embed(texts);
      const embeddingsArray = await embeddingsTensor.array();
      embeddingsTensor.dispose();

      embeddingsCache[field] = embeddingsArray.map(arr => new Float32Array(arr));

      // Build ANN index with hnswlib
      const dim = embeddingsCache[field][0].length;
      const numElements = embeddingsCache[field].length;
      const index = new hnswlib.Index('cosine', dim);

      // Initialize index with max elements, M and efConstruction tuned for speed/accuracy tradeoff
      index.initIndex(numElements, 16, 200);

      // Add embeddings to index
      for (let i = 0; i < numElements; i++) {
        index.addPoint(embeddingsCache[field][i], i);
      }
      index.setEf(50); // Query-time parameter: tradeoff between speed and accuracy

      annIndices[field] = index;
    }

    postMessage({ type: 'init_done' });
    return;
  }

  if (type !== 'search') return;

  const { query = '', searchField } = data;
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    postMessage({ type: 'result', filtered: vrcasData });
    return;
  }

  // Fallback substring search for ID fields or tiny datasets
  if (['userId', 'avatarId'].includes(searchField) || vrcasData.length < 20) {
    const filtered = vrcasData.filter(item =>
      (item[searchField] || '').toLowerCase().includes(normalizedQuery)
    );
    postMessage({ type: 'result', filtered });
    return;
  }

  try {
    if (!annIndices[searchField]) {
      // No ANN index, fallback substring search
      const filtered = vrcasData.filter(item =>
        (item[searchField] || '').toLowerCase().includes(normalizedQuery)
      );
      postMessage({ type: 'result', filtered });
      return;
    }

    // Embed query
    const queryEmbeddingTensor = await model.embed([query]);
    const queryEmbedding = await queryEmbeddingTensor.array();
    queryEmbeddingTensor.dispose();

    // ANN search for top 10 neighbors
    const topK = 10;
    const index = annIndices[searchField];
    const neighbors = index.searchKnn(queryEmbedding[0], topK);

    // neighbors = { neighbors: [idx], distances: [float] }
    // Map back to VRCA items with scores (distance here is cosine distance)
    const results = neighbors.neighbors.map((idx, i) => ({
      vrca: vrcasData[idx],
      score: 1 - neighbors.distances[i], // convert cosine distance to similarity
    }));

    // Filter out low similarity results, threshold = 0.4
    const filteredResults = results.filter(r => r.score >= 0.4);

    if (filteredResults.length === 0) {
      // If none above threshold, fallback substring search
      const filtered = vrcasData.filter(item =>
        (item[searchField] || '').toLowerCase().includes(normalizedQuery)
      );
      postMessage({ type: 'result', filtered });
    } else {
      // Return sorted results by descending score
      filteredResults.sort((a, b) => b.score - a.score);
      postMessage({ type: 'result', filtered: filteredResults.map(r => r.vrca) });
    }
  } catch (error) {
    // On error fallback substring search
    const filtered = vrcasData.filter(item =>
      (item[searchField] || '').toLowerCase().includes(normalizedQuery)
    );
    postMessage({ type: 'result', filtered });
  }
};

self.onclose = () => {
  for (const index of Object.values(annIndices)) {
    index.clearIndex();
  }
  Object.keys(embeddingsCache).forEach(k => delete embeddingsCache[k]);
  Object.keys(annIndices).forEach(k => delete annIndices[k]);
  model = null;
  vrcasData = [];
};

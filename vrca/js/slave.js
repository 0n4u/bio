importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder');

let model = null;
let vrcasData = [];
const embeddingsCache = {};     // { field: Float32Array[][] }
const embeddingsTensors = {};   // { field: tf.Tensor2d } Persistent tensors for reuse

const EMBEDDING_FIELDS = ['title', 'author', 'description']; // Fields supporting semantic search

// Async initialization with memoized flag to avoid reloading model multiple times if re-initialized
let initPromise = null;

async function initializeModelAndEmbeddings(data) {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    vrcasData = data.vrcas || [];
    model = await use.load();

    for (const field of EMBEDDING_FIELDS) {
      if (!vrcasData.length) break;

      const texts = vrcasData.map(item => item[field] || '');
      if (texts.every(t => !t)) continue;

      // Dispose previous tensors before new embeddings on re-init
      if (embeddingsTensors[field]) {
        embeddingsTensors[field].dispose();
        delete embeddingsTensors[field];
        delete embeddingsCache[field];
      }

      const embeddingsTensor = await model.embed(texts);
      const embeddingsArray = await embeddingsTensor.array();

      embeddingsCache[field] = embeddingsArray.map(arr => new Float32Array(arr));
      embeddingsTensors[field] = embeddingsTensor; // Keep tensor alive
    }
  })();

  return initPromise;
}

self.onmessage = async ({ data: { type, data } }) => {
  if (type === 'init') {
    await initializeModelAndEmbeddings(data);
    postMessage({ type: 'init_done' });
    return;
  }

  if (type !== 'search') return;

  // Ensure model and embeddings ready
  await initPromise;

  const { query = '', searchField } = data;
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    postMessage({ type: 'result', filtered: vrcasData });
    return;
  }

  // Fast fallback for non-embedding fields or very small dataset
  if (['userId', 'avatarId'].includes(searchField) || vrcasData.length < 20) {
    const filtered = vrcasData.filter(item =>
      (item[searchField] || '').toLowerCase().includes(normalizedQuery)
    );
    postMessage({ type: 'result', filtered });
    return;
  }

  try {
    if (!embeddingsTensors[searchField]) {
      // No embeddings, fallback substring search
      const filtered = vrcasData.filter(item =>
        (item[searchField] || '').toLowerCase().includes(normalizedQuery)
      );
      postMessage({ type: 'result', filtered });
      return;
    }

    const queryEmbeddingTensor = await model.embed([query]);
    const fieldEmbeddingsTensor = embeddingsTensors[searchField];

    // Compute cosine similarity via dot product (assumes normalized embeddings)
    const scoresTensor = tf.matMul(queryEmbeddingTensor, fieldEmbeddingsTensor, false, true);
    const scores = await scoresTensor.data();

    queryEmbeddingTensor.dispose();
    scoresTensor.dispose();

    // Sort by score descending
    const results = [];
    for (let i = 0; i < scores.length; i++) {
      results.push({ vrca: vrcasData[i], score: scores[i] });
    }
    results.sort((a, b) => b.score - a.score);

    // Threshold fallback for low similarity
    if (results.length === 0 || results[0].score < 0.4) {
      const filtered = vrcasData.filter(item =>
        (item[searchField] || '').toLowerCase().includes(normalizedQuery)
      );
      postMessage({ type: 'result', filtered });
    } else {
      postMessage({ type: 'result', filtered: results.map(r => r.vrca) });
    }
  } catch (error) {
    // Fallback to substring on error, log error for dev purposes
    console.error('Search worker error:', error);
    const filtered = vrcasData.filter(item =>
      (item[searchField] || '').toLowerCase().includes(normalizedQuery)
    );
    postMessage({ type: 'result', filtered });
  }
};

self.onclose = () => {
  for (const tensor of Object.values(embeddingsTensors)) {
    tensor.dispose();
  }
  Object.keys(embeddingsCache).forEach(k => delete embeddingsCache[k]);
  Object.keys(embeddingsTensors).forEach(k => delete embeddingsTensors[k]);
  model = null;
  vrcasData = [];
};

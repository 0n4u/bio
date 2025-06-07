importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder');

let model = null;
let vrcasData = [];
const embeddingsCache = {};     // { field: Float32Array[][] }
const embeddingsTensors = {};   // { field: tf.Tensor2d } Persistent tensors for reuse

const EMBEDDING_FIELDS = ['title', 'author', 'description']; // Fields supporting semantic search

self.onmessage = async ({ data: { type, data } }) => {
  if (type === 'init') {
    vrcasData = data.vrcas || [];
    model = await use.load();

    // Precompute embeddings only for fields that exist in data
    for (const field of EMBEDDING_FIELDS) {
      if (!vrcasData.length) break;

      const texts = vrcasData.map(item => item[field] || '');
      if (texts.every(t => !t)) continue; // Skip if all empty

      const embeddingsTensor = await model.embed(texts);
      const embeddingsArray = await embeddingsTensor.array();

      embeddingsCache[field] = embeddingsArray.map(arr => new Float32Array(arr));
      embeddingsTensors[field] = embeddingsTensor; // Keep tensor alive (do NOT dispose here)
    }

    postMessage({ type: 'init_done' });
    return;
  }

  if (type !== 'search') return;

  const { query = '', searchField } = data;
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    // Empty query returns full data immediately
    postMessage({ type: 'result', filtered: vrcasData });
    return;
  }

  // Quick substring search for IDs or very small datasets
  if (['userId', 'avatarId'].includes(searchField) || vrcasData.length < 20) {
    const filtered = vrcasData.filter(item =>
      (item[searchField] || '').toLowerCase().includes(normalizedQuery)
    );
    postMessage({ type: 'result', filtered });
    return;
  }

  try {
    // Validate field embeddings exist
    if (!embeddingsTensors[searchField]) {
      // No embeddings for this field: fallback substring search
      const filtered = vrcasData.filter(item =>
        (item[searchField] || '').toLowerCase().includes(normalizedQuery)
      );
      postMessage({ type: 'result', filtered });
      return;
    }

    // Embed query once
    const queryEmbeddingTensor = await model.embed([query]);

    // Get precomputed embeddings tensor for the field
    const fieldEmbeddingsTensor = embeddingsTensors[searchField];

    // Compute cosine similarity (via dot product since embeddings are normalized)
    const scoresTensor = tf.matMul(queryEmbeddingTensor, fieldEmbeddingsTensor, false, true);
    const scores = await scoresTensor.data();

    // Dispose intermediate tensors promptly (keep cached tensors alive)
    queryEmbeddingTensor.dispose();
    scoresTensor.dispose();

    // Sort results by descending similarity score
    const results = vrcasData.map((vrca, i) => ({ vrca, score: scores[i] }));
    results.sort((a, b) => b.score - a.score);

    // If best match is below threshold, fallback to substring search
    if (results.length === 0 || results[0].score < 0.4) {
      const filtered = vrcasData.filter(item =>
        (item[searchField] || '').toLowerCase().includes(normalizedQuery)
      );
      postMessage({ type: 'result', filtered });
    } else {
      postMessage({ type: 'result', filtered: results.map(r => r.vrca) });
    }
  } catch (error) {
    // On error fallback to substring search to ensure resiliency
    const filtered = vrcasData.filter(item =>
      (item[searchField] || '').toLowerCase().includes(normalizedQuery)
    );
    postMessage({ type: 'result', filtered });
  }
};

// OPTIONAL: Cleanup function on worker termination or re-init to free memory
self.onclose = () => {
  for (const tensor of Object.values(embeddingsTensors)) {
    tensor.dispose();
  }
  Object.keys(embeddingsCache).forEach(k => delete embeddingsCache[k]);
  Object.keys(embeddingsTensors).forEach(k => delete embeddingsTensors[k]);
  model = null;
  vrcasData = [];
};

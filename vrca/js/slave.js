importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder');

let model = null;
let vrcasData = [];
const embeddingsCache = {};

const dotProduct = (a, b) => {
  let sum = 0;
  for (let i = 0, len = a.length; i < len; i++) sum += a[i] * b[i];
  return sum;
};

async function cacheEmbeddings(field) {
  if (!model) throw new Error('Model not loaded');
  if (embeddingsCache[field]?.length === vrcasData.length) return;

  const texts = vrcasData.map(item => item[field] || '');

  await tf.tidy(async () => {
    const embeddingsTensor = await model.embed(texts);
    embeddingsCache[field] = await embeddingsTensor.array();
  });
}

self.onmessage = async ({ data: { type, data } }) => {
  if (type === 'init') {
    vrcasData = data.vrcas;
    model = await use.load();
    postMessage({ type: 'init_done' });
    return;
  }

  if (type !== 'search') return;

  const { query, searchField } = data;
  const normalizedQuery = (query || '').toLowerCase();

  if (!normalizedQuery) {
    postMessage({ type: 'result', filtered: vrcasData });
    return;
  }

  if (['userId', 'avatarId'].includes(searchField) || vrcasData.length < 20) {
    const filtered = vrcasData.filter(item =>
      (item[searchField] || '').toLowerCase().includes(normalizedQuery)
    );
    postMessage({ type: 'result', filtered });
    return;
  }

  try {
    await cacheEmbeddings(searchField);

    const scores = await tf.tidy(async () => {
      const queryEmbeddingTensor = await model.embed([query]);
      const queryEmbeddingArray = await queryEmbeddingTensor.array();

      return vrcasData.map((item, idx) => ({
        vrca: item,
        score: dotProduct(queryEmbeddingArray[0], embeddingsCache[searchField][idx])
      }));
    });

    scores.sort((a, b) => b.score - a.score);

    if (scores.length === 0 || scores[0].score < 0.4) {
      const filtered = vrcasData.filter(item =>
        (item[searchField] || '').toLowerCase().includes(normalizedQuery)
      );
      postMessage({ type: 'result', filtered });
    } else {
      postMessage({ type: 'result', filtered: scores.map(s => s.vrca) });
    }
  } catch {
    const filtered = vrcasData.filter(item =>
      (item[searchField] || '').toLowerCase().includes(normalizedQuery)
    );
    postMessage({ type: 'result', filtered });
  }
};

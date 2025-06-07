importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder');

let model = null;
let vrcasData = [];
let embeddingsCache = {};

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

async function cacheEmbeddings(field) {
  if (!model || embeddingsCache[field]?.length === vrcasData.length) return;
  const texts = vrcasData.map(v => v[field] || "");
  const embeddingsTensor = await model.embed(texts);
  embeddingsCache[field] = await embeddingsTensor.array();
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

  if (!query) {
    postMessage({ type: 'result', filtered: vrcasData });
    return;
  }

  const lowerQ = query.toLowerCase();

  try {
    if (['userId', 'avatarId'].includes(searchField) || vrcasData.length < 20) {
      const filtered = vrcasData.filter(item =>
        (item[searchField] || '').toLowerCase().includes(lowerQ)
      );
      postMessage({ type: 'result', filtered });
      return;
    }

    await cacheEmbeddings(searchField);
    const queryVec = await (await model.embed([query])).array();

    const scores = vrcasData.map((vrca, i) => ({
      vrca,
      score: dotProduct(queryVec[0], embeddingsCache[searchField][i])
    }));

    scores.sort((a, b) => b.score - a.score);

    if (scores[0]?.score < 0.4) {
      const filtered = vrcasData.filter(item =>
        (item[searchField] || '').toLowerCase().includes(lowerQ)
      );
      postMessage({ type: 'result', filtered });
    } else {
      postMessage({ type: 'result', filtered: scores.map(s => s.vrca) });
    }
  } catch {
    const filtered = vrcasData.filter(item =>
      (item[searchField] || '').toLowerCase().includes(lowerQ)
    );
    postMessage({ type: 'result', filtered });
  }
};

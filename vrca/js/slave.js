try {
    if (typeof importScripts === 'function') {
        importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.0.0/dist/tf.min.js');
        importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder@1.3.3/dist/universal-sentence-encoder.min.js');
    } else {
        throw new Error('This script must run in a Web Worker');
    }
} catch (error) {
    postMessage({
        type: 'error',
        error: `Failed to load TensorFlow: ${error.message}`
    });
    self.close();
}
const MODEL_LOAD_TIMEOUT = 30000;
const EMBEDDING_FIELDS = ['title', 'author', 'description'];
const SIMILARITY_THRESHOLD_DEFAULT = 0.4;
const DB_NAME = 'VRCAWorkerDB';
const DB_VERSION = 2;
const STORE_NAME = 'embeddings';
const PREEMBED_BATCH_SIZE = 10;
let model = null;
let vrcasData = [];
let modelLoadFailed = false;
let currentSearchAborted = false;
let db = null;
let precomputeComplete = false;
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => {
            console.error('Worker DB error:', event.target.error);
            reject(event.target.error);
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, {
                    keyPath: 'id'
                });
            }
        };
    });
}
async function getCachedEmbedding(vrcaId, field) {
    if (!db) return null;
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const key = `${vrcaId}_${field}`;
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? request.result.embedding : null);
        request.onerror = () => resolve(null);
    });
}
async function cacheEmbedding(vrcaId, field, embedding) {
    if (!db) return;
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const item = {
            id: `${vrcaId}_${field}`,
            vrcaId,
            field,
            embedding: Array.from(embedding),
            timestamp: Date.now()
        };
        store.put(item);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
    });
}
async function loadModelWithTimeout() {
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Model load timeout')), MODEL_LOAD_TIMEOUT)
    );
    try {
        await initDB();
        postMessage({
            type: 'progress',
            message: 'Loading USE model (50MB)...'
        });
        const loadedModel = await Promise.race([
            use.load(),
            timeoutPromise
        ]);
        postMessage({
            type: 'progress',
            message: 'Model loaded.'
        });
        return loadedModel;
    } catch (error) {
        console.error('Model loading failed:', error);
        postMessage({
            type: 'error',
            error: `Model failed to load: ${error.message}`
        });
        modelLoadFailed = true;
        return null;
    }
}

function cosineSimilarity(vecA, vecB) {
    let dot = 0,
        normA = 0,
        normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB)) || 0;
}
async function precomputeEmbeddings() {
    if (modelLoadFailed || !model) return;
    const fields = EMBEDDING_FIELDS;
    const total = vrcasData.length * fields.length;
    let computed = 0;
    for (let i = 0; i < vrcasData.length; i += PREEMBED_BATCH_SIZE) {
        if (currentSearchAborted) break;
        const batch = vrcasData.slice(i, i + PREEMBED_BATCH_SIZE);
        for (const vrca of batch) {
            for (const field of fields) {
                const text = vrca[field] || '';
                if (!text) {
                    computed++;
                    continue;
                }
                let embedding = await getCachedEmbedding(vrca.avatarId, field);
                if (!embedding) {
                    const textEmbedding = await model.embed([text]);
                    embedding = (await textEmbedding.array())[0];
                    textEmbedding.dispose();
                    await cacheEmbedding(vrca.avatarId, field, embedding);
                }
                computed++;
            }
        }
        const progress = Math.round((computed / total) * 100);
        postMessage({
            type: 'progress',
            message: `Precomputing embeddings: ${progress}%`
        });
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    precomputeComplete = true;
    postMessage({
        type: 'progress',
        message: 'Embeddings precomputed'
    });
}
self.onmessage = async ({
    data: {
        type,
        data
    }
}) => {
    try {
        if (type === 'abort') {
            currentSearchAborted = true;
            postMessage({
                type: 'result',
                filtered: [],
                error: 'Search aborted'
            });
            return;
        }
        if (currentSearchAborted) {
            currentSearchAborted = false;
            postMessage({
                type: 'result',
                filtered: [],
                error: 'Search aborted'
            });
            return;
        }
        if (type === 'init') {
            try {
                vrcasData = data.vrcas || [];
                if (!model) model = await loadModelWithTimeout();
                if (model && !modelLoadFailed) {
                    precomputeEmbeddings();
                }
                postMessage({
                    type: 'init_done',
                    modelReady: !modelLoadFailed
                });
            } catch (error) {
                postMessage({
                    type: 'init_done',
                    modelReady: false,
                    error: error.message
                });
            }
            return;
        }
        if (type === 'search') {
            const {
                query = '', searchField
            } = data;
            const normalizedQuery = query.trim().toLowerCase();
            if (currentSearchAborted) {
                currentSearchAborted = false;
                postMessage({
                    type: 'result',
                    filtered: [],
                    error: 'Search aborted'
                });
                return;
            }
            if (!normalizedQuery) {
                postMessage({
                    type: 'result',
                    filtered: vrcasData
                });
                return;
            }
            if (searchField === 'avatarId' || searchField === 'userId') {
                const filtered = vrcasData.filter(item =>
                    (item[searchField] || '').toLowerCase() === normalizedQuery
                );
                postMessage({
                    type: 'result',
                    filtered
                });
                return;
            }
            if (modelLoadFailed || !model) {
                const filtered = vrcasData.filter(item =>
                    (item[searchField] || '').toLowerCase().includes(normalizedQuery)
                );
                postMessage({
                    type: 'result',
                    filtered
                });
                return;
            }
            try {
                postMessage({
                    type: 'progress',
                    message: 'Processing search...'
                });
                const queryEmbedding = await model.embed([query]);
                const queryEmbeddingArray = (await queryEmbedding.array())[0];
                queryEmbedding.dispose();
                if (currentSearchAborted) {
                    postMessage({
                        type: 'result',
                        filtered: [],
                        error: 'Search aborted'
                    });
                    return;
                }
                const results = [];
                for (let i = 0; i < vrcasData.length; i++) {
                    if (currentSearchAborted) {
                        postMessage({
                            type: 'result',
                            filtered: [],
                            error: 'Search aborted'
                        });
                        currentSearchAborted = false;
                        return;
                    }
                    const vrca = vrcasData[i];
                    const text = vrca[searchField] || '';
                    if (!text) continue;
                    let textEmbeddingArray = await getCachedEmbedding(vrca.avatarId, searchField);
                    if (!textEmbeddingArray) {
                        const textEmbedding = await model.embed([text]);
                        textEmbeddingArray = (await textEmbedding.array())[0];
                        textEmbedding.dispose();
                        await cacheEmbedding(vrca.avatarId, searchField, textEmbeddingArray);
                    }
                    const score = cosineSimilarity(queryEmbeddingArray, textEmbeddingArray);
                    if (score >= SIMILARITY_THRESHOLD_DEFAULT) {
                        results.push({
                            vrca,
                            score
                        });
                    }
                }
                if (currentSearchAborted) {
                    postMessage({
                        type: 'result',
                        filtered: [],
                        error: 'Search aborted'
                    });
                    currentSearchAborted = false;
                    return;
                }
                const sortedResults = results
                    .sort((a, b) => b.score - a.score)
                    .map(r => r.vrca);
                postMessage({
                    type: 'result',
                    filtered: sortedResults.length ?
                        sortedResults :
                        vrcasData.filter(item =>
                            (item[searchField] || '').toLowerCase().includes(normalizedQuery)
                        )
                });
            } catch (error) {
                console.error('Search error:', error);
                postMessage({
                    type: 'result',
                    filtered: vrcasData.filter(item =>
                        (item[searchField] || '').toLowerCase().includes(normalizedQuery)),
                    error: error.message
                });
            }
        }
    } catch (error) {
        console.error('Worker error:', error);
        postMessage({
            type: 'error',
            error: `Worker operation failed: ${error.message}`
        });
    }
};
// slave.js

importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder');

const MODEL_LOAD_TIMEOUT = 15000;
const EMBEDDING_FIELDS = ['title', 'author', 'description'];
const CACHE_LIMIT = 10;
const CLEANUP_INTERVAL_MS = 60000;
const SIMILARITY_THRESHOLD_DEFAULT = 0.4;
const MAX_BATCH_SIZE = 50;

let model = null;
let vrcasData = [];
const embeddingsCache = {};
const embeddingsTensors = {};
let modelLoadFailed = false;
let initPromise = null;
let cleanupInterval;

async function loadModelWithTimeout() {
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Model load timeout')), MODEL_LOAD_TIMEOUT)
    );

    try {
        postMessage({
            type: 'progress',
            progress: 20,
            message: 'Downloading model...'
        });
        
        const loadedModel = await Promise.race([use.load(), timeoutPromise]);
        
        postMessage({
            type: 'progress',
            progress: 80,
            message: 'Initializing model...'
        });
        
        return loadedModel;
    } catch (error) {
        console.error('Model loading failed:', error);
        postMessage({
            type: 'progress',
            progress: 100,
            message: 'Model failed to load. Using basic search fallback.',
            error: error.message
        });
        modelLoadFailed = true;
        return null;
    }
}

function cleanupOldEmbeddings() {
    if (Object.keys(embeddingsCache).length <= CACHE_LIMIT) return;

    // Find field with oldest lastUsed timestamp
    let oldestField = null;
    let oldestTimestamp = Infinity;
    for (const [field, cacheEntry] of Object.entries(embeddingsCache)) {
        if (cacheEntry.lastUsed < oldestTimestamp) {
            oldestTimestamp = cacheEntry.lastUsed;
            oldestField = field;
        }
    }

    if (oldestField) {
        if (embeddingsTensors[oldestField]) {
            embeddingsTensors[oldestField].dispose();
            delete embeddingsTensors[oldestField];
        }
        delete embeddingsCache[oldestField];
    }
}

async function initializeModelAndEmbeddings(data) {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        vrcasData = data.vrcas || [];

        try {
            postMessage({
                type: 'progress',
                progress: 0,
                message: 'Starting initialization...'
            });
            
            model = await loadModelWithTimeout();
            if (!model) return;

            // Process fields in batches
            for (const [index, field] of EMBEDDING_FIELDS.entries()) {
                postMessage({
                    type: 'progress',
                    progress: Math.floor((index / EMBEDDING_FIELDS.length) * 100),
                    message: `Processing ${field} embeddings...`
                });

                if (!vrcasData.length) break;

                const texts = vrcasData.map(item => item[field] || '');
                if (texts.every(t => !t)) continue;

                if (embeddingsTensors[field]) {
                    embeddingsTensors[field].dispose();
                }

                // Process in batches to avoid memory issues
                const batchCount = Math.ceil(texts.length / MAX_BATCH_SIZE);
                const allEmbeddings = [];
                
                for (let i = 0; i < batchCount; i++) {
                    const batchStart = i * MAX_BATCH_SIZE;
                    const batchEnd = Math.min((i + 1) * MAX_BATCH_SIZE, texts.length);
                    const batchTexts = texts.slice(batchStart, batchEnd);
                    
                    const embeddingsTensor = await model.embed(batchTexts);
                    const embeddingsArray = await embeddingsTensor.array();
                    
                    allEmbeddings.push(...embeddingsArray.map(arr => new Float32Array(arr)));
                    embeddingsTensor.dispose();
                }

                embeddingsCache[field] = {
                    embeddings: allEmbeddings,
                    lastUsed: Date.now()
                };
            }

            cleanupInterval = setInterval(() => {
                cleanupOldEmbeddings();
                postMessage({
                    type: 'memory_status',
                    usage: performance.memory || null
                });
            }, CLEANUP_INTERVAL_MS);

        } catch (error) {
            console.error('Initialization error:', error);
            postMessage({
                type: 'error',
                error: `Initialization failed: ${error.message}`
            });
            modelLoadFailed = true;
        }
    })();

    return initPromise;
}

function cosineSimilarity(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB)) || 0;
}

self.onmessage = async ({ data: { type, data, signal } }) => {
    if (signal?.aborted) return;

    if (type === 'init') {
        try {
            await initializeModelAndEmbeddings(data);
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

    if (type === 'terminate') {
        clearInterval(cleanupInterval);
        for (const tensor of Object.values(embeddingsTensors)) {
            tensor.dispose();
        }
        Object.keys(embeddingsCache).forEach(k => delete embeddingsCache[k]);
        Object.keys(embeddingsTensors).forEach(k => delete embeddingsTensors[k]);
        model = null;
        vrcasData = [];
        self.close();
        return;
    }

    if (type !== 'search') return;

    const { query = '', searchField, similarityThreshold } = data;
    const threshold = similarityThreshold ?? SIMILARITY_THRESHOLD_DEFAULT;
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
        postMessage({
            type: 'result',
            filtered: vrcasData
        });
        return;
    }

    // Fallback substring search
    if (modelLoadFailed || !embeddingsCache[searchField]) {
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
            message: 'Calculating similarity...'
        });

        // Update LRU timestamp
        embeddingsCache[searchField].lastUsed = Date.now();

        // Embed query
        const queryEmbeddingTensor = await model.embed([query]);
        const queryEmbeddingArray = (await queryEmbeddingTensor.array())[0];
        queryEmbeddingTensor.dispose();

        const fieldEmbeddings = embeddingsCache[searchField].embeddings;

        // Calculate cosine similarity in batches
        const results = [];
        const batchSize = 1000;
        const batchCount = Math.ceil(vrcasData.length / batchSize);

        for (let i = 0; i < batchCount; i++) {
            if (signal?.aborted) {
                postMessage({
                    type: 'result',
                    filtered: [],
                    error: 'Search aborted'
                });
                return;
            }

            const batchStart = i * batchSize;
            const batchEnd = Math.min((i + 1) * batchSize, vrcasData.length);
            
            const batchResults = [];
            for (let j = batchStart; j < batchEnd; j++) {
                const score = cosineSimilarity(queryEmbeddingArray, fieldEmbeddings[j]);
                if (score >= threshold) {
                    batchResults.push({
                        vrca: vrcasData[j],
                        score
                    });
                }
            }

            results.push(...batchResults);
        }

        const sortedResults = results
            .sort((a, b) => b.score - a.score)
            .map(r => r.vrca);

        postMessage({
            type: 'result',
            filtered: sortedResults.length ? 
                sortedResults : vrcasData.filter(item =>
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
};
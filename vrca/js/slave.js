// slave.js - Updated Version
try {
    // Check if we're in a Worker environment
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

const MODEL_LOAD_TIMEOUT = 15000;
const EMBEDDING_FIELDS = ['title', 'author', 'description'];
const SIMILARITY_THRESHOLD_DEFAULT = 0.4;
const MAX_BATCH_SIZE = 50;

let model = null;
let vrcasData = [];
let modelLoadFailed = false;

async function loadModelWithTimeout() {
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Model load timeout')), MODEL_LOAD_TIMEOUT)
    );

    try {
        postMessage({ type: 'progress', message: 'Downloading model...' });
        
        // Load the model directly without use.load()
        const loadedModel = await Promise.race([
            window.use ? window.use.load() : use.load(),
            timeoutPromise
        ]);
        
        postMessage({ type: 'progress', message: 'Model loaded successfully' });
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
            vrcasData = data.vrcas || [];
            
            if (!model) {
                model = await loadModelWithTimeout();
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
        const { query = '', searchField } = data;
        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            postMessage({ type: 'result', filtered: vrcasData });
            return;
        }

        // Fallback substring search if model failed to load
        if (modelLoadFailed || !model) {
            const filtered = vrcasData.filter(item =>
                (item[searchField] || '').toLowerCase().includes(normalizedQuery)
            );
            postMessage({ type: 'result', filtered });
            return;
        }

        try {
            postMessage({ type: 'progress', message: 'Processing search...' });

            // Embed query
            const queryEmbedding = await model.embed([query]);
            const queryEmbeddingArray = (await queryEmbedding.array())[0];
            queryEmbedding.dispose();

            // Calculate similarity for each item
            const results = [];
            for (let i = 0; i < vrcasData.length; i++) {
                if (signal?.aborted) {
                    postMessage({ type: 'result', filtered: [], error: 'Search aborted' });
                    return;
                }

                const text = vrcasData[i][searchField] || '';
                if (!text) continue;

                const textEmbedding = await model.embed([text]);
                const textEmbeddingArray = (await textEmbedding.array())[0];
                textEmbedding.dispose();

                const score = cosineSimilarity(queryEmbeddingArray, textEmbeddingArray);
                if (score >= SIMILARITY_THRESHOLD_DEFAULT) {
                    results.push({
                        vrca: vrcasData[i],
                        score
                    });
                }
            }

            const sortedResults = results
                .sort((a, b) => b.score - a.score)
                .map(r => r.vrca);

            postMessage({
                type: 'result',
                filtered: sortedResults.length ? sortedResults : vrcasData.filter(item =>
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
};
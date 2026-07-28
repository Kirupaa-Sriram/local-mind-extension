/**
 * Cosine similarity between two equal-length numeric vectors:
 *   (A · B) / (||A|| * ||B||)
 * Returns a value in roughly [-1, 1] — 1 means "pointing the same direction"
 * (semantically similar), 0 means unrelated, negative means opposite.
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0; // a zero vector has no direction to compare
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Scores every stored item against a query vector, sorts by similarity
 * descending, and returns the top K with a human-friendly match percentage.
 *
 * @param {number[]} queryVector - embedding of the user's search text
 * @param {Array<{embedding: number[]}>} storedItems - saved history entries
 * @param {number} topK - how many results to return (default 5)
 * @returns {Array} storedItems augmented with `score` and `matchPercentage`,
 *                   sorted best-match-first
 */
export function searchLocalMind(queryVector, storedItems, topK = 5) {
  if (!Array.isArray(storedItems) || !queryVector) {
    return [];
  }

  return storedItems
    .filter((item) => Array.isArray(item.embedding) && item.embedding.length === queryVector.length)
    .map((item) => {
      const score = cosineSimilarity(queryVector, item.embedding);
      // Sentence embeddings from this model are mean-pooled + L2-normalized
      // (see offscreen.js: { pooling: 'mean', normalize: true }), which in
      // practice keeps same-domain similarity scores in roughly the 0–1
      // range rather than spanning the full -1..1 cosine range. So a direct
      // percentage (clamped for floating-point safety) reads naturally —
      // e.g. a 0.85 score shows as "85% match", not compressed toward 50%.
      const matchPercentage = Math.max(0, Math.min(100, Math.round(score * 100)));
      return { ...item, score, matchPercentage };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
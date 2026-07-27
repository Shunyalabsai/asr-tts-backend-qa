/**
 * Word Error Rate (WER) Calculator
 * WER = (Substitutions + Deletions + Insertions) / Reference Words
 * Uses Levenshtein distance at the word level.
 */
export function calculateWER(reference: string, hypothesis: string): number {
  const refWords = normalizeText(reference).split(/\s+/).filter(w => w.length > 0);
  const hypWords = normalizeText(hypothesis).split(/\s+/).filter(w => w.length > 0);

  if (refWords.length === 0) {
    return hypWords.length > 0 ? 1.0 : 0.0;
  }

  const n = refWords.length;
  const m = hypWords.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (refWords[i - 1] === hypWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,  // substitution
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1       // insertion
        );
      }
    }
  }

  return Math.min(dp[n][m] / n, 1.0);
}

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

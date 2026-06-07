import type { HtmlBlock, MatchKey } from "../types";

export interface TextCandidate {
  id: string;
  text: string;
  html?: string;
  domPath?: string;
}

export interface ScoredCandidate extends TextCandidate {
  score: number;
  matchedBy: string;
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9$€£¥.%]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

export function matchKeyValues(matchKeys: MatchKey[]): string[] {
  const values: string[] = [];
  for (const key of matchKeys) {
    for (const value of [key.item, key.price, key.key]) {
      const cleaned = String(value || "").trim();
      if (cleaned && !values.includes(cleaned)) {
        values.push(cleaned);
      }
    }
  }
  return values;
}

export function scoreTextAgainstKeys(text: string, keys: string[]): { score: number; matchedBy: string } {
  const haystack = normalizeText(text);
  if (!haystack || keys.length === 0) {
    return { score: 0, matchedBy: "" };
  }

  let best = { score: 0, matchedBy: "" };
  for (const key of keys) {
    const needle = normalizeText(key);
    if (!needle) {
      continue;
    }
    if (haystack === needle) {
      return { score: 1, matchedBy: key };
    }
    if (haystack.includes(needle)) {
      best = { score: Math.max(best.score, 0.82), matchedBy: key };
      continue;
    }
    const tokens = tokenize(needle);
    if (tokens.length === 0) {
      continue;
    }
    const matched = tokens.filter((token) => haystack.includes(token)).length;
    const ratio = matched / tokens.length;
    if (ratio >= 0.5 && ratio * 0.72 > best.score) {
      best = { score: ratio * 0.72, matchedBy: key };
    }
  }

  return best;
}

export function rankCandidates(candidates: TextCandidate[], matchKeys: MatchKey[], limit = 12): ScoredCandidate[] {
  const keys = matchKeyValues(matchKeys);
  return candidates
    .map((candidate) => {
      const score = scoreTextAgainstKeys(candidate.text, keys);
      return { ...candidate, score: score.score, matchedBy: score.matchedBy };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.text.length - right.text.length)
    .slice(0, limit);
}

export function trimText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

export function trimHtml(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

export function dedupeBlocks(blocks: HtmlBlock[], limit = 12): HtmlBlock[] {
  const seen = new Set<string>();
  const unique: HtmlBlock[] = [];
  for (const block of blocks) {
    const key = normalizeText(block.text).slice(0, 180);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(block);
    if (unique.length >= limit) {
      break;
    }
  }
  return unique;
}


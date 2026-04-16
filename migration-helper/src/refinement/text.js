const STOP_WORDS = new Set([
  "a",
  "about",
  "and",
  "any",
  "as",
  "at",
  "be",
  "before",
  "can",
  "clear",
  "current",
  "for",
  "from",
  "have",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "more",
  "must",
  "need",
  "notes",
  "of",
  "on",
  "or",
  "our",
  "outcome",
  "problem",
  "ready",
  "refinement",
  "review",
  "so",
  "story",
  "that",
  "the",
  "their",
  "this",
  "to",
  "turn",
  "we",
  "when",
  "with",
  "work",
  "workstream",
  "you"
]);

export function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function splitLines(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function splitSentences(value) {
  const text = normalizeWhitespace(value);
  if (!text) {
    return [];
  }

  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function stripBulletPrefix(value) {
  return normalizeWhitespace(value)
    .replace(/^(?:[-*]|\u2022)\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

export function dedupeStrings(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function extractKeywords(value) {
  const tokens = normalizeWhitespace(value).toLowerCase().match(/[a-z0-9]+/g) || [];
  return tokens.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function extractMeaningfulClause(value) {
  const cleaned = stripBulletPrefix(value);
  return cleaned
    .replace(/^(problem|story|summary|goal|need|issue|context|notes|references|dependencies|labels|sprint|estimate|parent epic)\s*:\s*/i, "")
    .trim();
}

export function findFirstMeaningfulLine(value) {
  for (const line of splitLines(value)) {
    const clause = extractMeaningfulClause(line);
    if (clause) {
      return clause;
    }
  }

  return "";
}

export function findFirstMeaningfulSentence(value) {
  for (const sentence of splitSentences(value)) {
    const clause = extractMeaningfulClause(sentence);
    if (clause) {
      return clause;
    }
  }

  return "";
}

export function compactList(values) {
  return dedupeStrings(
    (values || []).flatMap((value) => {
      if (Array.isArray(value)) {
        return value;
      }
      return [value];
    })
  );
}

export function lowerFirst(value) {
  const text = normalizeWhitespace(value);
  if (!text) {
    return "";
  }

  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function sentenceCase(value) {
  const text = normalizeWhitespace(value);
  if (!text) {
    return "";
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function extractTrailingInteger(value) {
  const match = normalizeWhitespace(value).match(/(\d+)\s*(?:story\s*)?points?/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function hasCanonicalStorySummary(value) {
  return /^As a .+, I want to .+ so that I can .+\.$/i.test(normalizeWhitespace(value));
}

export function joinAsSentence(parts) {
  return normalizeWhitespace(parts.filter(Boolean).join(" ")).replace(/\s+\./g, ".");
}

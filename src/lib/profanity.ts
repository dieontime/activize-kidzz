const BLOCKED = new Set([
  "ass", "damn", "hell", "crap", "shit", "fuck", "bitch", "piss",
  "butt", "sex", "porn", "kill", "nazi", "dick", "cock", "tit",
]);

export function containsProfanity(input: string): boolean {
  if (!input) return false;
  for (const token of tokenize(input)) {
    if (BLOCKED.has(token.toLowerCase())) return true;
  }
  return false;
}

function tokenize(input: string): string[] {
  const parts = input.split(/[^a-zA-Z]+/).filter(Boolean);
  const tokens: string[] = [];
  for (const part of parts) {
    let current = "";
    for (let i = 0; i < part.length; i++) {
      const c = part[i];
      const prev = i > 0 ? part[i - 1] : "";
      if (i > 0 && /[a-z]/.test(prev) && /[A-Z]/.test(c)) {
        if (current) tokens.push(current);
        current = c;
      } else {
        current += c;
      }
    }
    if (current) tokens.push(current);
  }
  return tokens;
}

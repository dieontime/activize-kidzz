export function suggestUsernames(base: string, count: number): string[] {
  const match = base.match(/(\d+)$/);
  const excludedNumber = match ? Number(match[1]) : null;
  const stripped = base.replace(/\d+$/, "");
  const used = new Set<string>();
  const out: string[] = [];
  while (out.length < count) {
    const n = Math.floor(Math.random() * 99) + 1;
    if (n === excludedNumber) continue;
    const candidate = `${stripped}${n}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      out.push(candidate);
    }
  }
  return out;
}

export function mockGridLayout(getIndex: (el: Element) => number | null, cols: number, cellSize = 100): () => void {
  const original = Element.prototype.getBoundingClientRect;
  const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const index = getIndex(this);
    if (index === null) return original.call(this);
    const row = Math.floor(index / cols);
    const col = index % cols;
    const left = col * cellSize;
    const top = row * cellSize;
    return {
      left, top, right: left + cellSize, bottom: top + cellSize,
      width: cellSize, height: cellSize, x: left, y: top,
      toJSON() { return this; },
    } as DOMRect;
  });
  return () => spy.mockRestore();
}

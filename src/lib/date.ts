export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function yesterdayDateString(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

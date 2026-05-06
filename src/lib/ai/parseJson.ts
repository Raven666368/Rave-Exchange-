export function parseJsonSafe<T = unknown>(raw: string): T {
  const cleaned = raw.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const sliced = cleaned.slice(first, last + 1);
      return JSON.parse(sliced) as T;
    }
    throw new Error("Invalid JSON response");
  }
}

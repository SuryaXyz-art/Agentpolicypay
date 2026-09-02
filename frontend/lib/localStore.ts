export function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  const value = window.localStorage.getItem(key);
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function saveLocal<T>(key: string, value: T) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

export function appendLocal<T>(key: string, item: T) {
  const current = loadLocal<T[]>(key, []);
  const next = [item, ...current];
  saveLocal(key, next);
  return next;
}

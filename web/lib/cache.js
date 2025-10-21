const cacheStore = new Map();

export function getCache(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache(key, value, ttlMs) {
  cacheStore.set(key, {
    value,
    expires: Date.now() + ttlMs,
  });
}

export function clearCache(key) {
  if (typeof key === "string") {
    cacheStore.delete(key);
    return;
  }
  cacheStore.clear();
}

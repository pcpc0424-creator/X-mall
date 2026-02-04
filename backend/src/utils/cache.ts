/**
 * Simple in-memory cache utility
 */

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTtl: number = 60000; // 1분 기본 TTL

  set<T>(key: string, value: T, ttl: number = this.defaultTtl): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // 만료된 항목 정리
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryCache = new MemoryCache();

// 주기적 정리 (5분마다)
setInterval(() => {
  memoryCache.cleanup();
}, 5 * 60 * 1000);

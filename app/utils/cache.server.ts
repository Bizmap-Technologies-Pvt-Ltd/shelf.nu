import { LRUCache } from "lru-cache";

// Cache configuration
const CACHE_SIZE = 500; // Number of items to cache
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes TTL

// Different cache instances for different data types
const organizationCache = new LRUCache<string, any>({
  max: 100,
  ttl: CACHE_TTL,
});

const permissionCache = new LRUCache<string, any>({
  max: 200,
  ttl: CACHE_TTL,
});

const userCache = new LRUCache<string, any>({
  max: 100,
  ttl: CACHE_TTL,
});

const assetCache = new LRUCache<string, any>({
  max: 1000,
  ttl: 1000 * 60 * 2, // 2 minutes for asset data
});

/**
 * Generic cache wrapper function with reliability safeguards
 */
export async function withCache<T>(
  cache: LRUCache<string, any>,
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: number; fallbackOnError?: boolean }
): Promise<T> {
  try {
    // Check cache first
    const cached = cache.get(key);
    if (cached !== undefined) {
      // Validate cached data is not null/undefined before returning
      if (cached !== null && typeof cached !== 'undefined') {
        return cached;
      }
    }
  } catch (cacheError) {
    // If cache fails, continue to fetch fresh data
    console.warn(`Cache read failed for key ${key}:`, cacheError);
  }

  try {
    // Fetch fresh data
    const data = await fetcher();
    
    // Only cache if data is valid
    if (data !== null && typeof data !== 'undefined') {
      try {
        cache.set(key, data, { ttl: options?.ttl });
      } catch (cacheError) {
        // Don't fail the request if caching fails
        console.warn(`Cache write failed for key ${key}:`, cacheError);
      }
    }
    
    return data;
  } catch (fetchError) {
    // If fresh fetch fails, try cache again as fallback
    if (options?.fallbackOnError) {
      try {
        const fallbackCached = cache.get(key);
        if (fallbackCached !== undefined) {
          console.warn(`Using stale cache for key ${key} due to fetch error`);
          return fallbackCached;
        }
      } catch (fallbackError) {
        console.warn(`Fallback cache read failed for key ${key}:`, fallbackError);
      }
    }
    
    // Re-throw the original fetch error
    throw fetchError;
  }
}

/**
 * Organization-specific cache functions
 */
export const organizationCacheUtils = {
  get: (key: string) => organizationCache.get(key),
  set: (key: string, value: any, ttl?: number) => 
    organizationCache.set(key, value, { ttl }),
  delete: (key: string) => organizationCache.delete(key),
  clear: () => organizationCache.clear(),
  withCache: <T>(key: string, fetcher: () => Promise<T>, options?: { ttl?: number; fallbackOnError?: boolean }) =>
    withCache(organizationCache, key, fetcher, options),
};

/**
 * Permission-specific cache functions
 */
export const permissionCacheUtils = {
  get: (key: string) => permissionCache.get(key),
  set: (key: string, value: any, ttl?: number) => 
    permissionCache.set(key, value, { ttl }),
  delete: (key: string) => permissionCache.delete(key),
  clear: () => permissionCache.clear(),
  withCache: <T>(key: string, fetcher: () => Promise<T>, options?: { ttl?: number; fallbackOnError?: boolean }) =>
    withCache(permissionCache, key, fetcher, options),
};

/**
 * User-specific cache functions
 */
export const userCacheUtils = {
  get: (key: string) => userCache.get(key),
  set: (key: string, value: any, ttl?: number) => 
    userCache.set(key, value, { ttl }),
  delete: (key: string) => userCache.delete(key),
  clear: () => userCache.clear(),
  withCache: <T>(key: string, fetcher: () => Promise<T>, options?: { ttl?: number; fallbackOnError?: boolean }) =>
    withCache(userCache, key, fetcher, options),
};

/**
 * Asset-specific cache functions
 */
export const assetCacheUtils = {
  get: (key: string) => assetCache.get(key),
  set: (key: string, value: any, ttl?: number) => 
    assetCache.set(key, value, { ttl }),
  delete: (key: string) => assetCache.delete(key),
  clear: () => assetCache.clear(),
  withCache: <T>(key: string, fetcher: () => Promise<T>, options?: { ttl?: number; fallbackOnError?: boolean }) =>
    withCache(assetCache, key, fetcher, options),
  invalidatePattern: (pattern: string) => {
    // Invalidate cache entries matching a pattern
    const keys = Array.from(assetCache.keys());
    keys.forEach(key => {
      if (typeof key === 'string' && key.includes(pattern)) {
        assetCache.delete(key);
      }
    });
  },
};

/**
 * Cache invalidation utilities
 */
export const cacheInvalidation = {
  invalidateUserData: (userId: string) => {
    userCache.delete(userId);
    permissionCache.clear(); // Clear all permissions as they might be user-related
  },
  
  invalidateOrganizationData: (organizationId: string) => {
    organizationCache.delete(organizationId);
    assetCacheUtils.invalidatePattern(organizationId);
  },
  
  invalidateAssetData: (assetId?: string, organizationId?: string) => {
    if (assetId) {
      assetCacheUtils.invalidatePattern(assetId);
    }
    if (organizationId) {
      assetCacheUtils.invalidatePattern(organizationId);
    }
  },
  
  clearAll: () => {
    organizationCache.clear();
    permissionCache.clear();
    userCache.clear();
    assetCache.clear();
  },
};

/**
 * Cache statistics for monitoring
 */
export const getCacheStats = () => ({
  organization: {
    size: organizationCache.size,
    calculatedSize: organizationCache.calculatedSize,
  },
  permission: {
    size: permissionCache.size,
    calculatedSize: permissionCache.calculatedSize,
  },
  user: {
    size: userCache.size,
    calculatedSize: userCache.calculatedSize,
  },
  asset: {
    size: assetCache.size,
    calculatedSize: assetCache.calculatedSize,
  },
});

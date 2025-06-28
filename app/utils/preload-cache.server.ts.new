import { db } from "~/database/db.server";
import { assetCacheUtils, organizationCacheUtils, userCacheUtils } from "./cache.server";

/**
 * Preload commonly accessed data into cache to improve performance
 */
export async function preloadCache(organizationId: string, userId: string): Promise<void> {
  try {
    // Validate inputs
    if (!organizationId || !userId) {
      console.warn("Invalid parameters for cache preloading", { organizationId, userId });
      return;
    }

    // Preload organization data with error handling
    try {
      const orgCacheKey = `org_${organizationId}`;
      if (!organizationCacheUtils.get(orgCacheKey)) {
        const orgData = await db.organization.findUnique({
          where: { id: organizationId },
          select: {
            id: true,
            name: true,
            type: true,
            selfServiceCanSeeBookings: true,
            selfServiceCanSeeCustody: true,
            baseUserCanSeeBookings: true,
            baseUserCanSeeCustody: true,
          },
        });
        
        if (orgData) {
          organizationCacheUtils.set(orgCacheKey, orgData, 1000 * 60 * 30); // 30 minutes
          console.log("Organization data preloaded", { organizationId });
        }
      }
    } catch (orgError) {
      console.warn("Failed to preload organization data", { organizationId, error: orgError });
      // Continue with other preloading even if this fails
    }

    // Preload user permissions with error handling
    try {
      const userCacheKey = `user_perms_${userId}_${organizationId}`;
      if (!userCacheUtils.get(userCacheKey)) {
        const userWithOrgs = await db.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userOrganizations: {
              where: { organizationId },
              select: {
                roles: true,
                organizationId: true,
              },
            },
          },
        });
        
        if (userWithOrgs) {
          userCacheUtils.set(userCacheKey, userWithOrgs, 1000 * 60 * 15); // 15 minutes
          console.log("User permissions preloaded", { userId, organizationId });
        }
      }
    } catch (userError) {
      console.warn("Failed to preload user permissions", { userId, organizationId, error: userError });
      // Continue with other preloading even if this fails
    }

    // Preload basic asset filters
    try {
      await preloadBasicFilters(organizationId);
    } catch (filterError) {
      console.warn("Failed to preload basic filters", { organizationId, error: filterError });
    }

    console.log("Cache preloading completed successfully", { organizationId, userId });
  } catch (error) {
    console.error("Critical error in preloadCache", { organizationId, userId, error });
    // Don't throw - preloading should never break the main request
  }
}

/**
 * Preload basic asset filters (categories, tags, locations)
 */
async function preloadBasicFilters(organizationId: string): Promise<void> {
  const basicFiltersCacheKey = `basic_filters_${organizationId}`;
  
  if (!assetCacheUtils.get(basicFiltersCacheKey)) {
    try {
      const [categories, tags, locations] = await Promise.all([
        db.category.findMany({
          where: { organizationId },
          select: { id: true, name: true, color: true },
          take: 50,
          orderBy: { name: 'asc' },
        }).catch(() => []), // Fallback to empty array
        db.tag.findMany({
          where: { organizationId },
          select: { id: true, name: true },
          take: 50,
          orderBy: { name: 'asc' },
        }).catch(() => []), // Fallback to empty array
        db.location.findMany({
          where: { organizationId },
          select: { id: true, name: true },
          take: 50,
          orderBy: { name: 'asc' },
        }).catch(() => []), // Fallback to empty array
      ]);

      const basicFilters = { categories, tags, locations };
      assetCacheUtils.set(basicFiltersCacheKey, basicFilters, 1000 * 60 * 15); // 15 minutes
      console.log("Basic filters preloaded", { organizationId });
    } catch (error) {
      console.warn("Failed to preload basic filters", { organizationId, error });
      // Set empty filters as fallback
      assetCacheUtils.set(basicFiltersCacheKey, { categories: [], tags: [], locations: [] }, 1000 * 60 * 5);
    }
  }
}

/**
 * Get preloaded basic filters from cache
 */
export function getPreloadedBasicFilters(organizationId: string) {
  try {
    const cacheKey = `basic_filters_${organizationId}`;
    const cached = assetCacheUtils.get(cacheKey);
    
    // Return cached data or fallback structure
    return cached || { categories: [], tags: [], locations: [] };
  } catch (error) {
    console.warn("Failed to get preloaded basic filters", { organizationId, error });
    return { categories: [], tags: [], locations: [] };
  }
}

/**
 * Clear all preloaded cache for an organization
 */
export function clearPreloadedCache(organizationId: string, userId?: string): void {
  try {
    // Clear organization cache
    const orgCacheKey = `org_${organizationId}`;
    organizationCacheUtils.delete(orgCacheKey);

    // Clear basic filters cache
    const basicFiltersCacheKey = `basic_filters_${organizationId}`;
    assetCacheUtils.delete(basicFiltersCacheKey);

    // Clear user cache if userId provided
    if (userId) {
      const userCacheKey = `user_perms_${userId}_${organizationId}`;
      userCacheUtils.delete(userCacheKey);
    }

    console.log("Preloaded cache cleared", { organizationId, userId });
  } catch (error) {
    console.warn("Failed to clear preloaded cache", { organizationId, userId, error });
  }
}

/**
 * Warm up cache for critical data without blocking the request
 */
export function warmupCacheAsync(organizationId: string, userId: string): void {
  // Fire and forget - don't await this
  setImmediate(() => {
    preloadCache(organizationId, userId).catch(error => {
      console.warn("Async cache warmup failed", { organizationId, userId, error });
    });
  });
}

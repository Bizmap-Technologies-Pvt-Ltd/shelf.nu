import type { Asset, Location, Organization, PrismaClient, ReconciliationBundle, ReconciliationItem, ReconciliationStatus, User } from "@prisma/client";
import { db } from "~/database/db.server";
import { ShelfError } from "~/utils/error";
import { createId } from "@paralleldrive/cuid2";

export type CreateReconciliationBundleInput = {
  bundleId: string;
  locationId: string;
  userId: string;
  organizationId: string;
  status?: ReconciliationStatus;
  items: Array<{
    rfidTag: string;
    assetId?: string | null;
    assetName: string;
    category?: string | null;
    status?: string | null;
    location?: string | null;
    locationMismatch?: boolean;
  }>;
};

export type ReconciliationBundleWithRelations = ReconciliationBundle & {
  location: Location;
  scannedBy: User;
  items: Array<ReconciliationItem & { 
    asset?: Asset | null; 
  }>;
};

/**
 * Create a new reconciliation bundle with its items
 */
export async function createReconciliationBundle(
  input: CreateReconciliationBundleInput
): Promise<ReconciliationBundle> {
  try {
    // Validate assetIds to ensure they exist in the database
    const validItems = [];
    
    for (const item of input.items) {
      // Default item with null assetId
      const validItem = {
        rfidTag: item.rfidTag,
        assetId: null as string | null,
        assetName: item.assetName,
        category: item.category || null, 
        status: item.status || null,
        location: item.location || null,
        locationMismatch: item.locationMismatch || false,
      };
      
      // If assetId is provided, check if it exists in the database
      if (item.assetId) {
        try {
          // First check if the asset exists in the database
          const assetExists = await db.asset.findUnique({
            where: { id: item.assetId }
          });
          
          // Only use the assetId if the asset exists
          if (assetExists) {
            validItem.assetId = item.assetId;
          }
        } catch (err) {
          // If there's an error finding the asset, keep assetId as null
          // Silent error handling - asset ID will remain null
        }
      }
      
      validItems.push(validItem);
    }
    
    return await db.reconciliationBundle.create({
      data: {
        bundleId: input.bundleId,
        locationId: input.locationId,
        userId: input.userId,
        organizationId: input.organizationId,
        status: input.status || "COMPLETED",
        items: {
          create: validItems
        }
      }
    });
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Failed to create reconciliation bundle",
      label: "Assets", // Using an existing label
    });
  }
}

/**
 * Get reconciliation bundles for an organization
 */
export async function getReconciliationBundles(
  organizationId: Organization["id"],
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<{ bundles: ReconciliationBundleWithRelations[]; total: number }> {
  try {
    const [bundles, total] = await Promise.all([
      db.reconciliationBundle.findMany({
        where: {
          organizationId,
        },
        include: {
          location: true,
          scannedBy: true,
          items: {
            include: {
              asset: true,
            },
          },
        },
        orderBy: {
          date: "desc",
        },
        take: options?.limit,
        skip: options?.offset,
      }),
      db.reconciliationBundle.count({
        where: {
          organizationId,
        },
      }),
    ]);
    
    return { bundles, total };
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Failed to get reconciliation bundles",
      label: "Assets",
    });
  }
}

/**
 * Get a single reconciliation bundle by ID
 */
export async function getReconciliationBundle(
  id: ReconciliationBundle["id"],
  organizationId: Organization["id"],
): Promise<ReconciliationBundleWithRelations | null> {
  try {
    return await db.reconciliationBundle.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        location: true,
        scannedBy: true,
        items: {
          include: {
            asset: true,
          },
        },
      },
    });
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Failed to get reconciliation bundle",
      label: "Assets",
    });
  }
}

import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from "@remix-run/node";
import { z } from "zod";
import { createReconciliationBundle, getReconciliationBundles } from "~/modules/reconciliation/service.server";
import { data, error, parseData } from "~/utils/http.server";
import { requirePermission } from "~/utils/roles.server";
import { ShelfError } from "~/utils/error";
import {
  PermissionAction,
  PermissionEntity,
} from "~/utils/permissions/permission.data";

// Schema for creating a new reconciliation bundle
const ReconciliationBundleSchema = z.object({
  bundleId: z.string(),
  locationId: z.string(),
  items: z.array(
    z.object({
      rfidTag: z.string(),
      assetId: z.string().nullable().optional(),
      assetName: z.string(),
      category: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
      location: z.string().nullable().optional(),
      locationMismatch: z.boolean().optional(),
    })
  ),
});

/**
 * GET: Fetch reconciliation bundles for the organization
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;

  try {
    const { organizationId } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.asset,
      action: PermissionAction.read,
    });

    // Get pagination parameters from URL
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || "50");
    const offset = Number(url.searchParams.get("offset") || "0");

    // Get reconciliation bundles
    // This will return empty results until the migration is run
    const { bundles, total } = await getReconciliationBundles(organizationId, {
      limit,
      offset,
    });

    // Format the response with additional error handling
    const formattedBundles = [];
    
    try {
      for (const bundle of bundles) {
        if (!bundle) continue;
        
        try {
          // Carefully handle each field with fallbacks
          const formattedBundle = {
            id: bundle.bundleId || bundle.id || `unknown-${Date.now()}`,
            date: bundle.date ? bundle.date.toISOString() : new Date().toISOString(),
            locationName: bundle.location?.name || "Unknown Location",
            scannedBy: bundle.scannedBy ? 
              `${bundle.scannedBy.firstName || ""} ${bundle.scannedBy.lastName || ""}`.trim() || 
              bundle.scannedBy.email || "Unknown User" : "Unknown User",
            scannedByEmail: bundle.scannedBy?.email || "unknown@example.com",
            totalItems: Array.isArray(bundle.items) ? bundle.items.length : 0,
            status: bundle.status === "COMPLETED" ? "Completed" : "In Progress",
            items: []
          };

          // Process items with error handling
          if (Array.isArray(bundle.items)) {
            formattedBundle.items = bundle.items.map((item: any) => {
              if (!item) return null;
              return {
                rfidTag: item.rfidTag || "",
                assetId: item.assetId === null || item.assetId === undefined ? null : item.assetId,
                assetName: item.assetName || "Unknown Asset",
                category: item.category || "Unknown",
                status: item.status || "Unknown",
                location: item.location || "Unknown",
              };
            }).filter(Boolean);
          }
          
          formattedBundles.push(formattedBundle);
        } catch (formatError) {
          // Skip this bundle on error
          continue;
        }
      }
    } catch (e) {
      // Handle error silently
    }
    
    return json(
      data({
        bundles: formattedBundles,
        total,
      })
    );
  } catch (cause) {
    const shelfError = cause instanceof ShelfError ? cause : new ShelfError({
      cause,
      message: "Failed to load reconciliation bundles",
      additionalData: { userId },
      label: "Assets",
    });
    return json(error(shelfError));
  }
}

/**
 * POST: Create a new reconciliation bundle
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;

  try {
    const { organizationId } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.asset,
      action: PermissionAction.create,
    });

    // Parse the request body
    const contentType = request.headers.get("Content-Type") || "";
    let validatedData;
    
    if (contentType.includes("application/json")) {
      // Handle JSON request
      const body = await request.json();
      validatedData = ReconciliationBundleSchema.parse(body);
    } else {
      // Handle form data request
      const formData = await request.formData();
      validatedData = parseData(formData, ReconciliationBundleSchema);
    }

    // Create the reconciliation bundle
    const bundle = await createReconciliationBundle({
      ...validatedData,
      userId,
      organizationId,
    });

    return json(data({ bundleId: bundle.id }));
  } catch (cause) {
    const shelfError = cause instanceof ShelfError ? cause : new ShelfError({
      cause,
      message: "Failed to create reconciliation bundle",
      additionalData: { userId },
      label: "Assets",
    });
    return json(error(shelfError));
  }
}

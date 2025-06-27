import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import type { ShouldRevalidateFunctionArgs } from "@remix-run/react";
import { useLoaderData, Link } from "@remix-run/react";
import { scannedItemsAtom, type ScannedRfidItem } from "~/atoms/rfid-scanner";
import { useAtom } from "jotai";
import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";
import { Button } from "~/components/shared/button";
import { ListContentWrapper } from "~/components/list/content-wrapper";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { data, error } from "~/utils/http.server";
import { ShelfError } from "~/utils/error";
import { ScanRfidDialog } from "~/components/reconciliation/scan-rfid-dialog";
import { ReconciliationBundlesTable } from "~/components/reconciliation/reconciliation-bundles-table";
import { useState, useCallback, useEffect } from "react";
import { requirePermission } from "~/utils/roles.server";
import { PermissionAction, PermissionEntity } from "~/utils/permissions/permission.data";
import { getUserByID } from "~/modules/user/service.server";
import { getAllEntriesForCreateAndEdit } from "~/modules/asset/service.server";

export const meta: MetaFunction = () => [
  { title: appendToMetaTitle("Assets Reconciliation") },
];

export const handle = {
  breadcrumb: () => <Link to="/reconciliation">Assets Reconciliation</Link>,
};

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (actionResult?.isTogglingSidebar) {
    return false;
  }
  return defaultShouldRevalidate;
}

function generateBundleId() {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REC-${dateStr}-${random}`;
}

type ReconciliationBundle = {
  id: string;
  date: string;
  locationName: string;
  scannedBy: string;
  scannedByEmail: string;
  totalItems: number;
  status: "Completed" | "In Progress";
  items: {
    rfidTag: string;
    assetId: string | null;
    assetName: string;
    category: string;
    status: "Available" | "In Use";
    location: string;
  }[];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;

  try {
    const { organizationId, userOrganizations } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.asset,
      action: PermissionAction.read,
    });

    // Get current user information
    const user = await getUserByID(userId);

    // Get locations for the dropdown
    const { locations, totalLocations } = await getAllEntriesForCreateAndEdit({
      organizationId,
      request,
    });
    
    // Fetch reconciliation bundles from the API - using relative URL for environment portability
    const apiUrl = new URL('/api/reconciliation', request.url).toString();
    const bundlesResponse = await fetch(apiUrl, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
      }
    });
    
    let recentReconciliations: ReconciliationBundle[] = [];
    
    try {
      if (bundlesResponse.ok) {
        const bundlesData = await bundlesResponse.json();
        // Extract bundles based on API response structure
        if (bundlesData && Array.isArray(bundlesData.bundles)) {
          
          // Make sure we properly handle null assetIds
          recentReconciliations = bundlesData.bundles
            .filter((bundle: any) => bundle && typeof bundle === 'object') // Ensure we only process valid objects
            .map((bundle: any) => ({
                id: bundle.id || "",
                date: bundle.date || new Date().toISOString(),
                locationName: bundle.locationName || "Unknown Location", 
                scannedBy: bundle.scannedBy || "Unknown User",
                scannedByEmail: bundle.scannedByEmail || "unknown@example.com",
                totalItems: bundle.totalItems || 0,
                status: bundle.status || "Completed",
                items: Array.isArray(bundle.items) ? bundle.items
                  .filter((item: any) => item && typeof item === 'object') // Filter valid items
                  .map((item: any) => ({
                    rfidTag: item.rfidTag || "",
                    assetId: item.assetId === null || item.assetId === undefined ? null : item.assetId,
                    assetName: item.assetName || "Unknown Asset",
                    category: item.category || "Unknown",
                    status: item.status || "Unknown",
                    location: item.location || "Unknown",
                  })) : []
            }));
        }
      }
    } catch (error) {
      // Handle error silently - could add server-side logging or notification here
    }

    
    return json(data({
      header: {
        title: "Assets Reconciliation",
      } as HeaderData,
      recentReconciliations,
      organizationId,
      userOrganizations,
      currentUser: user,
      locations,
      totalLocations,
    }));
  } catch (cause) {
    const shelfError = cause instanceof ShelfError ? cause : new ShelfError({
      cause,
      message: "Failed to load reconciliation page",
      additionalData: { userId },
      label: "Assets",
    });
    return json(error(shelfError));
  }
}

export default function AssetsReconciliation() {
  const loaderData = useLoaderData<typeof loader>();
  

  
  // Handle potential error state
  if ('error' in loaderData && loaderData.error) {
    return (
      <div className="p-6">
        <div className="text-red-600">
          Error loading reconciliation page: {loaderData.error.message}
        </div>
      </div>
    );
  }
  
  // Access loader data with proper typing
  type LoaderData = {
    header: HeaderData;
    organizationId: string;
    userOrganizations: any[];
    currentUser: any;
    locations: any[];
    recentReconciliations: ReconciliationBundle[];
  };
  
  const dataLayer = 'data' in loaderData ? loaderData.data as LoaderData : loaderData as LoaderData;
  
  // Extract properties safely
  const header = dataLayer.header;
  const organizationId = dataLayer.organizationId;
  const userOrganizations = dataLayer.userOrganizations || [];
  const currentUser = dataLayer.currentUser;
  const locations = dataLayer.locations || [];
  const recentReconciliations = dataLayer.recentReconciliations || [];
  


  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scannedItems] = useAtom(scannedItemsAtom);
  
  // Use the most recent data from the loader
  // This ensures that on page refresh, we always show the latest data from the database
  const [bundles, setBundles] = useState<ReconciliationBundle[]>(
    recentReconciliations || []
  );
  
  // Update bundles state when recentReconciliations changes
  useEffect(() => {
    if (recentReconciliations && Array.isArray(recentReconciliations) && recentReconciliations.length > 0) {
      setBundles(recentReconciliations);
    }
  }, [recentReconciliations]);

  const handleSaveBundle = async (items: ScannedRfidItem[], locationId?: string) => {
    if (!locationId) {
      return;
    }

    // Create user display name from available user data
    let userName = "Unknown User";
    let userEmail = "unknown@example.com";
    
    if (currentUser) {
      const firstName = currentUser.firstName || "";
      const lastName = currentUser.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      userName = fullName || currentUser.email || "Unknown User";
      userEmail = currentUser.email || "unknown@example.com";
    }
    
    // Use the selected location name, fallback to asset location or "Unknown Location"
    let locationName = "Unknown Location";
    if (locationId && locations) {
      const selectedLocation = locations.find(loc => loc.id === locationId);
      locationName = selectedLocation?.name || "Unknown Location";
    } else if (items.length > 0 && items[0].asset?.location) {
      locationName = items[0].asset.location;
    }
    
    const bundleId = generateBundleId();
    
    // Create the bundle object for local display
    const newBundle: ReconciliationBundle = {
      id: bundleId,
      date: new Date().toISOString(),
      locationName,
      scannedBy: userName,
      scannedByEmail: userEmail,
      totalItems: items.length,
      status: "Completed",
      items: items.map(item => ({
        rfidTag: item.rfid,
        assetId: item.asset?.id || null, // Use null instead of "unknown" string
        assetName: item.asset?.title || "Unknown Asset",
        category: item.asset?.category || "Uncategorized",
        status: item.asset?.status === "Available" ? "Available" : "In Use",
        location: item.asset?.location || "Unknown"
      }))
    };
    
    // Optimistically update the UI
    setBundles((prev) => [newBundle, ...prev]);
    
    try {
      // Save to the database via API - using relative URL for environment portability
      const response = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bundleId,
          locationId,
          items: newBundle.items.map(item => ({
            rfidTag: item.rfidTag,
            assetId: item.assetId, // Already null if not found
            assetName: item.assetName,
            category: item.category,
            status: item.status,
            location: item.location,
          }))
        }),
      });

      if (!response.ok) {
        // If the API call fails, we can show an error message
        // and potentially try again or remove the optimistic update
        const errorData = await response.json();
        // Handle error appropriately - could add notification here
      }
    } catch (error) {
      // Handle error appropriately - could add notification here
    }
  };

  return (
    <div className="relative">
      <Header>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-primary-500 hover:bg-primary-600"
            icon="scan"
            data-test-id="scanItems"
          >
            Scan Assets
          </Button>
        </div>
      </Header>

      <div className="max-w-7xl mx-auto py-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Reconciliations</h2>
            <p className="mt-1 text-sm text-gray-500">{bundles.length} reconciliation bundles</p>
          </div>

          <div className="px-1 sm:px-6 py-2 sm:py-6">
            <ReconciliationBundlesTable bundles={bundles} />
          </div>
        </div>

        <ScanRfidDialog
          key={isDialogOpen ? 'open' : 'closed'}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSave={handleSaveBundle}
          organizationId={organizationId}
          userOrganizations={userOrganizations}
        />
      </div>
    </div>
  );
}

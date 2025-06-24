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
import { useState, useCallback } from "react";
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
    assetId: string;
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

    // In a real application, we would fetch this from a database
    const recentReconciliations: ReconciliationBundle[] = [];

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
  
  const { header, recentReconciliations: initialBundles, organizationId, userOrganizations, currentUser, locations } = loaderData;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scannedItems] = useAtom(scannedItemsAtom);
  const [bundles, setBundles] = useState<ReconciliationBundle[]>(initialBundles);

  const handleSaveBundle = (items: ScannedRfidItem[], locationId?: string) => {
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
      const selectedLocation = locations.find((loc: any) => loc.id === locationId);
      locationName = selectedLocation?.name || "Unknown Location";
    } else if (items.length > 0 && items[0].asset?.location) {
      locationName = items[0].asset.location;
    }
    
    const newBundle: ReconciliationBundle = {
      id: generateBundleId(),
      date: new Date().toISOString(),
      locationName,
      scannedBy: userName,
      scannedByEmail: userEmail,
      totalItems: items.length,
      status: "Completed",
      items: items.map(item => ({
        rfidTag: item.rfid,
        assetId: item.asset?.id || "unknown",
        assetName: item.asset?.title || "Unknown Asset",
        category: item.asset?.category || "Uncategorized",
        status: item.asset?.status === "Available" ? "Available" : "In Use",
        location: item.asset?.location || "Unknown"
      }))
    };
    
    setBundles((prev) => [newBundle, ...prev]);
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

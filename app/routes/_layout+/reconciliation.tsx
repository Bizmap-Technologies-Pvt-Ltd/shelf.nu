import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import type { ShouldRevalidateFunctionArgs } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import { scannedItemsAtom } from "~/atoms/rfid-scanner";
import { useAtom } from "jotai";
import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";
import { Button } from "~/components/shared/button";
import { ListContentWrapper } from "~/components/list/content-wrapper";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { data } from "~/utils/http.server";
import { ScanRfidDialog } from "~/components/reconciliation/scan-rfid-dialog";
import { ReconciliationBundlesTable, type ReconciliationBundle } from "~/components/reconciliation/reconciliation-bundles-table";
import { useState } from "react";

export const meta: MetaFunction = () => [
  { title: appendToMetaTitle("Assets Reconciliation") },
];

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

export async function loader({ request }: LoaderFunctionArgs) {
  // In a real application, we would fetch this from a database
  const recentReconciliations: ReconciliationBundle[] = [];

  return data({
    header: {
      title: "Assets Reconciliation",
    } as HeaderData,
    recentReconciliations,
  });
}

export default function AssetsReconciliation() {
  const { header, recentReconciliations: initialBundles } = useLoaderData<typeof loader>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scannedItems] = useAtom(scannedItemsAtom);
  const [bundles, setBundles] = useState<ReconciliationBundle[]>(initialBundles);

  const handleSaveBundle = () => {
    if (scannedItems.length === 0) return;

    const newBundle: ReconciliationBundle = {
      id: generateBundleId(),
      date: new Date().toLocaleString(),
      locationName: "Warehouse A",
      scannedBy: "user@example.com",
      totalItems: scannedItems.length,
      status: "Completed",
      items: scannedItems.map(item => ({
        rfidTag: item.rfid,
        assetName: item.asset?.title || 'Unknown Asset',
        category: item.asset?.category || 'Uncategorized',
        status: (item.asset?.status as "Available" | "In Use") || 'Available',
        location: item.asset?.location || 'Unknown Location'
      }))
    };

    setBundles(prev => [newBundle, ...prev]);
    setIsDialogOpen(false);
  };

  return (
    <div>
      <Header
        title={header.title}
        slots={{
          "right-of-title": (
            <Button onClick={() => setIsDialogOpen(true)}>Scan Items</Button>
          ),
        }}
      />

      <ListContentWrapper>
        <h2 className="text-lg font-semibold mb-2">Recent Reconciliations</h2>
        <p className="text-gray-600 mb-4">{bundles.length} reconciliation bundles</p>

        <ReconciliationBundlesTable bundles={bundles} />

        <ScanRfidDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSave={handleSaveBundle}
        />
      </ListContentWrapper>
    </div>
  );
}

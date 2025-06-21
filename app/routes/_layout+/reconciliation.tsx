import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import type { ShouldRevalidateFunctionArgs } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import { scannedItemsAtom, type ScannedRfidItem } from "~/atoms/rfid-scanner";
import { useAtom } from "jotai";
import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";
import { Button } from "~/components/shared/button";
import { ListContentWrapper } from "~/components/list/content-wrapper";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { data } from "~/utils/http.server";
import { ScanRfidDialog } from "~/components/reconciliation/scan-rfid-dialog";
import { ReconciliationBundlesTable } from "~/components/reconciliation/reconciliation-bundles-table";
import { useState, useCallback } from "react";

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

type ReconciliationBundle = {
  id: string;
  date: string;
  locationName: string;
  scannedBy: string;
  totalItems: number;
  status: "Completed" | "In Progress";
  items: {
    rfidTag: string;
    assetName: string;
    category: string;
    status: "Available" | "In Use";
    location: string;
  }[];
};

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

  const handleSaveBundle = (items: ScannedRfidItem[]) => {
    const newBundle: ReconciliationBundle = {
      id: generateBundleId(),
      date: new Date().toISOString(),
      locationName: "Main Storage",
      scannedBy: "Current User",
      totalItems: items.length,
      status: "Completed",
      items: items.map(item => ({
        rfidTag: item.rfid,
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
            className="bg-orange-500 hover:bg-orange-600"
            icon="scan"
            data-test-id="scanItems"
          >
            Scan RFID Tags
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
        />
      </div>
    </div>
  );
}

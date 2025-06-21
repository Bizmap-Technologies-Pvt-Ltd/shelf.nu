import { Fragment, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { Td, Th } from "~/components/table";
import { Button } from "~/components/shared/button";
import { AssetReconciliationTable } from "./asset-reconciliation-table";

export type ReconciliationBundle = {
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

export function ReconciliationBundlesTable({ bundles }: { bundles: ReconciliationBundle[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (bundles.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 text-center">
        <p className="text-gray-500">No reconciliation bundles yet. Click "Scan RFID Tags" to begin reconciliation.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b text-left">
            <Th className="w-10"></Th>
            <Th>Reconciliation ID</Th>
            <Th>Date</Th>
            <Th>Location</Th>
            <Th>Scanned By</Th>
            <Th>Total Items</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {bundles.map((bundle) => (
            <Fragment key={bundle.id}>
              <tr className="border-b hover:bg-gray-50">
                <Td className="w-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExpandedId(expandedId === bundle.id ? null : bundle.id)}
                    className="h-8 w-8"
                  >
                    {expandedId === bundle.id ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </Button>
                </Td>
                <Td className="w-[200px]">{bundle.id}</Td>
                <Td>{bundle.date}</Td>
                <Td>{bundle.locationName}</Td>
                <Td>
                  <div>
                    <div>Current User</div>
                    <div className="text-sm text-gray-500">{bundle.scannedBy}</div>
                  </div>
                </Td>
                <Td>{bundle.totalItems} items</Td>
                <Td>
                  <span
                    className={
                      bundle.status === "Completed"
                        ? "inline-block px-2 py-0.5 text-sm font-medium rounded-full bg-green-50 text-green-700"
                        : "inline-block px-2 py-0.5 text-sm font-medium rounded-full bg-yellow-50 text-yellow-700"
                    }
                  >
                    {bundle.status}
                  </span>
                </Td>
              </tr>
              {expandedId === bundle.id && (
                <tr>
                  <td colSpan={7} className="p-0 border-b bg-gray-50">
                    <div className="px-4 py-4">
                      <AssetReconciliationTable items={bundle.items} />
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b text-left">
          <Th></Th>
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
            <tr className="border-b">
              <Td>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setExpandedId(expandedId === bundle.id ? null : bundle.id)}
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
              <Td>{bundle.scannedBy}</Td>
              <Td>{bundle.totalItems} items</Td>
              <Td>
                <span
                  className={
                    bundle.status === "Completed"
                      ? "text-green-600"
                      : "text-yellow-600"
                  }
                >
                  {bundle.status}
                </span>
              </Td>
            </tr>
            {expandedId === bundle.id && (
              <tr>
                <td colSpan={7} className="bg-gray-50 p-4">
                  <AssetReconciliationTable items={bundle.items} />
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

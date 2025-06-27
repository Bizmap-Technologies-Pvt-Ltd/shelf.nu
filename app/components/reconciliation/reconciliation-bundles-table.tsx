import { Fragment, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, CalendarIcon, MapPinIcon, UserIcon, PackageIcon } from "lucide-react";
import { Td, Th } from "~/components/table";
import { Button } from "~/components/shared/button";
import { AssetReconciliationTable } from "./asset-reconciliation-table";

export type ReconciliationBundle = {
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

export function ReconciliationBundlesTable({ bundles = [] }: { bundles?: ReconciliationBundle[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  
  // Filter out any invalid bundles (missing required properties)
  const validBundles = (bundles || []).filter(bundle => 
    bundle && 
    typeof bundle === 'object' && 
    'id' in bundle &&
    'date' in bundle
  );
  
  // Safety check for when bundles is undefined, null, or empty
  if (!validBundles.length) {
    return (
      <div className="bg-white rounded-lg p-6 sm:p-8 text-center">
        <div className="max-w-md mx-auto">
          <PackageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No reconciliation bundles yet</h3>
          <p className="text-gray-500 text-sm sm:text-base">
            Click "Scan RFID Tags" to begin reconciliation and track your inventory.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg overflow-hidden">
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b text-left bg-gray-50">
              <Th className="w-10 px-4 py-3"></Th>
              <Th className="px-4 py-3 min-w-[180px]">Reconciliation ID</Th>
              <Th className="px-4 py-3 min-w-[120px]">Date</Th>
              <Th className="px-4 py-3 min-w-[140px]">Location</Th>
              <Th className="px-4 py-3 min-w-[150px]">Scanned By</Th>
              <Th className="px-4 py-3 min-w-[100px]">Total Items</Th>
              <Th className="px-4 py-3 min-w-[120px]">Status</Th>
            </tr>
          </thead>
          <tbody>
            {validBundles.map((bundle) => (
              <Fragment key={bundle.id}>
                <tr className="border-b hover:bg-gray-50 transition-colors">
                  <Td className="w-10 px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpandedId(expandedId === bundle.id ? null : bundle.id)}
                      className="h-8 w-8 hover:bg-gray-100"
                    >
                      {expandedId === bundle.id ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </Td>
                  <Td className="px-4 py-3">
                    <div className="font-mono text-sm text-gray-900 truncate" title={bundle.id}>
                      {bundle.id}
                    </div>
                  </Td>
                  <Td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {new Date(bundle.date).toLocaleDateString(undefined, { 
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </Td>
                  <Td className="px-4 py-3">
                    <div className="text-sm text-gray-900 truncate" title={bundle.locationName}>
                      {bundle.locationName}
                    </div>
                  </Td>
                  <Td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{bundle.scannedBy}</div>
                      <div className="text-xs text-gray-500 truncate" title={bundle.scannedByEmail}>
                        {bundle.scannedByEmail}
                      </div>
                    </div>
                  </Td>
                  <Td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{bundle.totalItems} items</div>
                  </Td>
                  <Td className="px-4 py-3">
                    <span
                      className={
                        bundle.status === "Completed"
                          ? "inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800"
                          : "inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800"
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

      {/* Mobile/Tablet Card View */}
      <div className="lg:hidden space-y-4 p-4">
        {validBundles.map((bundle) => (
          <div key={bundle.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-4 space-y-3">
              {/* Header Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExpandedId(expandedId === bundle.id ? null : bundle.id)}
                    className="h-8 w-8 hover:bg-gray-100 flex-shrink-0"
                  >
                    {expandedId === bundle.id ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </Button>
                  <span
                    className={
                      bundle.status === "Completed"
                        ? "inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800"
                        : "inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800"
                    }
                  >
                    {bundle.status}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{bundle.totalItems} items</div>
                </div>
              </div>

              {/* ID Row */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reconciliation ID</div>
                <div className="font-mono text-sm text-gray-900 break-all">
                  {bundle.id}
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <CalendarIcon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-gray-500">Date</div>
                    <div className="text-sm text-gray-900">
                      {new Date(bundle.date).toLocaleDateString(undefined, { 
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MapPinIcon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-500">Location</div>
                    <div className="text-sm text-gray-900 truncate" title={bundle.locationName}>
                      {bundle.locationName}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:col-span-2">
                  <UserIcon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-500">Scanned By</div>
                    <div className="text-sm font-medium text-gray-900">{bundle.scannedBy}</div>
                    <div className="text-xs text-gray-500 truncate" title={bundle.scannedByEmail}>
                      {bundle.scannedByEmail}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedId === bundle.id && (
              <div className="border-t bg-gray-50 p-4">
                <div className="text-sm font-medium text-gray-900 mb-3">Scanned Items</div>
                <AssetReconciliationTable items={bundle.items} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

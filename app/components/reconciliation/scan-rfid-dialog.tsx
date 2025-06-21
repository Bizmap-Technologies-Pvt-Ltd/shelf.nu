import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/shared/modal";
import { Button } from "~/components/shared/button";
import { useState, useEffect } from "react";
import { useSetAtom } from "jotai";
import { scannedItemsAtom, type ScannedRfidItem } from "~/atoms/rfid-scanner";
import { AssetReconciliationTable, type AssetReconciliationItem } from "./asset-reconciliation-table";
import { XIcon, PlusIcon, LoaderIcon } from "lucide-react";

// Fake asset data for demonstration
const FAKE_ASSETS = {
  categories: ["Electronics", "Furniture", "Office Supplies", "Tools", "IT Equipment"],
  locations: ["Warehouse A", "Warehouse B", "Office Floor 1", "Office Floor 2", "Storage Room"],
  statuses: ["Available", "In Use"] as const,
};

type ManualEntry = {
  id: string;
  rfidTag: string;
  assetName: string;
  category: string;
  status: string;
  location: string;
};

export function ScanRfidDialog({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: ScannedRfidItem[]) => void;
}) {
  // Initialize with 10 empty rows
  const initialRows = Array.from({ length: 10 }, (_, i) => ({
    id: (i + 1).toString().padStart(2, '0'),
    rfidTag: "",
    assetName: "",
    category: "",
    status: "",
    location: "",
  }));

  const [manualEntries, setManualEntries] = useState<ManualEntry[]>(initialRows);
  const [scannedItems, setScannedItems] = useState<AssetReconciliationItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const setGlobalScannedItems = useSetAtom(scannedItemsAtom);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setManualEntries(initialRows);
      setScannedItems([]);
      setIsFetching(false);
      setFetchProgress(0);
    }
  }, [isOpen]);

  const updateRfidTag = (id: string, value: string) => {
    setManualEntries(prev =>
      prev.map(entry =>
        entry.id === id ? { ...entry, rfidTag: value } : entry
      )
    );
  };

  const generateFakeAsset = (rfidTag: string): AssetReconciliationItem => {
    const randomItem = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
    
    return {
      rfidTag,
      assetName: `Asset ${rfidTag}`,
      category: randomItem(FAKE_ASSETS.categories),
      status: randomItem(FAKE_ASSETS.statuses),
      location: randomItem(FAKE_ASSETS.locations),
    };
  };

  const fetchAssets = async () => {
    setIsFetching(true);
    setFetchProgress(0);
    
    const validEntries = manualEntries.filter(entry => entry.rfidTag.trim());
    const totalEntries = validEntries.length;
    
    // Simulate fetching assets with progress
    for (let i = 0; i < totalEntries; i++) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
      const fakeAsset = generateFakeAsset(validEntries[i].rfidTag);
      
      // Update both scanned items and manual entries
      setScannedItems(prev => [...prev, fakeAsset]);
      setManualEntries(prev => 
        prev.map(entry => 
          entry.rfidTag === validEntries[i].rfidTag
            ? {
                ...entry,
                assetName: fakeAsset.assetName,
                category: fakeAsset.category,
                status: fakeAsset.status,
                location: fakeAsset.location,
              }
            : entry
        )
      );
      
      setFetchProgress(Math.round(((i + 1) / totalEntries) * 100));
    }
    
    setIsFetching(false);
  };

  const handleSaveBundle = () => {
    const items: ScannedRfidItem[] = scannedItems.map(item => ({
      rfid: item.rfidTag,
      asset: {
        id: item.rfidTag,
        title: item.assetName,
        category: item.category,
        status: item.status,
        location: item.location,
      },
    }));

    onSave(items);
    setGlobalScannedItems(items);
    setScannedItems([]);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-4xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Manual RFID Entry</AlertDialogTitle>
          <p className="text-sm text-gray-500">Enter RFID tags and press Enter to move to next row</p>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Excel-like Table */}
          <div className="border rounded overflow-hidden bg-white">
            <table className="w-full border-collapse table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-12 px-2 py-1.5 text-left text-xs font-medium text-gray-500 border-b border-r">S.No</th>
                  <th className="w-28 px-2 py-1.5 text-left text-xs font-medium text-gray-500 border-b border-r">RFID Tag</th>
                  <th className="w-40 px-2 py-1.5 text-left text-xs font-medium text-gray-500 border-b border-r">Asset Name</th>
                  <th className="w-28 px-2 py-1.5 text-left text-xs font-medium text-gray-500 border-b border-r">Category</th>
                  <th className="w-24 px-2 py-1.5 text-left text-xs font-medium text-gray-500 border-b border-r">Status</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 border-b">Location</th>
                </tr>
              </thead>
              <tbody>
                {manualEntries.map((entry, index) => (
                  <tr key={entry.id} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-1 text-xs text-gray-500 border-r">{entry.id}</td>
                    <td className="px-0.5 py-0.5 border-r">
                      <input
                        type="text"
                        value={entry.rfidTag}
                        onChange={(e) => updateRfidTag(entry.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && index < manualEntries.length - 1) {
                            // Focus next row's input
                            const nextInput = document.querySelector(`input[data-row="${index + 1}"]`) as HTMLInputElement;
                            if (nextInput) nextInput.focus();
                          }
                        }}
                        data-row={index}
                        placeholder="Enter RFID"
                        className="w-full px-1.5 py-0.5 text-xs border-0 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        disabled={isFetching}
                      />
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-500 border-r truncate">
                      {entry.assetName || "-"}
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-500 border-r truncate">
                      {entry.category || "-"}
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-500 border-r">
                      {entry.status ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          entry.status === 'Available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {entry.status}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-500 truncate">
                      {entry.location || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Fetch Progress */}
          {isFetching && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <LoaderIcon className="h-3 w-3 animate-spin" />
                Fetching assets... {fetchProgress}%
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${fetchProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {!isFetching && scannedItems.length === 0 ? (
              <Button
                size="sm"
                onClick={fetchAssets}
                disabled={!manualEntries.some(e => e.rfidTag.trim())}
              >
                Fetch Assets
              </Button>
            ) : scannedItems.length > 0 ? (
              <Button size="sm" onClick={handleSaveBundle} className="bg-green-500 hover:bg-green-600">
                Save Bundle
              </Button>
            ) : null}
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

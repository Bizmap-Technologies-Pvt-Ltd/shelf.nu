import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/shared/modal";
import { Button } from "~/components/shared/button";
import { useState } from "react";
import { useSetAtom } from "jotai";
import { scannedItemsAtom, type ScannedRfidItem } from "~/atoms/rfid-scanner";
import { AssetReconciliationTable } from "./asset-reconciliation-table";

const DEMO_ITEMS = [
  {
    rfidTag: "ioq47f",
    assetName: "Sample Asset",
    category: "Electronics",
    status: "Available" as const,
    location: "Warehouse A",
  },
  {
    rfidTag: "tq3iwk",
    assetName: "Sample Asset",
    category: "Electronics",
    status: "Available" as const,
    location: "Warehouse A",
  },
  {
    rfidTag: "om2g2l",
    assetName: "Sample Asset",
    category: "Electronics",
    status: "Available" as const,
    location: "Warehouse A",
  },
];

export function ScanRfidDialog({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: ScannedRfidItem[]) => void;
}) {
  const [scannedItems, setScannedItems] = useState<typeof DEMO_ITEMS>([]);
  const [isScanning, setIsScanning] = useState(false);
  const setGlobalScannedItems = useSetAtom(scannedItemsAtom);

  // Simulate scanning RFID tags
  const handleStartScanning = () => {
    setIsScanning(true);
    setScannedItems([]);
    
    // Simulate finding items over time
    let index = 0;
    const interval = setInterval(() => {
      if (index < DEMO_ITEMS.length) {
        setScannedItems(prev => [...prev, DEMO_ITEMS[index]]);
        index++;
      } else {
        clearInterval(interval);
        setIsScanning(false);
      }
    }, 1000);
  };

  const handleSaveBundle = () => {
    // Convert to ScannedRfidItem format
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

    setGlobalScannedItems(items);
    onSave(items);
    onClose();
    setScannedItems([]);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-4xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Scan RFID Tags</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="p-4">
          <p className="text-gray-600 mb-4">Click start to begin scanning RFID tags</p>

          <div className="h-[400px] overflow-y-auto">
            <AssetReconciliationTable items={scannedItems} />
          </div>
        </div>

        <AlertDialogFooter>
          <div className="flex gap-2 justify-between w-full">
            <Button onClick={handleStartScanning} disabled={isScanning}>
              {isScanning ? "Scanning..." : "Start Scanning"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveBundle}
                disabled={scannedItems.length === 0 || isScanning}
              >
                Save Bundle
              </Button>
            </div>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

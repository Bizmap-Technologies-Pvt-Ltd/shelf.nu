import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/shared/modal";
import { Button } from "~/components/shared/button";
import { useState, useRef, useEffect } from "react";
import { useSetAtom } from "jotai";
import { scannedItemsAtom, type ScannedRfidItem } from "~/atoms/rfid-scanner";
import { AssetReconciliationTable, type AssetReconciliationItem } from "./asset-reconciliation-table";
import { XIcon } from "lucide-react";

// Demo items to simulate scanning - we'll rotate through these
const ALL_DEMO_ITEMS: AssetReconciliationItem[] = Array.from({ length: 20 }, (_, i) => ({
  rfidTag: `RFID${(i + 1).toString().padStart(4, '0')}`,
  assetName: `Asset ${i + 1}`,
  category: ["Electronics", "Furniture", "Office Supplies", "Tools"][i % 4],
  status: i % 3 === 0 ? "In Use" : "Available",
  location: ["Warehouse A", "Warehouse B", "Office Floor 1", "Office Floor 2"][i % 4],
}));

export function ScanRfidDialog({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: ScannedRfidItem[]) => void;
}) {
  const [scannedItems, setScannedItems] = useState<AssetReconciliationItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const setGlobalScannedItems = useSetAtom(scannedItemsAtom);
  const scanIndexRef = useRef(0);

  // Clear scanning state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setIsScanning(false);
      scanIndexRef.current = 0;
    }
  }, [isOpen]);

  const handleStartScanning = () => {
    setIsScanning(true);
    const existingTags = new Set(scannedItems.map(item => item.rfidTag));
    
    // Simulate finding items over time
    intervalRef.current = setInterval(() => {
      // Get next item, looping back to start if we reach the end
      const index = scanIndexRef.current % ALL_DEMO_ITEMS.length;
      const newItem = ALL_DEMO_ITEMS[index];
      
      // Only add items that haven't been scanned yet
      if (!existingTags.has(newItem.rfidTag)) {
        setScannedItems(prev => [...prev, newItem]);
        existingTags.add(newItem.rfidTag);
      }
      
      scanIndexRef.current++;
    }, 1000);
  };

  const handleStopScanning = () => {
    setIsScanning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const handleCancelBundle = () => {
    handleStopScanning();
    setScannedItems([]);
    onClose();
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

    // Save the bundle first so it includes all items
    onSave(items);
    
    // Then update global state and close
    setGlobalScannedItems(items);
    setScannedItems([]);
    onClose();
  };

  const handleClose = () => {
    handleStopScanning();
    if (scannedItems.length > 0) {
      handleCancelBundle();
    } else {
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-3xl  border-lg px-0">
        <AlertDialogHeader className="px-6 ">
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="text-xl font-semibold">Scan RFID Tags</AlertDialogTitle>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 border border-gray-200 py-2 px-3 ">
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </AlertDialogHeader>

        <div className="p-6 ">
          <div className="flex items-start justify-between mb-6">
            <div>
              {isScanning ? (
                <>
                  <h3 className="text-lg font-medium text-orange-400 mb-1">Scanning...</h3>
                  <p className="text-gray-600 text-sm">Place RFID tags within range of the scanner</p>
                </>
              ) : (
                <p className="text-gray-600 text-sm">Click start to begin scanning RFID tags</p>
              )}
            </div>
            <div className="flex gap-2">
              {isScanning ? (
                <Button
                  onClick={handleStopScanning}
                  variant="outline"
                  className="hover:bg-gray-100"
                >
                  Stop Scanning
                </Button>
              ) : (
                <>
                  {scannedItems.length > 0 && (
                    <Button onClick={handleSaveBundle} variant="outline" className="hover:bg-gray-100">
                      Save Bundle ({scannedItems.length} items)
                    </Button>
                  )}
                  <Button onClick={handleStartScanning} className="bg-orange-500 hover:bg-orange-600">
                    Start Scanning
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border flex flex-col">
            {scannedItems.length === 0 ? (
              <div className="flex items-center justify-center h-[100px] text-gray-500">
                No scanned items yet. Click "Start Scanning" to begin reconciliation.
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <AssetReconciliationTable items={scannedItems} />
              </div>
            )}
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "~/components/shared/modal";
import { Button } from "~/components/shared/button";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSetAtom } from "jotai";
import { scannedItemsAtom, type ScannedRfidItem } from "~/atoms/rfid-scanner";
import { AssetReconciliationTable, type AssetReconciliationItem } from "./asset-reconciliation-table";
import { XIcon } from "lucide-react";
import DynamicSelect from "../dynamic-select/dynamic-select";
import type { Organization, UserOrganization } from "@prisma/client";
import { RfidScanner } from "./rfid-processor/rfid-scanner";
import type { RfidTag } from "./rfid-processor";
import { useRfidWebSocket } from "~/hooks/use-rfid-websocket";
import { RFID_CONFIG } from "./rfid-processor/config";

export function ScanRfidDialog({
  isOpen,
  onClose,
  onSave,
  organizationId,
  userOrganizations,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: ScannedRfidItem[], locationId?: string) => void;
  organizationId: Organization["id"];
  userOrganizations: Pick<UserOrganization, "organizationId">[];
}) {
  const [scannedItems, setScannedItems] = useState<AssetReconciliationItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [selectedLocationName, setSelectedLocationName] = useState<string>("");
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});
  const setGlobalScannedItems = useSetAtom(scannedItemsAtom);

  // Initialize the WebSocket RFID system
  const {
    isConnected,
    connectionState,
    streamRfidTag,
    startSession,
    endSession,
    isStreaming,
    sessionId,
    results,
    stats,
    error: streamingError,
    clearError,
    clearResults,
  } = useRfidWebSocket();

  // Clear scanning state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsScanning(false);
      setSelectedLocationId("");
      setSelectedLocationName("");
      setScannedItems([]);
      if (isStreaming) {
        endSession();
      }
      clearResults();
      clearError();
    }
  }, [isOpen, isStreaming, endSession, clearResults, clearError]);

  // Convert WebSocket results to reconciliation items
  useEffect(() => {
    const reconciliationItems: AssetReconciliationItem[] = results.map((result) => {
      if (result.asset) {
        // Map asset status to reconciliation status
        let status: "Available" | "In Use" | "Unknown" = "Unknown";
        if (result.asset.status === "AVAILABLE") {
          status = "Available";
        } else if (result.asset.status === "IN_CUSTODY" || result.asset.status === "CHECKED_OUT") {
          status = "In Use";
        }

        const currentLocation = result.asset.location?.name || "No Location Assigned";
        const currentLocationId = result.asset.location?.id;
        
        // Check if the asset's current location is different from the selected reconciliation location
        const locationMismatch = !!(
          selectedLocationId && 
          currentLocationId && 
          currentLocationId !== selectedLocationId
        );

        return {
          rfidTag: result.rfidTag,
          assetId: result.asset.id,
          assetName: result.asset.title,
          category: result.asset.category?.name || "Unknown",
          status,
          location: currentLocation,
          locationMismatch,
          selectedLocationName,
        };
      } else {
        return {
          rfidTag: result.rfidTag,
          assetId: "unknown",
          assetName: "Asset Not Found",
          category: "Unknown",
          status: "Unknown" as const,
          location: "Unknown Location",
          locationMismatch: false,
          selectedLocationName,
        };
      }
    });

    setScannedItems(reconciliationItems);
  }, [results, selectedLocationId, selectedLocationName]);

  // Handle new RFID tags from scanner
  const handleTagsScanned = useCallback(async (newTags: RfidTag[]) => {
    if (!sessionId || !isStreaming) {
      return;
    }

    // Process each tag individually through WebSocket
    for (const tag of newTags) {
      streamRfidTag(tag.tag);
    }
  }, [sessionId, isStreaming, streamRfidTag]);

  const handleStartScanning = useCallback(() => {
    if (!selectedLocationId) {
      return;
    }

    setIsScanning(true);
    startSession();
  }, [selectedLocationId, startSession]);

  const handleStopScanning = useCallback(() => {
    setIsScanning(false);
    if (isStreaming) {
      endSession();
    }
  }, [isStreaming, endSession]);

  const handleCancelBundle = () => {
    handleStopScanning();
    setScannedItems([]);
    clearResults();
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
    onSave(items, selectedLocationId);
    
    // Then update global state and close
    setGlobalScannedItems(items);
    setScannedItems([]);
    clearResults();
    setSelectedLocationId("");
    onClose();
  };

  const handleClose = () => {
    handleStopScanning();
    if (scannedItems.length > 0) {
      handleCancelBundle();
    } else {
      setSelectedLocationId("");
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="w-[95vw] max-w-4xl min-h-[10vh] max-h-[80vh] mx-4 my-4 sm:mx-auto sm:my-8 border-lg px-0 flex flex-col overflow-hidden">
        <AlertDialogHeader className="px-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="text-lg sm:text-xl font-semibold">Scan RFID Tags</AlertDialogTitle>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1">
              <XIcon className="h-5 w-5" />
            </button>
          </div>
          <AlertDialogDescription className="text-xs sm:text-sm text-gray-600 mt-2">
           Click start to begin scanning RFID tags
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className={`p-4 sm:p-6 flex-1 min-h-0 ${
          RFID_CONFIG.SHOW_RFID_SCANNER ? "overflow-y-auto" : "overflow-hidden"
        }`}>
          {/* Location Selection and Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex-1 w-full sm:max-w-md">
              <DynamicSelect
                fieldName="locationId"
                placeholder="Select a location"
                model={{ name: "location", queryKey: "name" }}
                contentLabel="Locations"
                initialDataKey="locations"
                countKey="totalLocations"
                closeOnSelect
                defaultValue={selectedLocationId}
                onChange={(locationId) => {
                  setSelectedLocationId(locationId || "");
                  // Location name will be fetched by useEffect
                }}
                extraContent={
                  <Button
                    to="/locations/new"
                    variant="link"
                    icon="plus"
                    className="w-full justify-start pt-4"
                    target="_blank"
                  >
                    Create new location
                  </Button>
                }
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              {/* Save Bundle Button */}
              {scannedItems.length > 0 && !isStreaming && (
                <Button 
                  onClick={handleSaveBundle} 
                  variant="outline" 
                  className="hover:bg-gray-100 border-gray-300 text-black text-sm w-full sm:w-auto"
                >
                  Save Bundle ({scannedItems.length} items)
                </Button>
              )}
              
              {/* Start/Stop Scanning Button */}
              {isScanning ? (
                <Button
                  onClick={handleStopScanning}
                  variant="outline"
                  className="hover:bg-gray-100 text-black border-gray-300 text-sm w-full sm:w-auto"
                >
                  Stop Scanning
                </Button>
              ) : (
                <Button
                  onClick={handleStartScanning}
                  disabled={!selectedLocationId}
                  className={`text-sm w-full sm:w-auto ${
                    selectedLocationId 
                      ? "bg-primary-500 hover:bg-primary-600 text-white" 
                      : "bg-gray-300 text-black/70 cursor-not-allowed"
                  }`}
                >
                  Start Scanning
                </Button>
              )}
            </div>
          </div>

          {/* {!selectedLocationId && (
            <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-800 text-sm">Please select a location before starting reconciliation.</p>
            </div>
          )} */}

          {/* RFID Scanner and Table Section */}
          <>
            {/* RFID Scanner Component */}
            <RfidScanner
              onTagsScanned={handleTagsScanned}
              isActive={isScanning}
            />

            {/* Real-time Asset Reconciliation Table */}
            <div className="bg-white rounded-sm border flex flex-col min-h-[200px] sm:min-h-[300px] max-h-[400px] mt-4 sm:mt-6">
              {scannedItems.length === 0 && !isStreaming ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2 p-4">
                  <p className="text-xs sm:mt-[125px] mt-[70px] sm:text-sm text-center max-w-xl">
                    {selectedLocationId 
                      ? "No scanned items yet. Click \"Start Scanning\" to begin reconciliation."
                      : "Select a location and click \"Start Scanning\" to begin reconciliation."
                    }
                  </p>
                </div>
              ) : (
                <div className="overflow-auto flex-1">
                  <div className="w-full">
                    <AssetReconciliationTable 
                      items={scannedItems} 
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

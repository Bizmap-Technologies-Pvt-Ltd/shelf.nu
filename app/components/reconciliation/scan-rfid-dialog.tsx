import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/shared/modal";
import { Button } from "~/components/shared/button";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSetAtom } from "jotai";
import { scannedItemsAtom, type ScannedRfidItem } from "~/atoms/rfid-scanner";
import { AssetReconciliationTable, type AssetReconciliationItem } from "./asset-reconciliation-table";
import { XIcon } from "lucide-react";
import DynamicSelect from "../dynamic-select/dynamic-select";
import type { Organization, UserOrganization } from "@prisma/client";
import { RfidScanner } from "./rfid-processor/rfid-scanner";
import type { RfidTag } from "./rfid-processor";
import { useAssetRfid } from "~/hooks/use-asset-rfid";

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
  const [isProcessing, setIsProcessing] = useState(false);
  const setGlobalScannedItems = useSetAtom(scannedItemsAtom);

  // Initialize the RFID asset hook
  const {
    getAssetsByRfidBatch,
    isBatchLoading,
    batchError,
    clearErrors,
  } = useAssetRfid(organizationId, userOrganizations);

  // Clear scanning state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsScanning(false);
      setSelectedLocationId("");
      setScannedItems([]);
      clearErrors();
    }
  }, [isOpen, clearErrors]);

  // Convert RFID tags to asset reconciliation items using real API
  const convertRfidTagsToAssets = useCallback(async (tags: RfidTag[]): Promise<AssetReconciliationItem[]> => {
    if (!tags.length) return [];

    try {
      setIsProcessing(true);
      clearErrors();

      // Extract unique RFID tag strings
      const rfidTags = [...new Set(tags.map(tag => tag.tag.trim()))].filter(Boolean);
      
      if (!rfidTags.length) return [];

      // Fetch real asset data using the API
      const foundAssets = await getAssetsByRfidBatch(rfidTags);

      // Create a map of found assets by RFID (case-insensitive)
      const foundAssetMap = new Map();
      foundAssets.forEach(asset => {
        foundAssetMap.set(asset.rfid.toLowerCase(), asset);
      });

      // Convert to reconciliation items
      const reconciliationItems: AssetReconciliationItem[] = rfidTags.map(rfidTag => {
        const lookupKey = rfidTag.toLowerCase();
        const foundAsset = foundAssetMap.get(lookupKey);
        
        if (foundAsset) {
          // Found real asset data
          return {
            rfidTag,
            assetId: foundAsset.id,
            assetName: foundAsset.title,
            category: foundAsset.category?.name || "Unknown",
            status: foundAsset.status || "Unknown",
            location: foundAsset.location?.name || selectedLocationId ? "Selected Location" : "Unknown Location",
          } as AssetReconciliationItem;
        } else {
          // Asset not found
          return {
            rfidTag,
            assetId: "unknown",
            assetName: "Asset Not Found",
            category: "Unknown",
            status: "Unknown",
            location: "Unknown Location",
          } as AssetReconciliationItem;
        }
      });

      return reconciliationItems;
    } catch (error) {
      // Fallback: create "Asset Not Found" entries for all tags
      return tags.map(tagData => ({
        rfidTag: tagData.tag,
        assetId: "unknown",
        assetName: "Asset Not Found",
        category: "Unknown",
        status: "Unknown",
        location: "Unknown Location",
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [selectedLocationId, getAssetsByRfidBatch, clearErrors]);

  // Handle new RFID tags from scanner
  const handleTagsScanned = useCallback(async (newTags: RfidTag[]) => {
    try {
      const newAssets = await convertRfidTagsToAssets(newTags);
      
      setScannedItems(prev => {
        // Filter out duplicates based on RFID tag
        const existingTags = new Set(prev.map(item => item.rfidTag));
        const uniqueNewAssets = newAssets.filter(asset => !existingTags.has(asset.rfidTag));
        
        const updatedItems = [...prev, ...uniqueNewAssets];
        
        return updatedItems;
      });
    } catch (error) {
      // Handle error silently or show user-friendly message
    }
  }, [convertRfidTagsToAssets]);

  const handleStartScanning = useCallback(() => {
    setIsScanning(true);
  }, []);

  const handleStopScanning = useCallback(() => {
    setIsScanning(false);
  }, []);

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
    onSave(items, selectedLocationId);
    
    // Then update global state and close
    setGlobalScannedItems(items);
    setScannedItems([]);
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
      <AlertDialogContent className="max-w-4xl max-h-[90vh] border-lg px-0 flex flex-col overflow-hidden">
        <AlertDialogHeader className="px-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="text-xl font-semibold">Scan RFID Tags</AlertDialogTitle>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 border border-gray-200 py-2 px-3 ">
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </AlertDialogHeader>

        <div className="p-6 flex-1 overflow-y-auto min-h-0">
          {/* Location Selection Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Select Location for Reconciliation</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-md">
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
              
              {/* RFID Control Button - Always visible when location is selected */}
              {selectedLocationId && (
                <div className="flex gap-2">
                  {isScanning ? (
                    <Button
                      onClick={handleStopScanning}
                      variant="outline"
                      className="bg-red-500 hover:bg-red-600 text-white border-red-500"
                    >
                      ⏹️ Stop Scanning
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStartScanning}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      ▶️ Start Scanning
                    </Button>
                  )}
                </div>
              )}
            </div>
            {!selectedLocationId && (
              <p className="text-sm text-gray-500 mt-2">Please select a location before starting reconciliation.</p>
            )}
          </div>

          {/* Scanning Section */}
          {selectedLocationId && (
            <>
              {/* RFID Scanner Component */}
              <RfidScanner
                onTagsScanned={handleTagsScanned}
                isActive={isScanning}
              />

              {/* Error Messages */}
              {batchError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-800 text-sm">
                    <strong>Error fetching assets:</strong> {batchError}
                  </p>
                </div>
              )}

              {/* Processing Status */}
              {(isProcessing || isBatchLoading) && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-blue-800 text-sm flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Processing RFID tags and fetching asset data...
                  </p>
                </div>
              )}

              {/* Save Button Section with Live Count */}
              <div className="flex justify-between items-center mb-4">
                {/* Live scanning counter */}
                <div className="flex items-center gap-2">
                  {isScanning && (
                    <div className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full border">
                      📊 Live Count: <span className="font-semibold text-blue-600">{scannedItems.length} items</span>
                    </div>
                  )}
                </div>
                
                {/* Save button */}
                {scannedItems.length > 0 && !isScanning && (
                  <Button 
                    onClick={handleSaveBundle} 
                    variant="outline" 
                    className="hover:bg-gray-100"
                    disabled={isProcessing || isBatchLoading}
                  >
                    Save Bundle ({scannedItems.length} items)
                  </Button>
                )}
              </div>

              <div className="bg-white rounded-lg border flex flex-col h-[400px]">
                {scannedItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No scanned items yet. Click "Start" on the RFID scanner to begin reconciliation.
                  </div>
                ) : (
                  <div className="overflow-auto flex-1 max-h-[400px]">
                    <div className="max-w-full">
                      <AssetReconciliationTable items={scannedItems} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

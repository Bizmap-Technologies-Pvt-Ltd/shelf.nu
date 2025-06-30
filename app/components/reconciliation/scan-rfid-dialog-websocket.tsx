import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "~/components/shared/modal";
import { Button } from "~/components/shared/button";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSetAtom } from "jotai";
import { scannedItemsAtom, type ScannedRfidItem } from "~/atoms/rfid-scanner";
import { AssetReconciliationTable, type AssetReconciliationItem } from "./asset-reconciliation-table";
import { RealTimeAssetReconciliationTable } from "./real-time-asset-reconciliation-table";
import { XIcon } from "lucide-react";
import DynamicSelect from "../dynamic-select/dynamic-select";
import type { Organization, UserOrganization } from "@prisma/client";
import { RfidScanner } from "./rfid-processor/rfid-scanner";
import type { RfidTag } from "./rfid-processor";
import { useStreamingRfidProcessor } from "./rfid-processor/use-streaming-rfid-processor";
import { useRfidWebSocket } from "~/hooks/use-rfid-websocket";

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

  // Create stable callback for tag processing
  const onTagProcessedRef = useRef<(tag: RfidTag) => void>();
  onTagProcessedRef.current = useCallback(async (tag: RfidTag) => {
    console.log(`[WebSocket Dialog] Processing tag: ${tag.tag}`);
    streamRfidTag(tag.tag);
  }, [streamRfidTag]);

  // Initialize the streaming RFID processor with stable callback
  const streamingProcessor = useStreamingRfidProcessor(
    useCallback((tag: RfidTag) => {
      onTagProcessedRef.current?.(tag);
    }, [])
  );

  // Create stable refs for processor methods to avoid dependency issues
  const processorMethodsRef = useRef({
    processTags: streamingProcessor.processTags,
    start: streamingProcessor.start,
    stop: streamingProcessor.stop,
  });
  processorMethodsRef.current = {
    processTags: streamingProcessor.processTags,
    start: streamingProcessor.start,
    stop: streamingProcessor.stop,
  };

  // Clear scanning state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsScanning(false);
      setSelectedLocationId("");
      setScannedItems([]);
      if (isStreaming) {
        endSession();
      }
      processorMethodsRef.current.stop();
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

        return {
          rfidTag: result.rfidTag,
          assetId: result.asset.id,
          assetName: result.asset.title,
          category: result.asset.category?.name || "Unknown",
          status,
          location: result.asset.location?.name || selectedLocationId ? "Selected Location" : "Unknown Location",
        };
      } else {
        return {
          rfidTag: result.rfidTag,
          assetId: "unknown",
          assetName: "Asset Not Found",
          category: "Unknown",
          status: "Unknown" as const,
          location: "Unknown Location",
        };
      }
    });

    setScannedItems(reconciliationItems);
  }, [results, selectedLocationId]);

  // Handle new RFID tags from scanner
  const handleTagsScanned = useCallback(async (newTags: RfidTag[]) => {
    if (!sessionId || !isStreaming) {
      console.log('[WebSocket Dialog] No active session for tag processing');
      return;
    }

    console.log(`[WebSocket Dialog] Received ${newTags.length} new tags for processing`);
    processorMethodsRef.current.processTags(newTags.map(tag => tag.tag));
  }, [sessionId, isStreaming]);

  const handleStartScanning = useCallback(() => {
    if (!selectedLocationId) {
      console.log('[WebSocket Dialog] Cannot start scanning without location selection');
      return;
    }

    console.log('[WebSocket Dialog] Starting WebSocket scan session');
    setIsScanning(true);
    startSession();
    processorMethodsRef.current.start();
  }, [selectedLocationId, startSession]);

  const handleStopScanning = useCallback(() => {
    console.log('[WebSocket Dialog] Stopping WebSocket scan session');
    setIsScanning(false);
    if (isStreaming) {
      endSession();
    }
    processorMethodsRef.current.stop();
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
      <AlertDialogContent className="max-w-4xl max-h-[90vh] border-lg px-0 flex flex-col overflow-hidden">
        <AlertDialogHeader className="px-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="text-xl font-semibold">Scan RFID Tags</AlertDialogTitle>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 border border-gray-200 py-2 px-3 ">
              <XIcon className="h-5 w-5" />
            </button>
          </div>
          <AlertDialogDescription className="text-sm text-gray-600 mt-2">
            Use this dialog to scan RFID tags and reconcile assets in real-time via WebSocket connection. Select a location first, then start scanning to see live results.
          </AlertDialogDescription>
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

              {/* WebSocket Connection Status */}
              {connectionState !== 'CONNECTED' && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-yellow-800 text-sm flex items-center gap-2">
                    {connectionState === 'CONNECTING' && (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        Connecting to RFID WebSocket stream...
                      </>
                    )}
                    {connectionState === 'DISCONNECTED' && (
                      <>⚠️ WebSocket disconnected - will reconnect automatically</>
                    )}
                    {connectionState === 'ERROR' && (
                      <>❌ WebSocket connection error - retrying...</>
                    )}
                  </p>
                </div>
              )}

              {/* Error Messages */}
              {streamingError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-800 text-sm">
                    <strong>WebSocket Error:</strong> {streamingError}
                    <button 
                      onClick={clearError}
                      className="ml-2 text-red-600 hover:text-red-800 underline text-xs"
                    >
                      Clear
                    </button>
                  </p>
                </div>
              )}

              {/* Processing Status with Real-time Stats */}
              {isStreaming && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <p className="text-blue-800 text-sm flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      Live WebSocket RFID streaming active...
                    </p>
                    <div className="flex gap-4 text-xs text-blue-600">
                      <span>Processed: {stats.totalProcessed}</span>
                      <span>Found: {stats.foundAssets}</span>
                      <span>Not Found: {stats.notFoundAssets}</span>
                      {stats.errors > 0 && <span>Errors: {stats.errors}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button Section with Live Count */}
              <div className="flex justify-between items-center mb-4">
                {/* Live streaming statistics */}
                <div className="flex items-center gap-2">
                  {isStreaming && (
                    <div className="text-sm text-gray-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                      🔄 WebSocket Stream: <span className="font-semibold text-green-600">{scannedItems.length} items</span>
                      {streamingProcessor.stats.currentlyProcessing > 0 && (
                        <span className="ml-2 text-blue-600">
                          (+{streamingProcessor.stats.currentlyProcessing} processing)
                        </span>
                      )}
                    </div>
                  )}
                  {!isStreaming && scannedItems.length > 0 && (
                    <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-full border">
                      📊 Total Scanned: <span className="font-semibold text-gray-800">{scannedItems.length} items</span>
                    </div>
                  )}
                </div>
                
                {/* Save button */}
                {scannedItems.length > 0 && !isStreaming && (
                  <Button 
                    onClick={handleSaveBundle} 
                    variant="outline" 
                    className="hover:bg-green-50 border-green-200 text-green-700"
                  >
                    💾 Save Bundle ({scannedItems.length} items)
                  </Button>
                )}
              </div>

              {/* Real-time Asset Reconciliation Table */}
              <div className="bg-white rounded-lg border flex flex-col h-[400px]">
                {scannedItems.length === 0 && !isStreaming ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
                    <div className="text-lg">🔄 Ready for WebSocket RFID Streaming</div>
                    <p className="text-sm text-center max-w-md">
                      Click "Start Scanning" to begin real-time RFID asset reconciliation via WebSocket. 
                      Results will appear here instantly as tags are processed.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-auto flex-1 max-h-[400px]">
                    <div className="max-w-full">
                      <RealTimeAssetReconciliationTable 
                        items={scannedItems} 
                        isProcessing={isStreaming}
                      />
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

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "~/components/shared/modal";
import { Button } from "~/components/shared/button";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSetAtom } from "jotai";
import { scannedItemsAtom, type ScannedRfidItem } from "../../atoms/rfid-scanner";
import { AssetReconciliationTable } from "./asset-reconciliation-table";
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
  const [scannedItems, setScannedItems] = useState<ScannedRfidItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  const setGlobalScannedItems = useSetAtom(scannedItemsAtom);

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

  const onTagProcessedRef = useRef<(tag: RfidTag) => void>();
  onTagProcessedRef.current = useCallback(
    (tag: RfidTag) => streamRfidTag(tag.tag),
    [streamRfidTag]
  );

  const streamingProcessor = useStreamingRfidProcessor(
    useCallback((tag: RfidTag) => {
      onTagProcessedRef.current?.(tag);
    }, [])
  );

  const processorRef = useRef(streamingProcessor);
  processorRef.current = streamingProcessor;

  useEffect(() => {
    if (!isOpen) {
      processorRef.current.stop();
      setScannedItems([]);
      setIsScanning(false);
      setSelectedLocationId("");
      clearResults();
      clearError();
      endSession();
    }
    return () => {
      processorRef.current.stop();
      clearResults();
      clearError();
    };
  }, [isOpen]);

  const reconciliationItems = useMemo(() => {
    return results.map((result) => {
      const asset = result.asset;
      return {
        rfid: result.rfidTag,
        asset: {
          id: asset?.id || "unknown",
          title: asset?.title || "Asset Not Found",
          category: asset?.category?.name || "Unknown",
          status:
            asset?.status === "AVAILABLE"
              ? "Available"
              : asset?.status === "IN_CUSTODY" || asset?.status === "CHECKED_OUT"
              ? "In Use"
              : "Unknown",
          location: asset?.location?.name || "Unknown Location",
        },
      };
    });
  }, [results]);

  useEffect(() => {
    setScannedItems(reconciliationItems);
  }, [reconciliationItems]);

  const handleTagsScanned = useCallback(
    (newTags: RfidTag[]) => {
      if (!sessionId || !isStreaming) return;
      const tagIds = newTags.map((tag) => tag.tag);
      processorRef.current.processTags(tagIds);
    },
    [sessionId, isStreaming]
  );

  const handleStartScanning = () => {
    if (!selectedLocationId) return;
    setIsScanning(true);
    startSession();
    processorRef.current.start();
  };

  const handleStopScanning = () => {
    setIsScanning(false);
    processorRef.current.stop();
    if (isStreaming) endSession();
  };

  const handleSaveBundle = () => {
    onSave(scannedItems, selectedLocationId);
    setGlobalScannedItems(scannedItems);
    setScannedItems([]);
    clearResults();
    setSelectedLocationId("");
    onClose();
  };

  const handleClose = () => {
    handleStopScanning();
    if (scannedItems.length > 0) {
      setScannedItems([]);
    }
    setSelectedLocationId("");
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="w-[95vw] sm:w-[90vw] max-w-5xl max-h-[90vh] border-lg px-0 flex flex-col overflow-hidden">
        <AlertDialogHeader className="px-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="text-xl font-semibold">
              Scan RFID Tags
            </AlertDialogTitle>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 p-2 border rounded"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
          <AlertDialogDescription className="text-sm text-gray-600 mt-2">
            Select a location and begin scanning RFID tags in real-time.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="p-6 flex-1 overflow-y-auto min-h-0">
          {/* Location Select & Actions */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
                  onChange={(id) => setSelectedLocationId(id || "")}
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

              {selectedLocationId && (
                <div className="flex gap-2 w-full sm:w-auto">
                  {isScanning ? (
                    <Button
                      onClick={handleStopScanning}
                      variant="outline"
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      ⏹️ Stop
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStartScanning}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      ▶️ Start
                    </Button>
                  )}
                </div>
              )}
            </div>
            {!selectedLocationId && (
              <p className="text-sm text-gray-500 mt-2">
                Please select a location to begin scanning.
              </p>
            )}
          </div>

          {/* WebSocket / Status Indicators */}
          {connectionState !== "CONNECTED" && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
              {connectionState === "CONNECTING" && "Connecting to RFID WebSocket..."}
              {connectionState === "DISCONNECTED" && "WebSocket disconnected."}
              {connectionState === "ERROR" && "WebSocket error occurred."}
            </div>
          )}

          {streamingError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-md">
              {streamingError}
              <button
                onClick={clearError}
                className="ml-2 underline text-xs text-red-600"
              >
                Clear
              </button>
            </div>
          )}

          {isStreaming && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-sm rounded-md text-blue-800">
              🔄 Streaming: {stats.totalProcessed} processed, {stats.foundAssets} found, {stats.notFoundAssets} not found
            </div>
          )}

          {/* RFID Scanner */}
          {selectedLocationId && (
            <>
              <RfidScanner onTagsScanned={handleTagsScanned} isActive={isScanning} />

              {/* Results */}
              <div className="mt-6 mb-4 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {isStreaming && (
                    <>
                      Scanning... <strong>{scannedItems.length}</strong> items
                    </>
                  )}
                  {!isStreaming && scannedItems.length > 0 && (
                    <>
                      ✅ Total Scanned:{" "}
                      <strong>{scannedItems.length}</strong>
                    </>
                  )}
                </div>

                {scannedItems.length > 0 && !isStreaming && (
                  <Button
                    onClick={handleSaveBundle}
                    variant="outline"
                    className="hover:bg-green-50 border-green-200 text-green-700"
                  >
                    💾 Save ({scannedItems.length})
                  </Button>
                )}
              </div>

              <div className="bg-white border rounded-lg h-[400px] flex flex-col overflow-hidden">
                {scannedItems.length === 0 && !isStreaming ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                    Ready to scan. Start scanning to see results here.
                  </div>
                ) : (
                  <div className="overflow-auto flex-1">
                    <AssetReconciliationTable items={scannedItems} />
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

// Example: Using the useAssetRfid hook in a component
// File: app/components/examples/rfid-scanner-component.tsx

import { useState } from "react";
import { useAssetRfid } from "~/hooks/use-asset-rfid";

export function RfidScannerComponent() {
  const [rfidInput, setRfidInput] = useState("");
  const [foundAsset, setFoundAsset] = useState<any>(null);
  const [batchRfids, setBatchRfids] = useState("");
  const [batchResults, setBatchResults] = useState<any[]>([]);

  const {
    getAssetByRfid,
    getAssetsByRfidBatch,
    checkRfidAvailability,
    isLoading,
    isBatchLoading,
    isAvailabilityChecking,
    error,
    batchError,
    availabilityError,
    clearErrors,
  } = useAssetRfid();

  // Single RFID lookup
  const handleSingleLookup = async () => {
    clearErrors();
    if (!rfidInput.trim()) return;

    const asset = await getAssetByRfid(rfidInput.trim());
    setFoundAsset(asset);
    
    if (asset) {
      console.log("Found asset:", asset.title);
    } else {
      console.log("No asset found with RFID:", rfidInput);
    }
  };

  // Batch RFID lookup
  const handleBatchLookup = async () => {
    clearErrors();
    if (!batchRfids.trim()) return;

    const rfidTags = batchRfids
      .split(/[,\n\s]+/)
      .map(tag => tag.trim())
      .filter(tag => tag !== "");

    const assets = await getAssetsByRfidBatch(rfidTags);
    setBatchResults(assets);
    console.log(`Found ${assets.length} of ${rfidTags.length} assets`);
  };

  // Check RFID availability
  const handleAvailabilityCheck = async () => {
    clearErrors();
    if (!rfidInput.trim()) return;

    const result = await checkRfidAvailability(rfidInput.trim());
    
    if (result.isAvailable) {
      alert("RFID is available for use!");
    } else {
      alert(`RFID already in use by: ${result.existingAsset?.title}`);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">RFID Asset Management</h2>

      {/* Single RFID Lookup */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Single RFID Lookup</h3>
        
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={rfidInput}
            onChange={(e) => setRfidInput(e.target.value)}
            placeholder="Enter RFID tag..."
            className="border rounded px-3 py-2 flex-1"
            disabled={isLoading}
          />
          <button
            onClick={handleSingleLookup}
            disabled={isLoading || !rfidInput.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? "Looking up..." : "Lookup"}
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={handleAvailabilityCheck}
            disabled={isAvailabilityChecking || !rfidInput.trim()}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isAvailabilityChecking ? "Checking..." : "Check Availability"}
          </button>
        </div>

        {/* Errors */}
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-2 rounded mb-4">
            {error}
          </div>
        )}

        {availabilityError && (
          <div className="text-red-600 text-sm bg-red-50 p-2 rounded mb-4">
            {availabilityError}
          </div>
        )}

        {/* Single Asset Result */}
        {foundAsset && (
          <div className="border rounded-lg p-4 bg-green-50">
            <h4 className="font-semibold">{foundAsset.title}</h4>
            <p>RFID: {foundAsset.rfid}</p>
            <p>Status: {foundAsset.status}</p>
            {foundAsset.category && <p>Category: {foundAsset.category.name}</p>}
            {foundAsset.location && <p>Location: {foundAsset.location.name}</p>}
          </div>
        )}
      </div>

      {/* Batch RFID Lookup */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Batch RFID Lookup</h3>
        
        <textarea
          value={batchRfids}
          onChange={(e) => setBatchRfids(e.target.value)}
          placeholder="Enter multiple RFID tags (separated by commas, spaces, or new lines)..."
          className="w-full border rounded px-3 py-2 min-h-[100px] mb-4"
          disabled={isBatchLoading}
        />

        <button
          onClick={handleBatchLookup}
          disabled={isBatchLoading || !batchRfids.trim()}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50 mb-4"
        >
          {isBatchLoading ? "Processing..." : "Batch Lookup"}
        </button>

        {batchError && (
          <div className="text-red-600 text-sm bg-red-50 p-2 rounded mb-4">
            {batchError}
          </div>
        )}

        {/* Batch Results */}
        {batchResults.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Found {batchResults.length} assets:</h4>
            <div className="grid gap-2">
              {batchResults.map((asset) => (
                <div key={asset.id} className="border rounded p-2 bg-blue-50">
                  <div className="flex justify-between">
                    <span className="font-medium">{asset.title}</span>
                    <span className="text-sm text-gray-600">RFID: {asset.rfid}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Status: {asset.status}
                    {asset.category && ` | Category: ${asset.category.name}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

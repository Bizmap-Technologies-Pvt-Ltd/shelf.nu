// Examples of using the RFID API routes

// 1. Single RFID Lookup (GET)
async function lookupAssetByRfid(rfid: string) {
  try {
    const response = await fetch(`/api/assets/rfid?rfid=${encodeURIComponent(rfid)}`);
    const result = await response.json();
    
    if (response.ok) {
      const asset = result.data?.asset;
      if (asset) {
        console.log("Found asset:", asset);
        return asset;
      } else {
        console.log("No asset found with RFID:", rfid);
        return null;
      }
    } else {
      console.error("Error:", result.error?.message);
      return null;
    }
  } catch (error) {
    console.error("Network error:", error);
    return null;
  }
}

// 2. Check RFID Availability (GET)
async function checkRfidAvailability(rfid: string, excludeAssetId?: string) {
  try {
    const params = new URLSearchParams({
      rfid,
      action: "check-availability",
    });
    
    if (excludeAssetId) {
      params.append("excludeAssetId", excludeAssetId);
    }
    
    const response = await fetch(`/api/assets/rfid?${params.toString()}`);
    const result = await response.json();
    
    if (response.ok) {
      return result.data; // { isAvailable: boolean, existingAsset?: Asset }
    } else {
      console.error("Error:", result.error?.message);
      return { isAvailable: false };
    }
  } catch (error) {
    console.error("Network error:", error);
    return { isAvailable: false };
  }
}

// 3. Batch RFID Lookup (POST)
async function batchLookupAssets(rfidTags: string[]) {
  try {
    const formData = new FormData();
    formData.append("intent", "batch-lookup");
    
    // Add each RFID tag to the form data
    rfidTags.forEach(tag => {
      formData.append("rfidTags", tag);
    });
    
    const response = await fetch("/api/assets/rfid", {
      method: "POST",
      body: formData,
    });
    
    const result = await response.json();
    
    if (response.ok) {
      const assets = result.data?.assets || [];
      console.log(`Found ${assets.length} of ${rfidTags.length} assets`);
      return assets;
    } else {
      console.error("Error:", result.error?.message);
      return [];
    }
  } catch (error) {
    console.error("Network error:", error);
    return [];
  }
}

// 4. Usage Examples

// Example 1: Simple asset lookup
async function example1() {
  const asset = await lookupAssetByRfid("RF123456789");
  if (asset) {
    alert(`Found: ${asset.title}`);
  }
}

// Example 2: Check if RFID is available before creating new asset
async function example2() {
  const newRfid = "RF999888777";
  const availability = await checkRfidAvailability(newRfid);
  
  if (availability.isAvailable) {
    // Safe to create new asset with this RFID
    console.log("RFID is available");
  } else {
    console.log(`RFID already used by: ${availability.existingAsset?.title}`);
  }
}

// Example 3: Inventory reconciliation
async function example3() {
  const scannedRfids = ["RF001", "RF002", "RF003", "RF004", "RF005"];
  const foundAssets = await batchLookupAssets(scannedRfids);
  
  const foundRfids = foundAssets.map(asset => asset.rfid);
  const missingRfids = scannedRfids.filter(rfid => !foundRfids.includes(rfid));
  
  console.log(`Inventory Check:`);
  console.log(`- Found: ${foundAssets.length} assets`);
  console.log(`- Missing: ${missingRfids.length} assets`);
  console.log(`- Missing RFIDs:`, missingRfids);
}

// Example 4: Real-time RFID scanner integration
function setupRfidScanner() {
  // This would integrate with your actual RFID scanner hardware/software
  function onRfidScanned(rfid: string) {
    // When an RFID tag is scanned
    lookupAssetByRfid(rfid).then(asset => {
      if (asset) {
        // Display asset information
        showAssetDetails(asset);
        
        // Optionally play sound or show notification
        playSuccessSound();
      } else {
        // Handle unknown RFID
        showUnknownRfidDialog(rfid);
      }
    });
  }
  
  // Mock scanner simulation (replace with real scanner integration)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      const rfid = e.target.value.trim();
      if (rfid) {
        onRfidScanned(rfid);
        e.target.value = ''; // Clear input for next scan
      }
    }
  });
}

function showAssetDetails(asset: any) {
  // Update UI with asset details
  console.log("Asset Details:", {
    title: asset.title,
    rfid: asset.rfid,
    status: asset.status,
    category: asset.category?.name,
    location: asset.location?.name,
    custodian: asset.custody?.custodian?.name,
  });
}

function showUnknownRfidDialog(rfid: string) {
  const shouldCreate = confirm(`Unknown RFID: ${rfid}\nWould you like to create a new asset?`);
  if (shouldCreate) {
    // Navigate to create asset page with pre-filled RFID
    window.location.href = `/assets/new?rfid=${encodeURIComponent(rfid)}`;
  }
}

function playSuccessSound() {
  // Play a success sound (beep, etc.)
  // You can use Web Audio API or HTML5 audio element
}

// Initialize the scanner when the page loads
if (typeof window !== 'undefined') {
  window.addEventListener('load', setupRfidScanner);
}

export {
  lookupAssetByRfid,
  checkRfidAvailability,
  batchLookupAssets,
  setupRfidScanner,
};

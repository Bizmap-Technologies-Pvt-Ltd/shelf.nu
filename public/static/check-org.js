// Organization context checker - Run this in browser console
async function checkCurrentOrganization() {
  try {
    console.log('=== Current Organization Context ===');
    
    // Check current URL for organization context
    console.log('Current URL:', window.location.href);
    
    console.log('\n=== Testing RFID API directly ===');
    
    // Test the RFID API with a known tag
    const testTag = 'TAG002';
    console.log(`Testing RFID API with tag: ${testTag}`);
    
    const response = await fetch(`/api/assets/rfid?rfid=${testTag}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const result = await response.json();
    console.log('RFID API Response:', {
      status: response.status,
      ok: response.ok,
      result: result,
      hasData: !!result.data,
      hasAsset: !!(result.data && result.data.asset),
      assetValue: result.data ? result.data.asset : 'NO_DATA'
    });
    
    // Also test if we can fetch the assets page data
    console.log('\n=== Testing Assets Page API ===');
    try {
      const assetsResponse = await fetch('/assets', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      });
      console.log('Assets page response status:', assetsResponse.status);
      
      // Also try the assets API endpoint if it exists
      const assetsApiResponse = await fetch('/api/assets', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      });
      console.log('Assets API response status:', assetsApiResponse.status);
    } catch (e) {
      console.log('Assets page test failed:', e.message);
    }
    
    // Check for any CSRF or authentication issues
    console.log('\n=== Headers and Auth Check ===');
    console.log('Response headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`${key}: ${value}`);
    }
    
  } catch (error) {
    console.error('Error checking organization context:', error);
  }
}

checkCurrentOrganization();

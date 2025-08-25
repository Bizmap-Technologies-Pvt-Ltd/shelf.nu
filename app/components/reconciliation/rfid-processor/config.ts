/**
 * RFID Scanner Configuration
 * 
 * Centralized configuration for all RFID scanning parameters.
 * Modify these values to adjust the behavior of the RFID system.
 */

export const RFID_CONFIG = {
  // ===== RFID COMPONENT =====
  
  /** Show/hide the entire RFID scanner component in frontend */
  SHOW_RFID_SCANNER: false, // Set to false to completely hide RFID scanner from UI
  
  // ===== FIELD CONFIGURATION ===== 
  
  /** Maximum number of tags per input field before switching */
  MAX_TAGS_PER_FIELD: 50,
  
  /** Maximum time (ms) per input field before switching */
  MAX_TIME_PER_FIELD: 3000, // 3 seconds

  /** Tag separators used by dummy generator */
  TAG_SEPARATORS: [",", " "],
  
  // ===== MOBILE/RFID SCANNER DEVICE CONFIGURATION =====
  
  /** Prevent virtual keyboard on mobile/RFID scanner devices */
  PREVENT_VIRTUAL_KEYBOARD: true, // Set to true to prevent on-screen keyboard
  
  // ===== TIMING =====

  /** Interval (ms) for monitoring active field */
  MONITOR_INTERVAL: 200,
  
  // ===== DUMMY DATA =====
  
  /** Enable/disable dummy RFID data generation */
  ENABLE_DUMMY_DATA: true, // Set to false to disable dummy data generation completely
  
  /** Interval (ms) for generating dummy RFID data */
  DUMMY_GENERATION_INTERVAL: 500, // 300ms

  /** Minimum tags per burst */
  DUMMY_MIN_TAGS_PER_BURST: 1,
  
  /** Maximum tags per burst */
  DUMMY_MAX_TAGS_PER_BURST: 3,

  /** Available dummy tags for testing */
DUMMY_TAGS: [
  "e2806A160000501774f2D046",  // mixed
  "e2806a160000401774f2d048",  // lower
  "E2004f38E59fE40a66E229FD",  // mixed
  "e2806894000040270e6514e7",  // lower
  "E2806A160000401774F2D042",  // upper
  "E2806894000050270e6514e0",  // mixed
  "e2004f38e59fe50A66e22A01",  // mixed
  "E2806A160000501774F2D03E",  // upper
  "e2806a160000401774f2d044",  // lower
  "20010001",                  // unchanged (already numeric)
  "E2806894000040270E6514DE",  // upper
  "e2801191a5030060c72fa114",  // lower
  "E2806a160000501774f2d040",  // mixed
  "E28011700000020D3E321316",  // upper
  "e2004f47cca8b68a7879e728"   // lower
],
} as const;

// Utility function to detect mobile/Android devices
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isAndroid = /android/i.test(userAgent);
  
  return isMobile || isAndroid;
}

// Utility function to check if virtual keyboard should be prevented
function shouldPreventVirtualKeyboard(): boolean {
  return RFID_CONFIG.PREVENT_VIRTUAL_KEYBOARD && isMobileDevice();
}

// Helper function to get configuration with environment overrides
export function getRfidConfig() {
  const config = {
    ...RFID_CONFIG,
    // Add environment-specific overrides here if needed
    _isMobileDevice: isMobileDevice(),
    _shouldPreventVirtualKeyboard: shouldPreventVirtualKeyboard(),
  };
  
  // Validate configuration values
  if (config.MAX_TAGS_PER_FIELD <= 0) {
    console.warn('RFID_CONFIG.MAX_TAGS_PER_FIELD must be positive, using default: 50');
    config.MAX_TAGS_PER_FIELD = 50;
  }
  
  if (config.MAX_TIME_PER_FIELD <= 0) {
    console.warn('RFID_CONFIG.MAX_TIME_PER_FIELD must be positive, using default: 3000');
    config.MAX_TIME_PER_FIELD = 3000;
  }
  
  if (config.MONITOR_INTERVAL <= 0) {
    console.warn('RFID_CONFIG.MONITOR_INTERVAL must be positive, using default: 200');
    config.MONITOR_INTERVAL = 200;
  }
  
  return config;
}

// Export utility functions for mobile device detection
export { isMobileDevice, shouldPreventVirtualKeyboard };

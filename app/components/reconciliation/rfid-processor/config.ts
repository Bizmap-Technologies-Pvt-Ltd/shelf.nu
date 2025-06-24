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
  MAX_TIME_PER_FIELD: 5000, // 2 seconds

  /** Tag separators used by dummy generator */
  TAG_SEPARATORS: [",", " "],
  
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
     "TAG002", "TAG003", "TAG004", "TAG005", "TAG006",
    "TAG007", "AA11BB"
  ],
} as const;

// Helper function to get configuration with environment overrides
export function getRfidConfig() {
  return {
    ...RFID_CONFIG,
    // Add environment-specific overrides here if needed
  };
}

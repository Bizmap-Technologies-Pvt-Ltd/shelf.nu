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
  MAX_TIME_PER_FIELD: 2000, // 2 seconds

  /** Tag separators used by dummy generator */
  TAG_SEPARATORS: [",", " "],
  
  // ===== TIMING =====

  /** Interval (ms) for monitoring active field */
  MONITOR_INTERVAL: 200,
  
  // ===== DUMMY DATA =====
  
  /** Enable/disable dummy RFID data generation */
  ENABLE_DUMMY_DATA: false, // Set to false to disable dummy data generation completely
  
  /** Interval (ms) for generating dummy RFID data */
  DUMMY_GENERATION_INTERVAL: 500, // 300ms

  /** Minimum tags per burst */
  DUMMY_MIN_TAGS_PER_BURST: 1,
  
  /** Maximum tags per burst */
  DUMMY_MAX_TAGS_PER_BURST: 3,

  /** Available dummy tags for testing */
  DUMMY_TAGS: [
  "E2806A160000501774F2D046",
  "E2806A160000401774F2D048",
  "E2004F38E59FE40A66E229FD",
  "E2806894000040270E6514E7",
  "E2806A160000401774F2D042",
  "E2806894000050270E6514E0",
  "E2004F38E59FE50A66E22A01",
  "E2806A160000501774F2D03E",
  "E2806A160000401774F2D044",
  "20010001",
  "E2806894000040270E6514DE",
  "E2801191A5030060C72FA114",
  "E2806A160000501774F2D040",
  "E28011700000020D3E321316",
  "E2004F47CCA8B68A7879E728"
],
} as const;

// Helper function to get configuration with environment overrides
export function getRfidConfig() {
  return {
    ...RFID_CONFIG,
    // Add environment-specific overrides here if needed
  };
}

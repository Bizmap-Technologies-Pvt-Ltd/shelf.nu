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
  MAX_TIME_PER_FIELD: 5000, // 10 seconds
  
  /** Tag separators used by dummy generator */
  TAG_SEPARATORS: [",", " "],
  
  // ===== TIMING =====

  /** Interval (ms) for monitoring active field */
  MONITOR_INTERVAL: 200,
  
  // ===== DUMMY DATA =====
  
  /** Enable/disable dummy RFID data generation */
  ENABLE_DUMMY_DATA: true, // Set to false to disable dummy data generation completely
  
  /** Interval (ms) for generating dummy RFID data */
  DUMMY_GENERATION_INTERVAL: 300, // 300ms

  /** Minimum tags per burst */
  DUMMY_MIN_TAGS_PER_BURST: 5,
  
  /** Maximum tags per burst */
  DUMMY_MAX_TAGS_PER_BURST: 50,

  /** Available dummy tags for testing */
  DUMMY_TAGS: [
  "TAG001", "TAG002", "TAG003", "TAG004", "TAG005",
  "TAG006", "TAG007", "TAG008", "TAG009", "TAG010",
  "TAG011", "TAG012", "TAG013", "TAG014", "TAG015",
  "TAG016", "TAG017", "TAG018", "TAG019", "TAG020",
  "TAG021", "TAG022", "TAG023", "TAG024", "TAG025",
  "TAG026", "TAG027", "TAG028", "TAG029", "TAG030",
  "TAG031", "TAG032", "TAG033", "TAG034", "TAG035",
  "TAG036", "TAG037", "TAG038", "TAG039", "TAG040",
  "TAG041", "TAG042", "TAG043", "TAG044", "TAG045",
  "TAG046", "TAG047", "TAG048", "TAG049", "TAG050",
  "TAG051", "TAG052", "TAG053", "TAG054", "TAG055",
  "TAG056", "TAG057", "TAG058", "TAG059", "TAG060",
  "TAG061", "TAG062", "TAG063", "TAG064", "TAG065",
  "TAG066", "TAG067", "TAG068", "TAG069", "TAG070",
  "TAG071", "TAG072", "TAG073", "TAG074", "TAG075",
  "TAG076", "TAG077", "TAG078", "TAG079", "TAG080",
  "TAG081", "TAG082", "TAG083", "TAG084", "TAG085",
  "TAG086", "TAG087", "TAG088", "TAG089", "TAG090",
  "TAG091", "TAG092", "TAG093", "TAG094", "TAG095",
  "TAG096", "TAG097", "TAG098", "TAG099", "TAG100",
  "TAG101", "TAG102", "TAG103", "TAG104", "TAG105",
  "TAG106", "TAG107", "TAG108", "TAG109", "TAG110",
  "TAG111", "TAG112", "TAG113", "TAG114", "TAG115",
  "TAG116", "TAG117", "TAG118", "TAG119", "TAG120",
  "TAG121", "TAG122", "TAG123", "TAG124", "TAG125",
  "TAG126", "TAG127", "TAG128", "TAG129", "TAG130",
  "TAG131", "TAG132", "TAG133", "TAG134", "TAG135",
  "TAG136", "TAG137", "TAG138", "TAG139", "TAG140",
  "TAG141", "TAG142", "TAG143", "TAG144", "TAG145",
  "TAG146", "TAG147", "TAG148", "TAG149", "TAG150",
  "TAG151", "TAG152", "TAG153", "TAG154", "TAG155",
  "TAG156", "TAG157", "TAG158", "TAG159", "TAG160",
  "TAG161", "TAG162", "TAG163", "TAG164", "TAG165",
  "TAG166", "TAG167", "TAG168", "TAG169", "TAG170",
  "TAG171", "TAG172", "TAG173", "TAG174", "TAG175",
  "TAG176", "TAG177", "TAG178", "TAG179", "TAG180",
  "TAG181", "TAG182", "TAG183", "TAG184", "TAG185",
  "TAG186", "TAG187", "TAG188", "TAG189", "TAG190",
  "TAG191", "TAG192", "TAG193", "TAG194", "TAG195",
  "TAG196", "TAG197", "TAG198", "TAG199", "TAG200"
]
,
} as const;

// Helper function to get configuration with environment overrides
export function getRfidConfig() {
  return {
    ...RFID_CONFIG,
    // Add environment-specific overrides here if needed
  };
}

import { Button } from "~/components/shared/button";
import { useRfidProcessor, useDummyRfid, type RfidTag, RFID_CONFIG } from ".";
import { useCallback, useRef, useEffect, useState } from "react";
import { delay } from "lodash";

// Default values for removed config options
const SHOW_LIVE_STATUS = true;
const SHOW_STATISTICS_PANEL = true;
const SHOW_INPUT_FIELDS = true;
const ENABLE_DETAILED_LOGGING = false;
const MAX_FIELDS_LIMIT = 20;
const PROCESS_REMAINING_ON_STOP = true;
const ENABLE_SMART_FIELD_REUSE = true;

export interface RfidScannerProps {
  onTagsScanned: (tags: RfidTag[]) => void;
  isActive: boolean;
  // Remove onStart and onStop - these will be handled externally
}

export function RfidScanner({ 
  onTagsScanned, 
  isActive
}: RfidScannerProps) {
  // ===== REFS AND STATE =====
  // Always initialize these, regardless of UI visibility
  // Hidden input field management (like your original processor.js)
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inputFieldsRef = useRef<(HTMLInputElement | HTMLTextAreaElement)[]>([]);
  const currentIndexRef = useRef(0);
  const lastUsedIndexRef = useRef(-1);
  const monitorIntervalRef = useRef<NodeJS.Timeout>();

  // Live logging state (only update if UI is visible)
  const [liveLog, setLiveLog] = useState<{
    currentField: number;
    currentFieldTags: number;
    currentFieldTime: number;
    lastAction: string;
    fieldStatus: string;
    totalFields: number;
  }>({
    currentField: 1,
    currentFieldTags: 0,
    currentFieldTime: 0,
    lastAction: "Initializing...",
    fieldStatus: "Ready",
    totalFields: 0,
  });

  // State for visible input fields (only needed if UI is visible)
  const [visibleFields, setVisibleFields] = useState<Array<{
    id: number;
    value: string;
    isActive: boolean;
    isProcessing: boolean;
    isProcessed: boolean;
    tagCount: number;
    timeActive: number;
  }>>([]);

  // ===== HELPER FUNCTIONS =====
  // Update visible fields helper
  const updateVisibleFields = useCallback(() => {
    if (!SHOW_INPUT_FIELDS || !RFID_CONFIG.SHOW_RFID_SCANNER) return;
    
    const fieldsData = inputFieldsRef.current.map((input, index) => {
      const isActive = input.classList.contains('active');
      const isProcessing = input.dataset.processing === 'true';
      const isProcessed = input.dataset.processed === 'true';
      const value = input.value || '';
      const tagCount = value.split(/[ ,\n\r]+/).filter(Boolean).length;
      const timeActive = isActive 
        ? Math.floor((Date.now() - parseInt(input.dataset.startTime || "0")) / 1000)
        : 0;
      
      return {
        id: index + 1,
        value,
        isActive,
        isProcessing,
        isProcessed,
        tagCount,
        timeActive
      };
    });
    
    setVisibleFields(fieldsData);
  }, []);

  // Update live log helper (only update if UI is visible)
  const updateLiveLog = useCallback((updates: Partial<typeof liveLog>) => {
    if (!RFID_CONFIG.SHOW_RFID_SCANNER) return;
    
    setLiveLog(prev => ({ ...prev, ...updates }));
    // Debounce visible fields update to improve performance
    const updateFields = () => {
      if (!SHOW_INPUT_FIELDS) return;
      updateVisibleFields();
    };
    
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(updateFields);
  }, [updateVisibleFields]);

  // Helper function to reliably focus the active field
  const focusActiveField = useCallback(() => {
    if (RFID_CONFIG.ENABLE_DUMMY_DATA) return; // Don't focus if dummy data is enabled
    
    const activeInput = inputFieldsRef.current[currentIndexRef.current] as HTMLTextAreaElement;
    if (activeInput && activeInput.classList.contains('active')) {
      // Force visibility and enable the input
      activeInput.style.pointerEvents = 'auto';
      activeInput.style.display = 'block';
      activeInput.disabled = false;
      activeInput.readOnly = false;
      activeInput.tabIndex = 0;
      
      // Remove focus from any other elements first
      if (document.activeElement && document.activeElement !== activeInput) {
        (document.activeElement as HTMLElement).blur();
      }
      
      // Multiple aggressive focus attempts with different methods
      const attemptFocus = (attempt: number) => {
        try {
          activeInput.focus();
          activeInput.click(); // Sometimes click helps establish focus
          const length = activeInput.value.length;
          activeInput.setSelectionRange(length, length);
          
          const isFocused = document.activeElement === activeInput;
          
          if (!isFocused && attempt < 5) {
            // Try again if not focused
            setTimeout(() => attemptFocus(attempt + 1), 50 * attempt);
          }
        } catch (error) {
          // Focus attempt failed
        }
      };
      
      // Start focus attempts
      attemptFocus(1);
      
    } else {
      // Cannot focus - Active input not found or not active
    }
  }, []);

  // Helper function to manage field visibility
  const updateFieldVisibility = useCallback(() => {
    if (!RFID_CONFIG.ENABLE_DUMMY_DATA) {
      inputFieldsRef.current.forEach((field, index) => {
        if (isActive) {
          // When scanning is active, only show the active field
          if (index === currentIndexRef.current && field.classList.contains('active')) {
            field.style.display = "block";
          } else {
            field.style.display = "none";
          }
        } else {
          // When scanning is not active, show all fields
          field.style.display = "block";
        }
      });
    }
  }, [isActive]);

  // ===== INITIALIZE PROCESSORS FIRST =====
  // These must always be initialized, regardless of UI visibility
  
  // Initialize RFID processor (no cooldown - only unique items)
  const rfidProcessor = useRfidProcessor(onTagsScanned);

  // Initialize dummy RFID data generator (for current testing)
  const dummyRfid = useDummyRfid(
    useCallback((tags: string[]) => {
      // Add tags to the active hidden input field (simulating real RFID reader behavior)
      const activeInput = inputFieldsRef.current[currentIndexRef.current];
      if (activeInput) {
        let bulkText = "";
        tags.forEach(tag => {
          const separator = RFID_CONFIG.TAG_SEPARATORS[Math.floor(Math.random() * RFID_CONFIG.TAG_SEPARATORS.length)];
          bulkText += tag + separator;
        });
        activeInput.value += bulkText;
        
        // Update live log instead of console (only if UI is visible)
        const currentCount = activeInput.value.split(/[ ,\n\r]+/).filter(Boolean).length;
        updateLiveLog({
          currentFieldTags: currentCount,
          lastAction: `Added ${tags.length} tags`,
          fieldStatus: "Receiving data"
        });
      }
    }, [updateLiveLog])
  );

  // ===== ESSENTIAL FUNCTIONS =====
  // These functions are needed for processing regardless of UI visibility

  // Create hidden input field (like your original createInputField function)
  const createInputField = useCallback(() => {
    if (!inputContainerRef.current) return null;

    try {
      const index = inputFieldsRef.current.length + 1;
      const input = document.createElement("textarea") as any; // Cast to handle both input and textarea
      input.readOnly = RFID_CONFIG.ENABLE_DUMMY_DATA; // Allow manual input when dummy data is disabled
      
      // Style the input field - make it visible for manual input
      if (!RFID_CONFIG.ENABLE_DUMMY_DATA) {
        // Make input visible and properly positioned for manual typing
        input.style.width = "100%";
        input.style.height = "80px"; // Set appropriate height for textarea
        input.style.minHeight = "80px";
        input.style.maxHeight = "200px";
        input.style.padding = "8px";
        input.style.border = "2px solid #10b981";
        input.style.borderRadius = "4px";
        input.style.fontSize = "14px";
        input.style.backgroundColor = "#f0fdf4";
        input.style.position = "static";
        input.style.opacity = "1";
        input.style.display = "block";
        input.style.resize = "vertical";
        input.style.fontFamily = "monospace"; // Use monospace for better readability
        input.placeholder = "Type RFID tags separated by commas, spaces, or new lines (press Enter for new line)...";
      } else {
        input.style.display = "none"; // Completely hidden for dummy data mode
      }
      
      input.dataset.count = "0";
      input.dataset.startTime = Date.now().toString();
      input.dataset.processing = "false";
      input.dataset.processed = "false";

      // Add direct event listener to handle Enter key when input is focused
      if (!RFID_CONFIG.ENABLE_DUMMY_DATA) {
        input.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            // Allow Enter to create new line in textarea (default behavior)
            // Don't prevent default to allow natural textarea behavior
            e.stopPropagation(); // Prevent event bubbling
          }
        });
        
        // Also add input event listener to update counts in real-time
        input.addEventListener('input', (e: Event) => {
          const target = e.target as HTMLTextAreaElement;
          const tags = target.value.split(/[ ,\n\r]+/).filter(Boolean);
          const tagCount = tags.length;
          
          // Update live log if this is the active field
          if (target.classList.contains('active')) {
            updateLiveLog({
              currentFieldTags: tagCount,
              lastAction: `Updated: ${tagCount} tags entered`,
              fieldStatus: tagCount > 0 ? "Collecting data" : "Waiting for data"
            });
          }
        });
      }

      // Make the first input active
      if (inputFieldsRef.current.length === 0) {
        input.classList.add("active");
        updateLiveLog({
          currentField: index,
          totalFields: index,
          lastAction: "Created first field",
          fieldStatus: "Active"
        });
        // Focus the field for manual input if enabled
        focusActiveField();
      } else {
        updateLiveLog({
          totalFields: index,
          lastAction: "Created new field",
          fieldStatus: "Available"
        });
      }

      inputContainerRef.current.appendChild(input);
      inputFieldsRef.current.push(input);
      
      // Update visible fields after creating new field
      setTimeout(updateVisibleFields, 100);
      
      // Update field visibility based on current scanning state
      setTimeout(updateFieldVisibility, 150);
      
      return input;
    } catch (error) {
      console.error("Error creating input field:", error);
      updateLiveLog({
        lastAction: "Error creating field",
        fieldStatus: "Error"
      });
      return null;
    }
  }, [updateLiveLog, updateVisibleFields]);

  // Switch input field logic (like your original switchInputField function)
  const switchInputField = useCallback(() => {
    const currentInput = inputFieldsRef.current[currentIndexRef.current];
    if (!currentInput) return;

    try {
      const raw = currentInput.value.trim();
      const tags = raw.split(/[ ,\n\r]+/).filter(Boolean);
      const now = Date.now();
      const currentFieldNum = currentIndexRef.current + 1;
      const timeActive = now - parseInt(currentInput.dataset.startTime || "0");

      // Prevent concurrent switching
      if (currentInput.dataset.processing === "true") {
        if (ENABLE_DETAILED_LOGGING) {
          console.warn(`⚠️ Field ${currentFieldNum} already processing, skipping switch`);
        }
        return;
      }

      // Update live log instead of console spam
      updateLiveLog({
        lastAction: `Switching from field ${currentFieldNum}`,
        fieldStatus: "Processing"
      });

      // Mark as processing and hide for manual input mode
      currentInput.dataset.processing = "true";
      currentInput.classList.remove("active");
      
      // Hide inactive field if in manual input mode
      if (!RFID_CONFIG.ENABLE_DUMMY_DATA) {
        currentInput.style.display = "none";
      }
 // Ensure UI updates before processing

    // Process tags from current field
    if (tags.length > 0) {
      rfidProcessor.processTags(tags);
      updateLiveLog({
        lastAction: `Processed ${tags.length} tags`,
        fieldStatus: "Processing"
      });
    }

    // FIELD SELECTION LOGIC: Smart reuse of available fields
    let nextIndex = -1;
    
    if (ENABLE_SMART_FIELD_REUSE) {
      // Priority 1: Look for processed (free) fields first
      for (let i = 0; i < inputFieldsRef.current.length; i++) {
        const checkIndex = (lastUsedIndexRef.current + 1 + i) % inputFieldsRef.current.length;
        const field = inputFieldsRef.current[checkIndex];
        if (field?.dataset.processed === "true" && field.dataset.processing !== "true") {
          nextIndex = checkIndex;
          lastUsedIndexRef.current = checkIndex;
          updateLiveLog({
            lastAction: `Reusing free field ${nextIndex + 1}`,
            fieldStatus: "Reusing processed field"
          });
          break;
        }
      }

      // Priority 2: Look for empty fields if no processed fields available
      if (nextIndex === -1) {
        for (let i = 0; i < inputFieldsRef.current.length; i++) {
          const checkIndex = (lastUsedIndexRef.current + 1 + i) % inputFieldsRef.current.length;
          const field = inputFieldsRef.current[checkIndex];
          if (field?.value.trim() === "" && field.dataset.processing !== "true") {
            nextIndex = checkIndex;
            lastUsedIndexRef.current = checkIndex;
            updateLiveLog({
              lastAction: `Using empty field ${nextIndex + 1}`,
              fieldStatus: "Using empty field"
            });
            break;
          }
        }
      }
    }

    // FIELD CREATION LOGIC: Create new field only if ALL existing fields are busy
    if (nextIndex === -1) {
      // Check if we've reached the maximum field limit
      if (inputFieldsRef.current.length >= MAX_FIELDS_LIMIT) {
        // Force reuse of the oldest processed field or least recently used field
        let fallbackIndex = -1;
        let oldestTime = Date.now();
        
        for (let i = 0; i < inputFieldsRef.current.length; i++) {
          const field = inputFieldsRef.current[i];
          const startTime = parseInt(field?.dataset.startTime || "0");
          if (startTime < oldestTime) {
            oldestTime = startTime;
            fallbackIndex = i;
          }
        }
        
        if (fallbackIndex !== -1) {
          nextIndex = fallbackIndex;
          lastUsedIndexRef.current = fallbackIndex;
          updateLiveLog({
            lastAction: `Force reusing field ${nextIndex + 1} (max limit reached)`,
            fieldStatus: "Force reuse - limit reached"
          });
          if (ENABLE_DETAILED_LOGGING) {
            console.warn(`⚠️ Maximum field limit (${MAX_FIELDS_LIMIT}) reached, force reusing field ${nextIndex + 1}`);
          }
        }
      } else {
        // All existing fields are busy - create a new field
        createInputField();
        currentIndexRef.current = inputFieldsRef.current.length - 1;
        lastUsedIndexRef.current = currentIndexRef.current;
        updateLiveLog({
          currentField: currentIndexRef.current + 1,
          lastAction: `Created new field ${currentIndexRef.current + 1} - all fields busy`,
          fieldStatus: "New field active"
        });
        // Field created successfully
      }
    }
    
    if (nextIndex !== -1) {
      currentIndexRef.current = nextIndex;
      updateLiveLog({
        currentField: currentIndexRef.current + 1,
        currentFieldTags: 0,
        fieldStatus: "Active"
      });
    }

    const newInput = inputFieldsRef.current[currentIndexRef.current];
    if (newInput) {
      // Reset if reusing processed field or forcing cycling
      if (newInput.dataset.processed === "true" || newInput.dataset.processing === "true") {
        // If field is still processing, wait a bit and then force reset
        if (newInput.dataset.processing === "true") {
          updateLiveLog({
            lastAction: `Force reset field ${currentIndexRef.current + 1} (was processing)`,
            fieldStatus: "Force reset"
          });
        }
        
        newInput.value = "";
        newInput.dataset.processed = "false";
        newInput.dataset.processing = "false";
        updateLiveLog({
          lastAction: `Cleared and reset field ${currentIndexRef.current + 1}`,
          currentFieldTags: 0
        });
      }
      
      newInput.dataset.startTime = Date.now().toString();
      newInput.classList.add("active");
      
      // Ensure only the active field is visible in manual input mode
      if (!RFID_CONFIG.ENABLE_DUMMY_DATA) {
        // Hide all other fields
        inputFieldsRef.current.forEach((field, index) => {
          if (index !== currentIndexRef.current) {
            field.style.display = "none";
          }
        });
        // Show the active field
        newInput.style.display = "block";
      }
      
      updateLiveLog({
        currentFieldTime: 0,
        fieldStatus: "Active - Ready for data"
      });
      
      // Focus the field for manual input if enabled
      focusActiveField();
    }

    // Mark old field as processed
    setTimeout(() => {
      currentInput.dataset.processing = "false";
      currentInput.dataset.processed = "true";
      updateLiveLog({
        lastAction: `Field ${currentFieldNum} ready for reuse`
      });
    }, 100);
    
    } catch (error) {
      console.error("Error switching field:", error);
      updateLiveLog({
        lastAction: "Error switching field",
        fieldStatus: "Error"
      });
    }
  }, [rfidProcessor.processTags, createInputField, updateLiveLog]);

  // Monitor active field (like your original monitorActiveField function)
  const monitorActiveField = useCallback(() => {
    const input = inputFieldsRef.current[currentIndexRef.current];
    if (!input) return;

    const rawText = input.value.trim();
    const tags = rawText.split(/[ ,\n\r]+/).filter(Boolean);
    const count = tags.length;
    const timeActive = Date.now() - parseInt(input.dataset.startTime || "0");

    input.dataset.count = count.toString();

    // Update live log with current status
    updateLiveLog({
      currentFieldTags: count,
      currentFieldTime: Math.floor(timeActive / 1000), // Convert to seconds
      fieldStatus: count > 0 ? "Collecting data" : "Waiting for data"
    });

    // Switch if max tags or max time passed
    if (count >= RFID_CONFIG.MAX_TAGS_PER_FIELD || timeActive >= RFID_CONFIG.MAX_TIME_PER_FIELD) {
      const reason = count >= RFID_CONFIG.MAX_TAGS_PER_FIELD ? `${count} tags reached` : `${Math.floor(timeActive/1000)}s timeout`;
      updateLiveLog({
        lastAction: `Switching: ${reason}`,
        fieldStatus: "Switching field"
      });
      switchInputField();
    }
  }, [switchInputField, updateLiveLog]);

  // ===== ESSENTIAL INITIALIZATION (Always Run Regardless of UI Visibility) =====
  
  // Initialize hidden input system when component mounts
  useEffect(() => {
    createInputField();
    updateLiveLog({
      lastAction: "RFID System Initialized",
      fieldStatus: "Ready"
    });
    
    // Focus the first field immediately after creation
    setTimeout(focusActiveField, 150);
    
    // Set initial field visibility (all fields visible when not scanning)
    setTimeout(updateFieldVisibility, 200);
    
    return () => {
      // Cleanup
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
      }
    };
  }, [createInputField, updateLiveLog, focusActiveField, updateFieldVisibility]);

  // Start/stop monitoring
  useEffect(() => {
    if (isActive) {
      monitorIntervalRef.current = setInterval(monitorActiveField, RFID_CONFIG.MONITOR_INTERVAL);
      updateLiveLog({
        lastAction: "Monitoring started",
        fieldStatus: "Active monitoring"
      });
      // Immediately focus the active field when scanning starts
      updateFieldVisibility();
      focusActiveField();
      setTimeout(() => {
        updateFieldVisibility();
        focusActiveField();
      }, 50);
      setTimeout(() => {
        updateFieldVisibility();
        focusActiveField();
      }, 200);
      setTimeout(() => {
        updateFieldVisibility();
        focusActiveField();
      }, 500);
    } else {
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
        monitorIntervalRef.current = undefined;
        updateLiveLog({
          lastAction: "Monitoring stopped",
          fieldStatus: "Stopped"
        });
      }
      // Show all fields when scanning stops
      setTimeout(updateFieldVisibility, 100);
    }

    return () => {
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
      }
    };
  }, [isActive, monitorActiveField, updateLiveLog, focusActiveField, updateFieldVisibility]);

  // Update field visibility when scanning state changes
  useEffect(() => {
    updateFieldVisibility();
  }, [isActive, updateFieldVisibility]);

  // Maintain focus on active field when dummy data is disabled
  useEffect(() => {
    if (!RFID_CONFIG.ENABLE_DUMMY_DATA && isActive) {
      const handleFocusLoss = () => {
        // Re-focus the active field if focus is lost
        setTimeout(focusActiveField, 100);
      };

      const handleClick = (e: MouseEvent) => {
        // If user clicks anywhere and we're in manual mode, ensure active field has focus
        const target = e.target as HTMLElement;
        const isInputField = target.tagName === 'INPUT' && inputFieldsRef.current.includes(target as HTMLInputElement);
        
        if (!isInputField) {
          // User clicked outside input fields, refocus active field
          setTimeout(focusActiveField, 50);
        }
      };

      // Add event listeners
      document.addEventListener('click', handleClick);
      window.addEventListener('blur', handleFocusLoss);

      // Initial focus
      focusActiveField();

      return () => {
        document.removeEventListener('click', handleClick);
        window.removeEventListener('blur', handleFocusLoss);
      };
    }
  }, [isActive, focusActiveField]);

  // Debug keyboard events and intercept keystrokes for manual input
  useEffect(() => {
    if (!RFID_CONFIG.ENABLE_DUMMY_DATA && isActive) {
      const handleKeyPress = (e: KeyboardEvent) => {
        const activeInput = inputFieldsRef.current[currentIndexRef.current];
        
        // If key is pressed but no input is focused, intercept and manually add to input
        if (document.activeElement !== activeInput && activeInput) {
          // Key pressed but wrong element focused - intercepting keystroke
          
          // Prevent the default behavior on the wrong element
          e.preventDefault();
          e.stopPropagation();
          
          // Manually handle the keystroke
          if (e.key.length === 1) { // Single character keys
            activeInput.value += e.key;
            activeInput.dispatchEvent(new Event('input', { bubbles: true }));
          } else if (e.key === 'Backspace') {
            activeInput.value = activeInput.value.slice(0, -1);
            activeInput.dispatchEvent(new Event('input', { bubbles: true }));
          } else if (e.key === 'Enter') {
            // Handle Enter key to add a new line character instead of just space
            activeInput.value += '\n';
            activeInput.dispatchEvent(new Event('input', { bubbles: true }));
          } else if (e.key === ' ' || e.key === ',') {
            activeInput.value += ' ';
            activeInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          // Try to focus again
          setTimeout(() => {
            updateFieldVisibility();
            focusActiveField();
          }, 10);
        }
      };

      // Use capture to intercept events before they reach other elements
      document.addEventListener('keydown', handleKeyPress, true);
      return () => {
        document.removeEventListener('keydown', handleKeyPress, true);
      };
    }
  }, [isActive, focusActiveField, updateFieldVisibility]);

  // Update visible fields periodically (only if UI is visible)
  useEffect(() => {
    if (SHOW_INPUT_FIELDS && RFID_CONFIG.SHOW_RFID_SCANNER && isActive) {
      const fieldUpdateInterval = setInterval(updateVisibleFields, 500); // Update every 500ms
      return () => clearInterval(fieldUpdateInterval);
    }
  }, [isActive, updateVisibleFields]);

  // Start/stop processors based on isActive prop - CRITICAL: Always run this regardless of UI visibility
  useEffect(() => {
    if (isActive) {
      rfidProcessor.start();
      dummyRfid.startSimulation();
    } else {
      // Handle stop logic
      let totalRemainingTags = 0;
    
    // Process remaining data if configured to do so
    if (PROCESS_REMAINING_ON_STOP) {
      inputFieldsRef.current.forEach((input, index) => {
        if (input && input.value.trim()) {
          const raw = input.value.trim();
          const tags = raw.split(/[ ,\n\r]+/).filter(Boolean);
          
          if (tags.length > 0) {
            totalRemainingTags += tags.length;
            
            // Process remaining tags
            rfidProcessor.processTags(tags);
            
            // Mark field as processed
            input.dataset.processing = "false";
            input.dataset.processed = "true";
            input.classList.remove("active");
          }
        }
      });

      updateLiveLog({
        lastAction: totalRemainingTags > 0 
          ? `Processed ${totalRemainingTags} remaining tags before stop`
          : "Stopped - no remaining data",
        fieldStatus: "Stopped"
      });

    } else {
      // Count but don't process remaining tags
      inputFieldsRef.current.forEach((input) => {
        if (input && input.value.trim()) {
          const tags = input.value.split(/[ ,\n\r]+/).filter(Boolean);
          totalRemainingTags += tags.length;
        }
      });

      updateLiveLog({
        lastAction: totalRemainingTags > 0 
          ? `Stopped - ${totalRemainingTags} tags ignored`
          : "Stopped - no remaining data",
        fieldStatus: "Stopped"
      });
    }

    // Stop all processes
      rfidProcessor.stop();
      dummyRfid.stopSimulation();
    }
  }, [isActive, rfidProcessor.start, rfidProcessor.stop, rfidProcessor.processTags, dummyRfid.startSimulation, dummyRfid.stopSimulation, updateLiveLog]);

  // Check if RFID scanner UI should be shown
  if (!RFID_CONFIG.SHOW_RFID_SCANNER) {
    return (
      <div style={{ display: "none" }}>
        {/* Hidden input container for RFID reader compatibility - still needed for processing */}
        <div ref={inputContainerRef} />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-6 border">
      {/* Input container for RFID compatibility - visible for manual input */}
      <div 
        ref={inputContainerRef} 
        style={{ 
          display: RFID_CONFIG.ENABLE_DUMMY_DATA ? "none" : "block",
          marginBottom: "16px"
        }} 
      />
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            🛰️ RFID Scanner
            {!RFID_CONFIG.ENABLE_DUMMY_DATA && (
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Manual Input Enabled</span>
            )}
            {RFID_CONFIG.ENABLE_DUMMY_DATA && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Dummy Data Enabled</span>
            )}
          </h3>
          <p className="text-sm text-gray-600">
            {isActive ? (
              <span className="text-green-600 font-medium">
                ● Running - {!RFID_CONFIG.ENABLE_DUMMY_DATA 
                  ? "Place RFID tags within scanner range or type manually in active field" 
                  : "Place RFID tags within scanner range"}
              </span>
            ) : (
              !RFID_CONFIG.ENABLE_DUMMY_DATA 
                ? "Click start to begin scanning RFID tags or typing manually"
                : "Click start to begin scanning RFID tags"
            )}
          </p>
        </div>
      </div>

      {/* Stats Section */}
      {SHOW_STATISTICS_PANEL && (
        <div className="grid grid-cols-3 gap-4 text-sm mb-4">
          <div className="text-center">
            <div className="text-green-600 font-semibold text-lg">
              {rfidProcessor.stats.totalSent}
            </div>
            <div className="text-gray-600">✅ Sent</div>
          </div>
          <div className="text-center">
            <div className="text-red-600 font-semibold text-lg">
              {rfidProcessor.stats.totalSkipped}
            </div>
            <div className="text-gray-600">⛔ Skipped</div>
          </div>
          <div className="text-center">
            <div className="text-blue-600 font-semibold text-lg">
              {rfidProcessor.stats.totalReceived}
            </div>
            <div className="text-gray-600">📥 Received</div>
          </div>
        </div>
      )}

      {/* Live Status Display */}
      {isActive && SHOW_LIVE_STATUS && (
        <div className="bg-white rounded border p-3 text-xs font-mono mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-gray-500 mb-1">Active Field</div>
              <div className="font-semibold">
                Field {liveLog.currentField} ({liveLog.currentFieldTags} tags, {liveLog.currentFieldTime}s)
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Total Fields</div>
              <div className="font-semibold">
                {liveLog.totalFields} created
                {ENABLE_SMART_FIELD_REUSE && (
                  <span className="ml-2 text-blue-600 font-normal">🔄 Smart Reuse</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Status</div>
              <div className="font-semibold text-blue-600">{liveLog.fieldStatus}</div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Last Action</div>
              <div className="font-semibold text-gray-700">{liveLog.lastAction}</div>
            </div>
          </div>
          
          {/* Field smart reuse status */}
          {ENABLE_SMART_FIELD_REUSE && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="text-gray-500 text-xs">
                Smart Field Reuse: <span className="text-blue-600 font-semibold">ENABLED</span>
                <span className="ml-2 text-gray-400">(Reuses free fields before creating new ones)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Input Help */}
      {isActive && !RFID_CONFIG.ENABLE_DUMMY_DATA && SHOW_INPUT_FIELDS && (
        <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
          <div className="text-sm text-green-800">
            <div className="font-semibold mb-1">💡 Manual Input Mode</div>
            <div className="text-xs">
              You can type RFID tags manually in the active field (green border) below. 
              Separate multiple tags with commas or spaces. The field will automatically switch when full or after timeout.
            </div>
          </div>
        </div>
      )}

      {/* Input Fields Visualization */}
      {SHOW_INPUT_FIELDS && visibleFields.length > 0 && (
        <div className="bg-white rounded border p-4 mb-4">
          <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            📋 Input Fields ({visibleFields.length} total)
            <span className="ml-2 text-xs text-gray-500">Live Processing View</span>
          </div>
          
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {visibleFields.map((field) => (
              <div 
                key={field.id} 
                className={`border rounded p-3 transition-all duration-300 ${
                  field.isActive 
                    ? 'border-green-500 bg-green-50' 
                    : field.isProcessing 
                    ? 'border-primary-500 bg-primary-50'
                    : field.isProcessed 
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Field {field.id}</span>
                    {field.isActive && <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">ACTIVE</span>}
                    {field.isProcessing && <span className="text-xs bg-primary-600 text-white px-2 py-0.5 rounded">PROCESSING</span>}
                    {field.isProcessed && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">PROCESSED</span>}
                    {ENABLE_SMART_FIELD_REUSE && field.isProcessed && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">REUSABLE</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600">
                    {field.tagCount} tags
                    {field.isActive && field.timeActive > 0 && ` • ${field.timeActive}s`}
                  </div>
                </div>
                 <div className="relative">
                  <textarea
                    readOnly={RFID_CONFIG.ENABLE_DUMMY_DATA}
                    value={field.value}
                    onChange={(e) => {
                      // Update the actual hidden input field when user types
                      if (!RFID_CONFIG.ENABLE_DUMMY_DATA && field.isActive) {
                        const hiddenInput = inputFieldsRef.current[field.id - 1];
                        if (hiddenInput) {
                          hiddenInput.value = e.target.value;
                        }
                      }
                    }}
                    className={`w-full h-16 text-xs font-mono border rounded resize-none ${
                      field.isActive 
                        ? 'border-green-300 bg-green-25' 
                        : 'border-gray-200 bg-gray-100'
                    } ${!RFID_CONFIG.ENABLE_DUMMY_DATA && field.isActive ? 'cursor-text' : ''}`}
                    placeholder={!RFID_CONFIG.ENABLE_DUMMY_DATA && field.isActive
                      ? "Type RFID tags separated by commas or spaces..." 
                      : "No RFID data..."}
                  />
                  {field.value && (
                    <div className="absolute top-1 right-1 text-xs bg-white px-1 rounded shadow">
                      {field.tagCount} tags
                    </div>
                  )}
                </div>

                {/* Progress bar for active field */}
                {field.isActive && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Progress to switch</span>
                      <span>
                        {Math.min(field.tagCount, RFID_CONFIG.MAX_TAGS_PER_FIELD)}/{RFID_CONFIG.MAX_TAGS_PER_FIELD} tags
                        {field.timeActive > 0 && ` • ${field.timeActive}/${Math.floor(RFID_CONFIG.MAX_TIME_PER_FIELD/1000)}s`}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-green-600 h-1.5 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${Math.min(
                            Math.max(
                              (field.tagCount / RFID_CONFIG.MAX_TAGS_PER_FIELD) * 100,
                              (field.timeActive * 1000 / RFID_CONFIG.MAX_TIME_PER_FIELD) * 100
                            ), 
                            100
                          )}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

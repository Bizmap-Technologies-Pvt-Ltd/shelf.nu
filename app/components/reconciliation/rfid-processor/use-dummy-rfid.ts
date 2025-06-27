import { useState, useRef, useEffect, useCallback } from "react";
import { RFID_CONFIG } from "./config";

export interface UseDummyRfidReturn {
  isSimulating: boolean;
  startSimulation: () => void;
  stopSimulation: () => void;
}

export function useDummyRfid(
  onTagsGenerated: (tags: string[]) => void,
  intervalMs: number = RFID_CONFIG.DUMMY_GENERATION_INTERVAL
): UseDummyRfidReturn {
  const [isSimulating, setIsSimulating] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  const generateRandomTagBurst = useCallback(() => {
    if (!isSimulating) return;

    // Generate configurable tags per burst
    const burstSize = Math.floor(Math.random() * (RFID_CONFIG.DUMMY_MAX_TAGS_PER_BURST - RFID_CONFIG.DUMMY_MIN_TAGS_PER_BURST + 1)) + RFID_CONFIG.DUMMY_MIN_TAGS_PER_BURST;
    const tags: string[] = [];

    for (let i = 0; i < burstSize; i++) {
      const tag = RFID_CONFIG.DUMMY_TAGS[Math.floor(Math.random() * RFID_CONFIG.DUMMY_TAGS.length)];
      tags.push(tag);
    }

    onTagsGenerated(tags);
  }, [isSimulating, onTagsGenerated]);

  const startSimulation = useCallback(() => {
    if (!RFID_CONFIG.ENABLE_DUMMY_DATA) {
      // Dummy data is disabled
      return;
    }
    
    if (isSimulating) return;
    
    setIsSimulating(true);
    intervalRef.current = setInterval(generateRandomTagBurst, intervalMs);
  }, [isSimulating, generateRandomTagBurst, intervalMs]);

  const stopSimulation = useCallback(() => {
    if (!isSimulating) return;
    
    setIsSimulating(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, [isSimulating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Update interval when isSimulating changes
  useEffect(() => {
    if (isSimulating && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(generateRandomTagBurst, intervalMs);
    }
  }, [isSimulating, generateRandomTagBurst, intervalMs]);

  return {
    isSimulating,
    startSimulation,
    stopSimulation,
  };
}

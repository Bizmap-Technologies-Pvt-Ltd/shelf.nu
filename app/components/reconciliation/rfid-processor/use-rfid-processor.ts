import { useState, useRef, useEffect, useCallback } from "react";
import { RFID_CONFIG } from "./config";

export interface RfidProcessorStats {
  totalSent: number;
  totalSkipped: number;
  totalReceived: number;
}

export interface RfidTag {
  tag: string;
  timestamp: number;
}

export interface UseRfidProcessorReturn {
  isRunning: boolean;
  stats: RfidProcessorStats;
  processTags: (tags: string[]) => void;
  start: () => void;
  stop: () => void;
  getProcessedTags: () => RfidTag[];
  clearTags: () => void;
}

export function useRfidProcessor(
  onTagsProcessed?: (tags: RfidTag[]) => void
): UseRfidProcessorReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<RfidProcessorStats>({
    totalSent: 0,
    totalSkipped: 0,
    totalReceived: 0,
  });

  const seenTagsRef = useRef<Map<string, number>>(new Map());
  const processedTagsRef = useRef<RfidTag[]>([]);
  const maxTagsRef = useRef(10000); // Prevent memory bloat

  const processTags = useCallback((tags: string[]) => {
    if (!isRunning || !tags.length) return;

    const now = Date.now();
    const newTags: RfidTag[] = [];
    let sent = 0;
    let skipped = 0;

    // Clean up seenTags map to prevent memory bloat (keep only unique tags, no time-based cleanup)
    if (seenTagsRef.current.size > 10000) {
      // Clear oldest entries to prevent memory bloat, keeping recent unique tags
      const entries = Array.from(seenTagsRef.current.entries());
      const recentEntries = entries.slice(-5000); // Keep last 5000 unique tags
      seenTagsRef.current.clear();
      recentEntries.forEach(([tag, timestamp]) => {
        seenTagsRef.current.set(tag, timestamp);
      });
    }

    tags.forEach(tag => {
      if (!tag?.trim()) return;
      
      const cleanTag = tag.trim();
      
      // Validate tag format (basic validation)
      if (cleanTag.length < 2 || cleanTag.length > 100) {
        // Skip invalid tags silently in production
        return;
      }
      
      // Check if tag has been seen before (NO TIME-BASED COOLDOWN)
      const alreadySeen = seenTagsRef.current.has(cleanTag);

      if (!alreadySeen) {
        // Tag is truly unique - add it
        seenTagsRef.current.set(cleanTag, now);
        newTags.push({ tag: cleanTag, timestamp: now });
        sent++;
      } else {
        // Tag is duplicate - skip it
        skipped++;
      }
    });

    if (newTags.length > 0) {
      processedTagsRef.current.push(...newTags);
      
      // Prevent memory bloat by limiting stored tags
      if (processedTagsRef.current.length > maxTagsRef.current) {
        processedTagsRef.current = processedTagsRef.current.slice(-maxTagsRef.current);
      }
      
      onTagsProcessed?.(newTags);
    }

    setStats(prev => ({
      totalSent: prev.totalSent + sent,
      totalSkipped: prev.totalSkipped + skipped,
      totalReceived: prev.totalReceived + tags.length,
    }));
  }, [isRunning, onTagsProcessed]);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
  }, []);

  const getProcessedTags = useCallback(() => {
    return [...processedTagsRef.current];
  }, []);

  const clearTags = useCallback(() => {
    processedTagsRef.current = [];
    seenTagsRef.current.clear();
    setStats({
      totalSent: 0,
      totalSkipped: 0,
      totalReceived: 0,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isRunning,
    stats,
    processTags,
    start,
    stop,
    getProcessedTags,
    clearTags,
  };
}

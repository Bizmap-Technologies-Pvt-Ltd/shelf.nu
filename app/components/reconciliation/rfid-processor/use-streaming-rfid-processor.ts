import { useState, useRef, useEffect, useCallback } from "react";
import { RFID_CONFIG } from "./config";
import type { RfidTag } from "./use-rfid-processor";

export interface StreamingRfidProcessorStats {
  totalProcessed: number;
  foundAssets: number;
  notFoundAssets: number;
}

export interface UseStreamingRfidProcessorReturn {
  isRunning: boolean;
  stats: StreamingRfidProcessorStats;
  processTags: (tags: string[]) => void;
  start: () => void;
  stop: () => void;
  getProcessedTags: () => RfidTag[];
  clearTags: () => void;
}

// Throttle duplicate tag processing for streaming
const STREAMING_TAG_THROTTLE_MS = 100;

export function useStreamingRfidProcessor(
  onTagProcessed?: (tag: RfidTag) => void
): UseStreamingRfidProcessorReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<StreamingRfidProcessorStats>({
    totalProcessed: 0,
    foundAssets: 0,
    notFoundAssets: 0,
  });

  const seenTagsRef = useRef<Map<string, number>>(new Map());
  const processedTagsRef = useRef<RfidTag[]>([]);
  const maxTagsRef = useRef(10000);
  const lastTagTimeRef = useRef<Map<string, number>>(new Map());

  const processTags = useCallback((tags: string[]) => {
    if (!isRunning || !tags.length) return;
    const now = Date.now();
    const newTags: RfidTag[] = [];
    let processed = 0;

    // Clean up memory periodically
    if (seenTagsRef.current.size > 10000) {
      const entries = Array.from(seenTagsRef.current.entries());
      const recentEntries = entries.slice(-5000);
      seenTagsRef.current.clear();
      recentEntries.forEach(([tag, timestamp]) => {
        seenTagsRef.current.set(tag, timestamp);
      });
    }

    tags.forEach(tag => {
      if (!tag?.trim()) return;
      
      // Normalize RFID tag
      const cleanTag = tag.trim().toUpperCase();
      
      // Validate tag format
      if (cleanTag.length < 2 || cleanTag.length > 100) {
        return;
      }
      
      // Throttle for streaming
      const lastTime = lastTagTimeRef.current.get(cleanTag) || 0;
      if (now - lastTime < STREAMING_TAG_THROTTLE_MS) {
        return;
      }
      lastTagTimeRef.current.set(cleanTag, now);
      
      // Check if tag has been seen before
      const alreadySeen = seenTagsRef.current.has(cleanTag);

      if (!alreadySeen) {
        seenTagsRef.current.set(cleanTag, now);
        const newTag = { tag: cleanTag, timestamp: now };
        newTags.push(newTag);
        processed++;
        
        // Process tag immediately for streaming
        onTagProcessed?.(newTag);
      }
    });

    if (newTags.length > 0) {
      processedTagsRef.current.push(...newTags);
      
      // Prevent memory bloat
      if (processedTagsRef.current.length > maxTagsRef.current) {
        processedTagsRef.current = processedTagsRef.current.slice(-maxTagsRef.current);
      }
    }

    setStats(prev => ({
      ...prev,
      totalProcessed: prev.totalProcessed + processed,
    }));
  }, [isRunning, onTagProcessed]);

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
    lastTagTimeRef.current.clear();
    setStats({
      totalProcessed: 0,
      foundAssets: 0,
      notFoundAssets: 0,
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

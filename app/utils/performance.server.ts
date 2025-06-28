import { Logger } from "./logger";

/**
 * Performance monitoring utilities for tracking slow operations
 */

export interface PerformanceMetrics {
  operationName: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

const SLOW_OPERATION_THRESHOLD = 1000; // 1 second
const performanceMetrics: PerformanceMetrics[] = [];

/**
 * Wraps a function to measure its execution time
 */
export async function measurePerformance<T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    // Log performance metrics
    logPerformanceMetric({
      operationName,
      duration,
      timestamp: new Date(),
      metadata,
    });
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Log even failed operations for performance tracking
    logPerformanceMetric({
      operationName: `${operationName} (failed)`,
      duration,
      timestamp: new Date(),
      metadata: { ...metadata, error: String(error) },
    });
    
    throw error;
  }
}

/**
 * Logs performance metrics and warns about slow operations
 */
function logPerformanceMetric(metric: PerformanceMetrics) {
  // Store metric for analysis
  performanceMetrics.push(metric);
  
  // Keep only last 1000 metrics to prevent memory leaks
  if (performanceMetrics.length > 1000) {
    performanceMetrics.shift();
  }
  
  // Log slow operations
  if (metric.duration > SLOW_OPERATION_THRESHOLD) {
    Logger.warn({
      message: `Slow operation detected: ${metric.operationName}`,
      label: "Performance",
      data: {
        duration: `${metric.duration.toFixed(2)}ms`,
        metadata: metric.metadata,
      },
    });
  }
  
  // Log in development for debugging
  if (process.env.NODE_ENV === "development" && metric.duration > 500) {
    console.log(`⚡ ${metric.operationName}: ${metric.duration.toFixed(2)}ms`);
  }
}

/**
 * Gets performance statistics for the last hour
 */
export function getPerformanceStats() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  const recentMetrics = performanceMetrics.filter(
    metric => metric.timestamp > oneHourAgo
  );
  
  if (recentMetrics.length === 0) {
    return {
      totalOperations: 0,
      averageDuration: 0,
      slowOperations: 0,
      operationBreakdown: {},
    };
  }
  
  const totalDuration = recentMetrics.reduce((sum, metric) => sum + metric.duration, 0);
  const slowOperations = recentMetrics.filter(metric => metric.duration > SLOW_OPERATION_THRESHOLD);
  
  // Group by operation name
  const operationBreakdown = recentMetrics.reduce((acc, metric) => {
    const cleanName = metric.operationName.replace(" (failed)", "");
    if (!acc[cleanName]) {
      acc[cleanName] = {
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        slowCount: 0,
      };
    }
    
    acc[cleanName].count++;
    acc[cleanName].totalDuration += metric.duration;
    acc[cleanName].averageDuration = acc[cleanName].totalDuration / acc[cleanName].count;
    
    if (metric.duration > SLOW_OPERATION_THRESHOLD) {
      acc[cleanName].slowCount++;
    }
    
    return acc;
  }, {} as Record<string, {
    count: number;
    totalDuration: number;
    averageDuration: number;
    slowCount: number;
  }>);
  
  return {
    totalOperations: recentMetrics.length,
    averageDuration: totalDuration / recentMetrics.length,
    slowOperations: slowOperations.length,
    operationBreakdown,
  };
}

/**
 * Database query performance wrapper
 */
export async function measureDbQuery<T>(
  queryName: string,
  query: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return measurePerformance(`DB Query: ${queryName}`, query, metadata);
}

/**
 * Route loader performance wrapper
 */
export async function measureRouteLoader<T>(
  routeName: string,
  loader: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return measurePerformance(`Route Loader: ${routeName}`, loader, metadata);
}

/**
 * Clear old metrics to prevent memory leaks
 */
export function clearOldMetrics() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const originalLength = performanceMetrics.length;
  
  while (performanceMetrics.length > 0 && performanceMetrics[0].timestamp < oneHourAgo) {
    performanceMetrics.shift();
  }
  
  const removed = originalLength - performanceMetrics.length;
  if (removed > 0) {
    console.log(`🧹 Cleared ${removed} old performance metrics`);
  }
}

// Clean up old metrics every 30 minutes
if (typeof setInterval !== "undefined") {
  setInterval(clearOldMetrics, 30 * 60 * 1000);
}

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getCacheStats } from "~/utils/cache.server";
import { getPerformanceStats } from "~/utils/performance.server";
import { requireAdmin } from "~/utils/roles.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;

  // Only allow admin users to view performance data
  await requireAdmin(userId);

  const cacheStats = getCacheStats();
  const performanceStats = getPerformanceStats();

  return json({
    cacheStats,
    performanceStats,
    timestamp: new Date().toISOString(),
  });
}

export default function PerformanceMonitor() {
  const { cacheStats, performanceStats, timestamp } = useLoaderData<typeof loader>();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Performance Dashboard</h1>
      <p className="text-gray-600 mb-8">
        Last updated: {new Date(timestamp).toLocaleString()}
      </p>

      {/* Cache Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Organization Cache</h2>
          <p className="text-2xl font-bold text-blue-600">{cacheStats.organization.size}</p>
          <p className="text-sm text-gray-600">Entries cached</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Permission Cache</h2>
          <p className="text-2xl font-bold text-green-600">{cacheStats.permission.size}</p>
          <p className="text-sm text-gray-600">Entries cached</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">User Cache</h2>
          <p className="text-2xl font-bold text-purple-600">{cacheStats.user.size}</p>
          <p className="text-sm text-gray-600">Entries cached</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Asset Cache</h2>
          <p className="text-2xl font-bold text-orange-600">{cacheStats.asset.size}</p>
          <p className="text-sm text-gray-600">Entries cached</p>
        </div>
      </div>

      {/* Performance Statistics */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-bold mb-4">Performance Overview (Last Hour)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-semibold mb-2">Total Operations</h3>
            <p className="text-2xl font-bold">{performanceStats.totalOperations}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Average Duration</h3>
            <p className="text-2xl font-bold">{performanceStats.averageDuration.toFixed(2)}ms</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Slow Operations</h3>
            <p className="text-2xl font-bold text-red-600">{performanceStats.slowOperations}</p>
          </div>
        </div>
      </div>

      {/* Operation Breakdown */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Operation Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">Operation</th>
                <th className="px-4 py-2 text-left">Count</th>
                <th className="px-4 py-2 text-left">Avg Duration</th>
                <th className="px-4 py-2 text-left">Slow Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(performanceStats.operationBreakdown).map(([operation, stats]) => (
                <tr key={operation} className="border-t">
                  <td className="px-4 py-2 font-medium">{operation}</td>
                  <td className="px-4 py-2">{stats.count}</td>
                  <td className="px-4 py-2">{stats.averageDuration.toFixed(2)}ms</td>
                  <td className="px-4 py-2">
                    <span className={stats.slowCount > 0 ? "text-red-600 font-bold" : "text-green-600"}>
                      {stats.slowCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Tips */}
      <div className="bg-blue-50 p-6 rounded-lg mt-8">
        <h2 className="text-xl font-bold mb-4 text-blue-800">Performance Tips</h2>
        <ul className="space-y-2 text-blue-700">
          <li>• Cache hit rates above 70% are considered good</li>
          <li>• Operations taking longer than 1000ms are flagged as slow</li>
          <li>• Monitor the asset cache size - it should stay reasonable</li>
          <li>• High permission cache usage indicates efficient permission checking</li>
          <li>• Consider clearing caches if memory usage becomes too high</li>
        </ul>
      </div>
    </div>
  );
}

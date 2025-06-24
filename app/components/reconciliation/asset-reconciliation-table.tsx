import { Td, Th } from "~/components/table";
import { Link } from "@remix-run/react";

export type AssetReconciliationItem = {
  rfidTag: string;
  assetId: string;
  assetName: string;
  category: string;
  status: "Available" | "In Use" | "Unknown";
  location: string;
  locationMismatch?: boolean; // True if asset location != selected location
  selectedLocationName?: string; // Name of the selected location for comparison
};

export function AssetReconciliationTable({
  items,
}: {
  items: AssetReconciliationItem[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b text-left bg-white">
            <Th>RFID Tag</Th>
            <Th>Asset Name</Th>
            <Th>Category</Th>
            <Th>Status</Th>
            <Th>Current Location</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr 
              key={index} 
              className={`${index !== items.length - 1 ? "border-b" : ""} ${
                item.locationMismatch ? "bg-orange-50 hover:bg-orange-100" : "hover:bg-gray-50"
              }`}
            >
              <Td>{item.rfidTag}</Td>
              <Td>
                {item.assetId !== "unknown" ? (
                  <Link
                    to={`/assets/${item.assetId}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    {item.assetName}
                  </Link>
                ) : (
                  <span className="text-gray-600">{item.assetName}</span>
                )}
              </Td>
              <Td>{item.category}</Td>
              <Td>
                <span className={`inline-block px-2 py-0.5 text-sm font-medium rounded-full ${
                  item.status === 'Available' ? 'bg-green-50 text-green-700' :
                  item.status === 'In Use' ? 'bg-yellow-50 text-yellow-700' :
                  'bg-gray-50 text-gray-700'
                }`}>
                  {item.status}
                </span>
              </Td>
              <Td>
                <span className={item.locationMismatch ? "text-orange-600 font-medium" : ""}>
                  {item.location}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

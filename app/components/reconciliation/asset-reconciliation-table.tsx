import { Td, Th } from "~/components/table";

export type AssetReconciliationItem = {
  rfidTag: string;
  assetName: string;
  category: string;
  status: "Available" | "In Use" | "Unknown";
  location: string;
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
            <Th>Location</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className={index !== items.length - 1 ? "border-b" : ""}>
              <Td>{item.rfidTag}</Td>
              <Td>{item.assetName}</Td>
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
              <Td>{item.location}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

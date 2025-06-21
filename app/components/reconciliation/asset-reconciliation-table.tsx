import { Td, Th } from "~/components/table";

export type AssetReconciliationItem = {
  rfidTag: string;
  assetName: string;
  category: string;
  status: "Available" | "In Use";
  location: string;
};

export function AssetReconciliationTable({
  items,
}: {
  items: AssetReconciliationItem[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b text-left">
            <Th>RFID Tag</Th>
            <Th>Asset Name</Th>
            <Th>Category</Th>
            <Th>Status</Th>
            <Th>Location</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.rfidTag} className="border-b">
              <Td>{item.rfidTag}</Td>
              <Td>{item.assetName}</Td>
              <Td>{item.category}</Td>
              <Td>{item.status}</Td>
              <Td>{item.location}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

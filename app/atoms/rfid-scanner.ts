import { atom } from "jotai";

export type ScannedRfidItem = {
  rfid: string;
  asset?: {
    id: string;
    title: string;
    category?: string;
    status?: string;
    location?: string;
  };
};

export const scannedItemsAtom = atom<ScannedRfidItem[]>([]);

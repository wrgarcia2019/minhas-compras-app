
export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  price: number; // Unit price for this shopping trip
  barcode?: string;
  lastPurchasePrice?: number; // Price at current supermarket last time
  bestOverallPrice?: { price: number; supermarket: string };
}

export enum AppPhase {
  BUDGET_SETUP,
  SHOPPING,
}
    
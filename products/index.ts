import { skyTrackerProduct } from "./skytracker";

export type { Product, ProductStatus } from "./types";
export { skyTrackerProduct } from "./skytracker";

export const publicProducts = [skyTrackerProduct] as const;

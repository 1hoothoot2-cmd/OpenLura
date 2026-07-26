export type ProductStatus = "in-development" | "private-beta" | "public";

export type Product = {
  name: string;
  slug: string;
  shortDescription: string;
  status: ProductStatus;
  statusLabel: string;
};

import type { ReactNode } from "react";
import { PublicFooter } from "@/components/footer/PublicFooter";
import { PublicNavigation } from "@/components/navigation/PublicNavigation";
import type { Product } from "@/products";

type ProductLayoutProps = {
  product: Product;
  children: ReactNode;
};

export function ProductLayout({ product, children }: ProductLayoutProps) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#04050c] text-white">
      <PublicNavigation variant="product" activeProduct={product} />
      {children}
      <PublicFooter variant="product" product={product} />
    </main>
  );
}

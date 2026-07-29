import Link from "next/link";
import type { Product } from "@/products";

type PublicFooterProps =
  | { variant: "home" }
  | { variant: "product"; product: Product };

export function PublicFooter(props: PublicFooterProps) {
  if (props.variant === "home") {
    return (
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-6 text-sm text-white/38 sm:px-6 lg:px-8">
          OpenLura &middot; SkyTracker
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-7 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="text-white/30">
          OpenLura &middot; {props.product.name}
        </p>
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="flex min-h-11 items-center text-white/42 transition-colors hover:text-white/76 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none"
          >
            Home
          </Link>
        </div>
      </div>
    </footer>
  );
}

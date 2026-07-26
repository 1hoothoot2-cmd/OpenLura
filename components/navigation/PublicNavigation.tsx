import Image from "next/image";
import Link from "next/link";
import { publicProducts, type Product } from "@/products";

type PublicNavigationProps =
  | { variant: "home" }
  | { variant: "product"; activeProduct: Product };

export function PublicNavigation(props: PublicNavigationProps) {
  const isHome = props.variant === "home";
  const activeProduct =
    props.variant === "product" ? props.activeProduct : undefined;

  return (
    <nav
      aria-label="Primary navigation"
      className={
        isHome
          ? "relative z-20 border-b border-white/[0.06] bg-[#050510]/88 backdrop-blur-xl"
          : "relative z-30 border-b border-white/[0.06] bg-[#04050c]/90 backdrop-blur-xl"
      }
    >
      <div
        className={`mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8 ${
          isHome ? "max-w-6xl" : "max-w-7xl"
        }`}
      >
        {isHome ? (
          <div className="flex items-center gap-2.5">
            <BrandMark variant="home" />
            <span className="text-sm font-semibold tracking-[-0.02em] text-white/92">
              OpenLura
            </span>
          </div>
        ) : (
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04050c]"
          >
            <BrandMark variant="product" />
            <span className="text-sm font-semibold tracking-[-0.02em]">
              OpenLura
            </span>
          </Link>
        )}

        <div className={isHome ? undefined : "flex items-center gap-1 sm:gap-3"}>
          {!isHome && (
            <Link
              href="/"
              className="flex min-h-11 items-center rounded-full px-3 text-sm text-white/52 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Home
            </Link>
          )}
          {publicProducts.map((product) =>
            product.slug === activeProduct?.slug ? (
              <span
                key={product.slug}
                aria-current="page"
                className="flex min-h-9 items-center rounded-full border border-white/[0.06] bg-white/[0.06] px-3 text-sm font-medium text-white/90"
              >
                {product.name}
              </span>
            ) : (
              <Link
                key={product.slug}
                href={`/${product.slug}`}
                className={
                  isHome
                    ? "rounded-full px-3 py-2 text-sm font-medium text-white/64 transition-colors duration-200 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050510]"
                    : "flex min-h-11 items-center rounded-full px-3 text-sm text-white/52 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                }
              >
                {product.name}
              </Link>
            ),
          )}
        </div>
      </div>
    </nav>
  );
}

function BrandMark({ variant }: { variant: "home" | "product" }) {
  return (
    <span
      className={
        variant === "home"
          ? "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-[#3b82f6]/20 bg-[radial-gradient(circle_at_30%_30%,rgba(96,165,250,0.18),rgba(29,78,216,0.06)_52%,transparent_78%)]"
          : "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-blue-400/20 bg-blue-500/[0.08]"
      }
    >
      <Image
        src="/openlura-logo.png"
        alt=""
        width={36}
        height={36}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

# Public platform foundation

OpenLura keeps public products as regular App Router routes. Shared platform
structure lives in `components/navigation`, `components/footer`, and
`components/product`; product identity lives in `products`.

To add a future public product:

1. Add a typed definition in `products/<slug>.ts` and export it from
   `products/index.ts`.
2. Add `app/<slug>/page.tsx` and compose its content inside `ProductLayout`.
3. Keep heroes, previews, feature grids, and other domain-specific content
   inside the product route until a second product proves a shared abstraction.
4. Add route-specific metadata and update sitemap/robots only when the product
   becomes public.

Navigation reads the public product list, while the shared footer and product
layout preserve the common OpenLura structure. No database, CMS, API, or route
factory is involved.

import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://openlura.ai";

const CREDIT_PACKAGES = [
  { credits: 25,  priceId: process.env.STRIPE_CREDITS_PRICE_25! },
  { credits: 75,  priceId: process.env.STRIPE_CREDITS_PRICE_75! },
  { credits: 150, priceId: process.env.STRIPE_CREDITS_PRICE_150! },
  { credits: 500, priceId: process.env.STRIPE_CREDITS_PRICE_500! },
];

export async function POST(req: Request) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) return new Response("Unauthorized", { status: 401 });

  const userId = identity.identity.userId;
  const body = await req.json();
  const credits = parseInt(body?.credits);

  const pkg = CREDIT_PACKAGES.find(p => p.credits === credits);
  if (!pkg) return new Response("Invalid package", { status: 400 });
  if (!pkg.priceId) return new Response("Price not configured", { status: 500 });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "mode": "payment",
      "line_items[0][price]": pkg.priceId,
      "line_items[0][quantity]": "1",
      "success_url": `${baseUrl}/personal-workspace/photo-studio?credits=success`,
      "cancel_url": `${baseUrl}/personal-workspace/photo-studio`,
      "metadata[user_id]": userId,
      "metadata[credit_amount]": String(pkg.credits),
      "client_reference_id": userId,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("Stripe credits error:", typeof error === "string" ? error.slice(0, 200) : "unknown");
    return new Response("Failed", { status: 500 });
  }

  const session = await res.json();
  return Response.json({ url: session.url });
}
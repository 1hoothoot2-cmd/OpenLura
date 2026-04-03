import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const priceId = process.env.STRIPE_PRICE_ID;
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://openlura.ai";

export async function POST(req: Request) {
  const identity = await requireOpenLuraIdentity(req);

  if (!identity.ok) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!stripeSecretKey || !priceId) {
    return new Response("Stripe not configured", { status: 500 });
  }

  const userId = identity.identity.userId;

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "mode": "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "success_url": `${baseUrl}/persoonlijke-omgeving?upgrade=success`,
      "cancel_url": `${baseUrl}/#plans`,
      "metadata[user_id]": userId,
      "client_reference_id": userId,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("Stripe checkout error:", error);
    return new Response("Failed to create checkout session", { status: 500 });
  }

  const session = await res.json();

  return Response.json({ url: session.url });
}
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const personalStateTable = process.env.OPENLURA_PERSONAL_STATE_TABLE || "openlura_personal_state";

async function verifyStripeSignature(payload: string, signature: string, secret: string) {
  const parts = signature.split(",");
  const timestamp = parts.find(p => p.startsWith("t="))?.split("=")[1];
  const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1];

  if (!timestamp || !v1) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  return computed === v1;
}

async function setUserTier(userId: string, tier: "pro" | "free", stripeCustomerId?: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: existing } = await supabase
    .from(personalStateTable)
    .select("usage_stats")
    .eq("user_id", userId)
    .single();

  const currentStats = (existing?.usage_stats as Record<string, unknown>) || {};

  await supabase
    .from(personalStateTable)
    .upsert({
      user_id: userId,
      usage_stats: {
        ...currentStats,
        tier,
        ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
}

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const valid = await verifyStripeSignature(payload, signature, webhookSecret);
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(payload);

  if (event.type === "checkout.session.completed") {
    const userId = event.data.object.metadata?.user_id || event.data.object.client_reference_id;
    const customerId = event.data.object.customer;
    if (userId) {
      await setUserTier(userId, "pro", customerId);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const customerId = event.data.object.customer;
    // lookup user by customer id - voor nu loggen
    console.log("Subscription cancelled for customer:", customerId);
  }

  return new Response("ok", { status: 200 });
}
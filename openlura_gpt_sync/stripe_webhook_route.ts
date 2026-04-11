import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const personalStateTable = process.env.OPENLURA_PERSONAL_STATE_TABLE || "openlura_personal_state";

const STRIPE_TIMESTAMP_TOLERANCE_S = 300; // 5 minutes

async function verifyStripeSignature(payload: string, signature: string, secret: string) {
  const parts = signature.split(",");
  const timestamp = parts.find(p => p.startsWith("t="))?.split("=")[1];
  const v1 = parts.find(p => p.startsWith("v1="))?.split("=")[1];

  if (!timestamp || !v1) return false;

  // Replay protection — reject webhooks older than 5 minutes
  const webhookAge = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (!Number.isFinite(webhookAge) || webhookAge > STRIPE_TIMESTAMP_TOLERANCE_S || webhookAge < -60) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  // Decode expected signature for timing-safe comparison
  const expectedBytes = new Uint8Array(
    v1.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  const signedBytes = encoder.encode(signedPayload);
  const valid = await crypto.subtle.verify("HMAC", key, expectedBytes, signedBytes);

  return valid;
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
    const session = event.data.object;
    const userId = session.metadata?.user_id || session.client_reference_id;
    const customerId = session.customer;
    const mode = session.mode;
    const creditAmount = session.metadata?.credit_amount ? parseInt(session.metadata.credit_amount) : null;

    if (userId) {
      if (mode === "subscription") {
        await setUserTier(userId, "pro", customerId);
      } else if (mode === "payment" && creditAmount) {
        // Credits bijkopen
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
        const { data: existing } = await supabase
          .from(personalStateTable)
          .select("usage_stats")
          .eq("user_id", userId)
          .single();
        const currentStats = (existing?.usage_stats as Record<string, unknown>) || {};
        const currentPoints = typeof currentStats.photo_points === "number" ? currentStats.photo_points : 0;
        await supabase.from(personalStateTable).upsert({
          user_id: userId,
          usage_stats: { ...currentStats, photo_points: currentPoints + creditAmount },
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const customerId = event.data.object.customer;
    
    // Look up user by stripe_customer_id
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data } = await supabase
      .from(personalStateTable)
      .select("user_id, usage_stats")
      .eq("usage_stats->>stripe_customer_id", customerId)
      .single();

    if (data?.user_id) {
      await setUserTier(data.user_id, "free");
    } else {
      console.log("No user found for customer:", customerId);
    }
  }

  return new Response("ok", { status: 200 });
}
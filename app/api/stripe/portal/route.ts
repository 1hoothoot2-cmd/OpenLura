import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://openlura.ai";
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) return new Response("Unauthorized", { status: 401 });

  const userId = identity.identity.userId;

  // Haal stripe_customer_id op uit Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data } = await supabase
    .from("openlura_personal_state")
    .select("usage_stats")
    .eq("user_id", userId)
    .single();

  const stripeCustomerId = (data?.usage_stats as any)?.stripe_customer_id;

  if (!stripeCustomerId) {
    return new Response("No subscription found", { status: 404 });
  }

  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/persoonlijke-omgeving`,
    }),
  });

  const session = await res.json();
  return Response.json({ url: session.url });
}
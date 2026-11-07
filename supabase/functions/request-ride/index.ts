import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) {
      return json({ error: "Configuração interna incompleta no servidor." }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Faça login para solicitar uma corrida." }, 401);

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Sessão inválida. Entre novamente." }, 401);
    const passengerId = authData.user.id;

    const body = await req.json();
    const pickupLat = Number(body.pickup_latitude);
    const pickupLon = Number(body.pickup_longitude);
    const destinationLat = Number(body.destination_latitude);
    const destinationLon = Number(body.destination_longitude);
    const payment = String(body.payment_method ?? "");

    const coords = [pickupLat, pickupLon, destinationLat, destinationLon];
    if (!coords.every(Number.isFinite) ||
        pickupLat < -90 || pickupLat > 90 ||
        destinationLat < -90 || destinationLat > 90 ||
        pickupLon < -180 || pickupLon > 180 ||
        destinationLon < -180 || destinationLon > 180) {
      return json({ error: "Localização inválida." }, 400);
    }
    if (!["cash", "pix", "card"].includes(payment)) {
      return json({ error: "Forma de pagamento inválida." }, 400);
    }

    // OSRM calcula a distância pela malha viária; preço nunca é aceito do aparelho.
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${pickupLon},${pickupLat};${destinationLon},${destinationLat}?overview=false&alternatives=false&steps=false`;
    const routeResponse = await fetch(routeUrl, { headers: { "Accept": "application/json" } });
    if (!routeResponse.ok) throw new Error("Não foi possível calcular a rota. Tente novamente.");
    const route = await routeResponse.json();
    if (route.code !== "Ok" || !route.routes?.[0]?.distance) {
      return json({ error: "Não encontramos uma rota de rua entre esses pontos." }, 422);
    }

    const distanceKm = Number((route.routes[0].distance / 1000).toFixed(3));
    const estimatedPrice = Math.max(7, Math.round(distanceKm * 2.5 * 100) / 100);

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: rideId, error: insertError } = await admin.rpc("request_ride_from_edge", {
      p_passenger_id: passengerId,
      p_pickup_latitude: pickupLat,
      p_pickup_longitude: pickupLon,
      p_destination_latitude: destinationLat,
      p_destination_longitude: destinationLon,
      p_payment_method: payment,
      p_distance_km: distanceKm,
      p_estimated_price: estimatedPrice,
    });
    if (insertError) {
      const message = insertError.message.includes("corrida em andamento")
        ? "Você já possui uma corrida em andamento."
        : insertError.message;
      return json({ error: message }, 400);
    }

    return json({
      ride_id: rideId,
      distance_km: distanceKm,
      estimated_price: estimatedPrice,
      commission_rate: 0.10,
      estimated_commission: Math.round(estimatedPrice * 10) / 100,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro interno ao solicitar corrida." }, 500);
  }
});

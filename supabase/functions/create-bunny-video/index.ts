import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUNNY_LIBRARY_ID = Deno.env.get("BUNNY_LIBRARY_ID") || "";
const BUNNY_API_KEY = Deno.env.get("BUNNY_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Enforce role-based access for extra security (only admins can upload)
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "admin") {
      throw new Error("Forbidden: Admins only");
    }

    const { title } = await req.json();
    if (!title) throw new Error("Title is required");

    // 1. Create Video Object in Bunny.net
    const createRes = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        AccessKey: BUNNY_API_KEY,
        accept: "application/json",
      },
      body: JSON.stringify({ title }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create video in Bunny: ${err}`);
    }

    const createData = await createRes.json();
    const videoId = createData.guid;

    // 2. Generate TUS upload signature securely on the server
    const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour validity
    const signatureString = `${BUNNY_LIBRARY_ID}${BUNNY_API_KEY}${expirationTime}${videoId}`;
    
    // Hash using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return new Response(
      JSON.stringify({
        videoId,
        libraryId: BUNNY_LIBRARY_ID,
        authorizationSignature: signature,
        authorizationExpire: expirationTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

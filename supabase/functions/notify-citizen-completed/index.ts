import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// FOLOSIM NODEMAILER (Librăria modernă)
import nodemailer from "https://esm.sh/nodemailer@6.9.13";

const GMAIL_USER = Deno.env.get("GMAIL_USER");
const GMAIL_APP_PASS = Deno.env.get("GMAIL_APP_PASS");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const record = payload.record;
    const old_record = payload.old_record;

    // 1. Verificăm dacă e completed
    if (record.workflow_stage !== 'completed') {
      return new Response(JSON.stringify({ message: "Nu e completed." }), { headers: corsHeaders });
    }

    // 2. PROTECȚIA ANTI-SPAM
    if (old_record && old_record.workflow_stage === 'completed') {
      console.log("Dosarul era deja completed. Ignor.");
      return new Response(JSON.stringify({ message: "Mail deja trimis." }), { headers: corsHeaders });
    }

    // 3. Căutăm emailul cetățeanului
    const supabaseAdmin = createClient(
      SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY ?? ""
    );

    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(record.uploaded_by);

    if (error || !user || !user.email) {
      throw new Error("Nu am găsit emailul utilizatorului");
    }

    console.log(`Trimit mail catre: ${user.email} cu Nodemailer...`);

    // 4. CONFIGURARE NODEMAILER (Aici se schimbă fața de data trecută)
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // true pentru 465, false pentru alte porturi
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASS,
      },
    });

    // 5. TRIMITEM MAILUL
    const info = await transporter.sendMail({
      from: `"Primaria Digitala" <${GMAIL_USER}>`, // Nume frumos
      to: user.email,
      subject: `✅ Cerere Finalizată: ${record.title}`,
      text: `Cererea ta "${record.title}" a fost finalizată. Intră în aplicație pentru detalii.`, // Versiunea text simplu
      html: `
        <h3>Salut,</h3>
        <p>Cererea ta <strong>"${record.title}"</strong> a fost analizată și <span style="color:green; font-weight:bold;">FINALIZATĂ</span> cu succes.</p>
        <p>Te rugăm să intri în aplicație la secțiunea "Dosarele Mele" pentru a descărca documentele semnate.</p>
        <br>
        <p>O zi bună,<br>Echipa Primărie</p>
      `,
    });

    console.log("Mail trimis cu succes:", info.messageId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("EROARE MAJORA:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
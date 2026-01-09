import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    
    const currentStage = record.workflow_stage; // 'completed' sau 'rejected'

    // 1. Verificăm dacă statusul este unul care ne interesează (Finalizat sau Respins)
    if (currentStage !== 'completed' && currentStage !== 'rejected') {
      return new Response(JSON.stringify({ message: "Statusul nu necesită notificare." }), { headers: corsHeaders });
    }

    // 2. PROTECȚIA ANTI-SPAM (Valabilă pentru ambele cazuri)
    // Dacă statusul nu s-a schimbat față de data trecută, nu mai trimitem mail.
    if (old_record && old_record.workflow_stage === currentStage) {
      console.log(`Dosarul era deja ${currentStage}. Ignor.`);
      return new Response(JSON.stringify({ message: "Mail deja trimis." }), { headers: corsHeaders });
    }

    // 3. Pregătim Conținutul Mailului (Dinamic)
    let emailSubject = "";
    let emailHtml = "";

    if (currentStage === 'completed') {
        // --- CAZUL FINALIZAT ---
        emailSubject = `✅ Cerere Finalizată: ${record.title}`;
        emailHtml = `
            <h3>Salut,</h3>
            <p>Vești bune! Cererea ta <strong>"${record.title}"</strong> a fost analizată și <span style="color:green; font-weight:bold;">FINALIZATĂ</span> cu succes.</p>
            <p>Te rugăm să intri în aplicație la secțiunea "Dosarele Mele" pentru a descărca documentele semnate.</p>
            <br>
            <p>O zi bună,<br>Echipa Primărie</p>
        `;
    } else {
        // --- CAZUL RESPINS ---
        emailSubject = `❌ Cerere Respinsă: ${record.title}`;
        // Putem adăuga motivul respingerii dacă ai o coloană 'rejection_reason'
        const motiv = record.rejection_reason ? `<p><strong>Motivul respingerii:</strong> ${record.rejection_reason}</p>` : "";
        
        emailHtml = `
            <h3>Salut,</h3>
            <p>Din păcate, cererea ta <strong>"${record.title}"</strong> a fost <span style="color:red; font-weight:bold;">RESPINSĂ</span>.</p>
            ${motiv}
            <p>Te rugăm să intri în aplicație pentru a vedea detaliile și pentru a depune o nouă cerere corectată, dacă este cazul.</p>
            <br>
            <p>O zi bună,<br>Echipa Primărie</p>
        `;
    }

    // 4. Căutăm emailul cetățeanului
    const supabaseAdmin = createClient(
      SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY ?? ""
    );

    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(record.uploaded_by);

    if (error || !user || !user.email) {
      throw new Error("Nu am găsit emailul utilizatorului");
    }

    console.log(`Trimit mail (${currentStage}) catre: ${user.email}`);

    // 5. Configurare Nodemailer
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASS,
      },
    });

    // 6. Trimitem Mailul
    const info = await transporter.sendMail({
      from: `"Primaria Digitala" <${GMAIL_USER}>`,
      to: user.email,
      subject: emailSubject,
      html: emailHtml,
    });

    console.log("Mail trimis cu succes:", info.messageId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("EROARE:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
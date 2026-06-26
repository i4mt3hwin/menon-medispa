export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { name, email, phone, service, message } = body;

    if (!name || !email || !phone) {
      return new Response(JSON.stringify({ error: "Name, email, and phone are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = context.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      // Fallback: log to console if no API key (for testing)
      console.log("Form submission (no Resend key):", body);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Menon MediSpa Landing Pages <noreply@updates.menonmedispa.com>",
        to: "admin@menonregen.com",
        subject: `New Lead: ${service || "Landing Page"} — ${name}`,
        html: `
          <h2>New Landing Page Lead</h2>
          <p><strong>Service:</strong> ${service || "Not specified"}</p>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          ${message ? `<p><strong>Message:</strong> ${message}</p>` : ""}
          <hr>
          <p style="color:#888;font-size:12px;">Submitted from get.menonmedispa.com landing page</p>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(JSON.stringify({ error: "Failed to send email." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Form handler error:", e);
    return new Response(JSON.stringify({ error: "Server error." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

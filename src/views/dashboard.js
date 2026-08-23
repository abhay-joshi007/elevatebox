function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderLeadCard(lead) {
  const transcript = lead.transcript.map((entry) => `${entry.role}: ${entry.text}`).join("\n") || "No transcript yet.";
  const slots = Object.entries(lead.slots)
    .map(([key, value]) => `<li><strong>${escapeHtml(key)}</strong>: ${escapeHtml(value || "pending")}</li>`)
    .join("");

  return `
    <article class="card">
      <div class="card-top">
        <div>
          <h2>${escapeHtml(lead.id.slice(0, 8))}</h2>
          <p>${escapeHtml(lead.status)} · ${escapeHtml(lead.classification)}</p>
        </div>
        <form method="post" action="/api/outbound/call">
          <input type="hidden" name="leadId" value="${escapeHtml(lead.id)}" />
          <button type="submit">Retry Call</button>
        </form>
      </div>
      <ul>${slots}</ul>
      <p><strong>Callback:</strong> ${escapeHtml(lead.callback?.isoLocal || lead.callback?.note || "none")}</p>
      <pre>${escapeHtml(transcript)}</pre>
    </article>
  `;
}

export function renderDashboard(leads, configSummary) {
  const leadCards = leads.map(renderLeadCard).join("");

  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ElevateBox Caller Dashboard</title>
    <style>
      :root {
        --bg: #f5efe3;
        --paper: #fffdf7;
        --ink: #1f1e1a;
        --accent: #b24c2a;
        --accent-soft: #f1d7c5;
        --line: #e2d8c6;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(178, 76, 42, 0.18), transparent 28%),
          linear-gradient(180deg, #fcf8ef 0%, var(--bg) 100%);
      }
      main {
        width: min(1120px, calc(100% - 32px));
        margin: 32px auto 56px;
      }
      .hero {
        padding: 28px;
        border: 1px solid var(--line);
        background: var(--paper);
        border-radius: 28px;
        box-shadow: 0 20px 40px rgba(36, 27, 14, 0.08);
      }
      .hero h1 {
        margin: 0 0 10px;
        font-size: clamp(2rem, 4vw, 3.8rem);
        line-height: 0.95;
      }
      .hero p {
        margin: 0;
        max-width: 720px;
        font-size: 1.05rem;
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        margin-top: 18px;
      }
      .meta div, .card {
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.86);
        border-radius: 20px;
      }
      .meta div {
        padding: 16px;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 18px;
        margin-top: 22px;
      }
      .card {
        padding: 18px;
      }
      .card-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: start;
      }
      h2 {
        margin: 0 0 6px;
        font-size: 1.2rem;
      }
      ul {
        padding-left: 20px;
      }
      pre {
        white-space: pre-wrap;
        background: var(--paper);
        padding: 14px;
        border-radius: 14px;
        border: 1px solid var(--line);
        max-height: 220px;
        overflow: auto;
      }
      button {
        border: none;
        background: var(--accent);
        color: white;
        border-radius: 999px;
        padding: 10px 16px;
        cursor: pointer;
      }
      .create-form {
        margin-top: 20px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .create-form input {
        flex: 1 1 320px;
        padding: 12px 14px;
        border-radius: 999px;
        border: 1px solid var(--line);
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>ElevateBox Voice Seller</h1>
        <p>Outbound e-commerce sales caller with language switching, live lead qualification, mid-call WhatsApp, callback capture, and recruiter-ready follow-up artifacts.</p>
        <div class="meta">
          <div><strong>Base URL</strong><br />${escapeHtml(configSummary.appBaseUrl)}</div>
          <div><strong>Target</strong><br />${escapeHtml(configSummary.targetPhoneNumber)}</div>
          <div><strong>Model</strong><br />${escapeHtml(configSummary.openAiModel)}</div>
        </div>
        <form class="create-form" method="post" action="/api/outbound/call">
          <input name="phoneNumber" value="${escapeHtml(configSummary.targetPhoneNumber)}" />
          <button type="submit">Place Outbound Call</button>
        </form>
      </section>
      <section class="cards">
        ${leadCards || "<article class='card'><p>No leads yet. Use the button above to create and call one.</p></article>"}
      </section>
    </main>
  </body>
  </html>`;
}

import test from "node:test";
import assert from "node:assert/strict";
import { config, validateConfiguration, validateOptionalConfiguration } from "../src/config.js";
import { placeOutboundCall, sayAndGather, sayAndHangup, sendWhatsAppMessage } from "../src/services/twilio.js";
import { renderDashboard } from "../src/views/dashboard.js";
import { safeStaticPath } from "../src/lib/http.js";
import { buildOpeningPrompt } from "../src/services/callFlow.js";
import { toAbsoluteIso } from "../src/services/scheduler.js";

test("sayAndGather builds speech TwiML with action URL", () => {
  const xml = sayAndGather({
    prompt: "Tell me about your store",
    actionUrl: "https://example.com/twilio/voice/step?leadId=123",
    language: "en-IN",
    hints: ["budget", "timeline"]
  });

  assert.match(xml, /<Gather/);
  assert.match(xml, /input="speech"/);
  assert.match(xml, /https:\/\/example\.com\/twilio\/voice\/step\?leadId=123/);
  assert.match(xml, /Tell me about your store/);
  assert.match(xml, /voice="Google\.en-IN-Standard-A"/);
  assert.match(xml, /speechTimeout="2"/);
});

test("sayAndGather selects a Telugu-capable voice", () => {
  const xml = sayAndGather({
    prompt: "మీ అవసరం ఏమిటి?",
    actionUrl: "https://example.com/voice",
    language: "te-IN"
  });

  assert.match(xml, /voice="Google\.te-IN-Standard-A"/);
  assert.match(xml, /language="te-IN"/);
});

test("opening prompt explicitly offers all required languages", () => {
  assert.match(buildOpeningPrompt(), /English, Hindi, or Telugu/);
});

test("safeStaticPath rejects traversal outside the static directory", () => {
  assert.equal(safeStaticPath("C:\\app\\assets", "architecture.svg"), "C:\\app\\assets\\architecture.svg");
  assert.equal(safeStaticPath("C:\\app\\assets", "..\\secrets.env"), null);
});

test("callback local time is converted using the configured Indian timezone", () => {
  assert.equal(
    toAbsoluteIso("2026-08-23T10:00:00", "Asia/Kolkata"),
    "2026-08-23T04:30:00.000Z"
  );
  assert.equal(
    toAbsoluteIso("2026-08-23T10:00:00+05:30", "Asia/Kolkata"),
    "2026-08-23T04:30:00.000Z"
  );
});

test("preflight rejects localhost app base URL for Twilio webhooks", () => {
  const previousBaseUrl = config.appBaseUrl;
  config.appBaseUrl = "http://localhost:3000";
  try {
    assert.match(
      validateConfiguration().join("\n"),
      /APP_BASE_URL \(must be a public HTTPS URL for Twilio webhooks\)/
    );
  } finally {
    config.appBaseUrl = previousBaseUrl;
  }
});

test("WhatsApp sender mismatch is a warning, not a voice-call blocker", () => {
  const previousVoiceNumber = config.twilioPhoneNumber;
  const previousWhatsAppNumber = config.twilioWhatsAppNumber;
  config.twilioPhoneNumber = "+17372212163";
  config.twilioWhatsAppNumber = "+17372212163";
  try {
    assert.doesNotMatch(validateConfiguration().join("\n"), /TWILIO_WHATSAPP_NUMBER/);
    assert.match(validateOptionalConfiguration().join("\n"), /TWILIO_WHATSAPP_NUMBER/);
  } finally {
    config.twilioPhoneNumber = previousVoiceNumber;
    config.twilioWhatsAppNumber = previousWhatsAppNumber;
  }
});

test("Twilio boundary builds the assignment call and contextual WhatsApp payload", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, params: new URLSearchParams(init.body) });
    return { ok: true, json: async () => ({ sid: "TEST-SID" }) };
  };

  try {
    await placeOutboundCall({ to: "+918688664337", leadId: "lead-test" });
    await sendWhatsAppMessage({
      to: "+919876543210",
      body: "Specific lead context",
      mediaUrls: ["https://example.com/resume.pdf", "https://example.com/architecture.svg"]
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests[0].params.get("To"), "+918688664337");
  assert.equal(requests[0].params.get("Url"), `${config.appBaseUrl}/twilio/voice/entry?leadId=lead-test`);
  assert.equal(requests[0].params.get("MachineDetection"), null);
  assert.equal(requests[1].params.get("To"), "whatsapp:+919876543210");
  assert.deepEqual(requests[1].params.getAll("MediaUrl"), [
    "https://example.com/resume.pdf",
    "https://example.com/architecture.svg"
  ]);
});

test("sayAndHangup builds hangup TwiML", () => {
  const xml = sayAndHangup({
    prompt: "Thank you for your time.",
    language: "en-IN"
  });

  assert.match(xml, /<Hangup\/>/);
  assert.match(xml, /Thank you for your time\./);
});

test("dashboard renders lead summary and CTA", () => {
  const html = renderDashboard(
    [
      {
        id: "lead-12345678",
        status: "completed",
        classification: "hot",
        slots: {
          budget: "5 lakh",
          products: "fashion catalog",
          timeline: "3 weeks",
          features: "payments and COD"
        },
        callback: { isoLocal: "2026-08-23T10:00:00+05:30" },
        transcript: [{ role: "caller", text: "I want to launch fast." }]
      }
    ],
    {
      appBaseUrl: "https://example.com",
      targetPhoneNumber: "+918688664337",
      openAiModel: "gpt-5.6"
    }
  );

  assert.match(html, /ElevateBox Voice Seller/);
  assert.match(html, /Place Outbound Call/);
  assert.match(html, /fashion catalog/);
  assert.match(html, /2026-08-23T10:00:00\+05:30/);
});

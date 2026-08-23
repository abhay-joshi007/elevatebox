import { config } from "../config.js";

function buildBasicAuth() {
  return Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64");
}

async function twilioRequest(path, params) {
  const response = await fetch(`https://api.twilio.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildBasicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twilio request failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function placeOutboundCall({ to, leadId }) {
  const params = {
    To: to,
    From: config.twilioPhoneNumber,
    Url: `${config.appBaseUrl}/twilio/voice/entry?leadId=${encodeURIComponent(leadId)}`,
    StatusCallback: `${config.appBaseUrl}/twilio/status?leadId=${encodeURIComponent(leadId)}`
  };

  // Keep the default payload trial-friendly. Advanced features can be re-enabled explicitly.
  if (config.twilioStatusCallbackEvents) {
    params.StatusCallbackEvent = config.twilioStatusCallbackEvents;
  }
  if (config.twilioMachineDetection) {
    params.MachineDetection = config.twilioMachineDetection;
  }

  return twilioRequest(`/2010-04-01/Accounts/${config.twilioAccountSid}/Calls.json`, params);
}

export async function sendWhatsAppMessage({ to, body, mediaUrls = [] }) {
  const params = new URLSearchParams();
  params.set("To", `whatsapp:${to}`);
  params.set("From", `whatsapp:${config.twilioWhatsAppNumber}`);
  params.set("Body", body);
  mediaUrls.forEach((url) => {
    params.append("MediaUrl", url);
  });

  return twilioRequest(`/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`, params);
}

const VOICES = {
  "en-IN": "Google.en-IN-Standard-A",
  "hi-IN": "Google.hi-IN-Standard-A",
  "te-IN": "Google.te-IN-Standard-A"
};

export function sayAndGather({ prompt, actionUrl, language, hints = [] }) {
  const escapedPrompt = escapeXml(prompt);
  const escapedAction = escapeXml(actionUrl);
  const escapedHints = escapeXml(hints.join(","));
  const hintAttribute = hints.length ? ` hints="${escapedHints}"` : "";

  const voice = VOICES[language] || VOICES["en-IN"];
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<Response>",
    `  <Gather input="speech" actionOnEmptyResult="true" action="${escapedAction}" method="POST" language="${escapeXml(language)}" speechTimeout="2" timeout="4"${hintAttribute}>`,
    `    <Say voice="${voice}" language="${escapeXml(language)}">${escapedPrompt}</Say>`,
    "  </Gather>",
    "  <Pause length=\"1\"/>",
    `  <Redirect method="POST">${escapedAction}</Redirect>`,
    "</Response>"
  ].join("");
}

export function sayAndHangup({ prompt, language }) {
  const voice = VOICES[language] || VOICES["en-IN"];
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<Response>",
    `  <Say voice="${voice}" language="${escapeXml(language)}">${escapeXml(prompt)}</Say>`,
    "  <Hangup/>",
    "</Response>"
  ].join("");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

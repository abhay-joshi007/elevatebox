import fs from "node:fs";
import path from "node:path";

const required = [
  "APP_BASE_URL",
  "OPENAI_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "TWILIO_WHATSAPP_NUMBER",
  "YOUR_MOBILE_NUMBER"
];

loadEnvFile();

export const config = {
  appBaseUrl: normalizeBaseUrl(process.env.APP_BASE_URL || "http://localhost:3000"),
  port: Number(process.env.PORT || 3000),
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-5.6",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
  twilioWhatsAppNumber: process.env.TWILIO_WHATSAPP_NUMBER || "",
  twilioMachineDetection: process.env.TWILIO_MACHINE_DETECTION || "",
  twilioStatusCallbackEvents: process.env.TWILIO_STATUS_CALLBACK_EVENTS || "initiated ringing answered completed",
  targetPhoneNumber: process.env.TARGET_PHONE_NUMBER || "+918688664337",
  yourMobileNumber: process.env.YOUR_MOBILE_NUMBER || "",
  resumePublicPath: process.env.RESUME_PUBLIC_PATH || "/assets/resume.pdf",
  architectureImagePublicPath: process.env.ARCHITECTURE_IMAGE_PUBLIC_PATH || "/assets/architecture.svg",
  followUpNotePublicPath: process.env.FOLLOW_UP_NOTE_PUBLIC_PATH || "/artifacts/build-note.txt",
  callerName: process.env.CALLER_NAME || "Candidate",
  defaultLanguage: process.env.DEFAULT_LANGUAGE || "en-IN",
  timezone: process.env.TIMEZONE || "Asia/Kolkata",
  workspaceRoot: process.cwd(),
  dataDir: path.join(process.cwd(), "data"),
  assetsDir: path.join(process.cwd(), "assets"),
  publicDir: path.join(process.cwd(), "public")
};

export function ensureDirectories() {
  for (const dir of [config.dataDir, config.assetsDir, config.publicDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function validateConfiguration() {
  const missing = required.filter((key) => !process.env[key]);
  if (!isPublicHttpsUrl(config.appBaseUrl)) {
    missing.push("APP_BASE_URL (must be a public HTTPS URL for Twilio webhooks)");
  }
  if (!isLikelyOpenAiModel(config.openAiModel)) {
    missing.push("OPENAI_MODEL (use an API model id such as gpt-5.6-luna, gpt-5.6-terra, gpt-5.1, or gpt-4.1-mini)");
  }
  if (config.twilioWhatsAppNumber === config.twilioPhoneNumber) {
    missing.push("TWILIO_WHATSAPP_NUMBER (must be a WhatsApp-enabled Twilio sender, not just the voice phone number)");
  }
  if (!fs.existsSync(path.join(config.assetsDir, "resume.pdf"))) {
    missing.push("assets/resume.pdf");
  }
  return missing;
}

function isPublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1";
  } catch {
    return false;
  }
}

function normalizeBaseUrl(value) {
  return String(value).trim().replace(/\/+$/, "");
}

function isLikelyOpenAiModel(value) {
  return /^(gpt|o)\w*(?:[-.]\w+)*$/.test(value) && !/^gpt-\d+(?:\.\d+)?$/.test(value);
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

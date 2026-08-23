import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";

const LEADS_PATH = path.join(config.dataDir, "leads.json");

function ensureFile() {
  if (!fs.existsSync(LEADS_PATH)) {
    fs.writeFileSync(LEADS_PATH, "[]", "utf8");
  }
}

function readAll() {
  ensureFile();
  return JSON.parse(fs.readFileSync(LEADS_PATH, "utf8"));
}

function writeAll(leads) {
  fs.writeFileSync(LEADS_PATH, JSON.stringify(leads, null, 2), "utf8");
}

export function createLead(seed = {}) {
  const now = new Date().toISOString();
  const lead = {
    id: crypto.randomUUID(),
    status: "created",
    createdAt: now,
    updatedAt: now,
    callSid: null,
    language: config.defaultLanguage,
    classification: "unknown",
    slots: {
      budget: null,
      products: null,
      timeline: null,
      features: null
    },
    callback: null,
    transcript: [],
    notes: [],
    events: [],
    signals: {
      highIntent: false,
      callbackRequested: false
    },
    artifacts: {
      architectureImageUrl: `${config.appBaseUrl}${config.architectureImagePublicPath}`,
      resumeUrl: `${config.appBaseUrl}${config.resumePublicPath}`,
      buildNoteUrl: `${config.appBaseUrl}${config.followUpNotePublicPath}`
    },
    ...seed
  };

  const leads = readAll();
  leads.unshift(lead);
  writeAll(leads);
  return lead;
}

export function listLeads() {
  return readAll();
}

export function getLead(leadId) {
  return readAll().find((lead) => lead.id === leadId) || null;
}

export function updateLead(leadId, updater) {
  const leads = readAll();
  const index = leads.findIndex((lead) => lead.id === leadId);
  if (index === -1) {
    return null;
  }

  const updated = updater(structuredClone(leads[index]));
  updated.updatedAt = new Date().toISOString();
  leads[index] = updated;
  writeAll(leads);
  return updated;
}

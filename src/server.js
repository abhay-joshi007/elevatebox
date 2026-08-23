import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { config, ensureDirectories, validateConfiguration } from "./config.js";
import { createLead, listLeads, updateLead } from "./lib/storage.js";
import { notFound, parseRequest, safeStaticPath, sendJson, sendText, sendXml, serveFile } from "./lib/http.js";
import { buildVoiceResponse, handleStatusUpdate, processVoiceStep } from "./services/callFlow.js";
import { runDueCallbacks } from "./services/scheduler.js";
import { placeOutboundCall } from "./services/twilio.js";
import { renderDashboard } from "./views/dashboard.js";

ensureDirectories();

const server = http.createServer(async (req, res) => {
  try {
    const request = await parseRequest(req);

    if (req.method === "GET" && request.path === "/") {
      const html = renderDashboard(listLeads(), {
        appBaseUrl: config.appBaseUrl,
        targetPhoneNumber: config.targetPhoneNumber,
        openAiModel: config.openAiModel
      });
      sendText(res, 200, html, "text/html; charset=utf-8");
      return;
    }

    if (req.method === "GET" && request.path.startsWith("/assets/")) {
      const filePath = safeStaticPath(config.assetsDir, request.path.replace("/assets/", ""));
      if (!filePath) {
        notFound(res);
        return;
      }
      serveFile(res, filePath);
      return;
    }

    if (req.method === "GET" && request.path.startsWith("/artifacts/")) {
      const filePath = safeStaticPath(config.publicDir, request.path.replace("/artifacts/", ""));
      if (!filePath) {
        notFound(res);
        return;
      }
      serveFile(res, filePath);
      return;
    }

    if (req.method === "GET" && request.path === "/api/health") {
      const missingConfiguration = validateConfiguration();
      sendJson(res, missingConfiguration.length ? 503 : 200, {
        ok: missingConfiguration.length === 0,
        missingConfiguration,
        leads: listLeads().length
      });
      return;
    }

    if (req.method === "GET" && request.path === "/api/leads") {
      sendJson(res, 200, listLeads());
      return;
    }

    if (req.method === "POST" && request.path === "/api/outbound/call") {
      const missingConfiguration = validateConfiguration();
      if (missingConfiguration.length) {
        sendJson(res, 503, {
          error: "Live calling is not configured yet.",
          missingConfiguration
        });
        return;
      }

      const phoneNumber = request.body?.phoneNumber || config.targetPhoneNumber;
      const leadId = request.body?.leadId || createLead({ phoneNumber }).id;
      const result = await placeOutboundCall({ to: phoneNumber, leadId });
      updateLead(leadId, (draft) => {
        draft.callSid = result.sid;
        draft.status = "queued";
        draft.events.push({ type: "call_requested", value: result.sid, at: new Date().toISOString() });
        return draft;
      });

      if ((req.headers.accept || "").includes("text/html")) {
        res.writeHead(302, { Location: "/" });
        res.end();
        return;
      }

      sendJson(res, 200, { leadId, call: result });
      return;
    }

    if (req.method === "POST" && request.path === "/twilio/voice/entry") {
      const leadId = request.query.leadId;
      sendXml(res, buildVoiceResponse(leadId));
      return;
    }

    if (req.method === "POST" && request.path === "/twilio/voice/step") {
      const leadId = request.query.leadId;
      const speechResult = request.body?.SpeechResult || request.body?.speechResult || "I did not catch that clearly.";
      sendXml(res, await processVoiceStep(leadId, speechResult));
      return;
    }

    if (req.method === "POST" && request.path === "/twilio/status") {
      const leadId = request.query.leadId;
      await handleStatusUpdate(leadId, request.body?.CallStatus || "unknown", request.body?.CallSid || null);
      sendJson(res, 200, { ok: true });
      return;
    }

    notFound(res);
  } catch (error) {
    sendJson(res, 500, { error: error.message, stack: error.stack });
  }
});

server.listen(config.port, () => {
  const missing = validateConfiguration();
  const bannerPath = path.join(config.publicDir, "build-note.txt");
  if (!fs.existsSync(bannerPath)) {
    fs.writeFileSync(
      bannerPath,
      "What works: outbound Twilio call flow, live classification loop, WhatsApp follow-up hooks, callback parsing, and recruiter deliverables packaging.\nWhat does not: live calling cannot run until real Twilio and OpenAI credentials, public HTTPS hosting, a WhatsApp-enabled sender, and your actual resume/mobile number are configured.\nWhat next: deploy behind HTTPS, add call recordings and stronger Telugu STT tuning, and test the live conversation against real buyer responses.",
      "utf8"
    );
  }
  console.log(`ElevateBox caller running on http://localhost:${config.port}`);
  if (missing.length) {
    console.log(`Missing required configuration: ${missing.join(", ")}`);
  }
});

// Keep scheduled callback work durable in the lead store and dispatch it once due.
const callbackTimer = setInterval(() => {
  runDueCallbacks().catch((error) => console.error("Scheduled callback dispatch failed:", error.message));
}, 60_000);
callbackTimer.unref();

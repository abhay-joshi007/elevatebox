import { config } from "../config.js";
import { listLeads, updateLead } from "../lib/storage.js";
import { resolveCallbackTime } from "./qualification.js";
import { placeOutboundCall } from "./twilio.js";

export async function scheduleCallback(referenceText) {
  if (!referenceText) {
    return null;
  }

  const parsed = await resolveCallbackTime(referenceText, config.timezone);
  if (!parsed.isoLocal) {
    return {
      status: "needs_manual_confirmation",
      ...parsed
    };
  }

  return {
    status: "scheduled",
    ...parsed,
    scheduledAt: toAbsoluteIso(parsed.isoLocal, config.timezone)
  };
}

export function toAbsoluteIso(value, timezone) {
  if (!value) {
    return null;
  }

  // Offset-bearing values are already unambiguous; only local values need conversion.
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return null;
  }

  const [year, month, day, hour, minute, second = "0"] = match.slice(1).map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(localAsUtc));
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const renderedAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  return new Date(localAsUtc - (renderedAsUtc - localAsUtc)).toISOString();
}

export async function runDueCallbacks(now = new Date()) {
  const dueLeads = listLeads().filter((lead) => {
    if (lead.callback?.status !== "scheduled" || lead.callback?.callRequestedAt) {
      return false;
    }
    const scheduledFor = Date.parse(lead.callback.scheduledAt || toAbsoluteIso(lead.callback.isoLocal, config.timezone));
    return Number.isFinite(scheduledFor) && scheduledFor <= now.getTime();
  });

  const results = [];
  for (const lead of dueLeads) {
    try {
      const call = await placeOutboundCall({ to: lead.phoneNumber, leadId: lead.id });
      updateLead(lead.id, (draft) => {
        draft.callback.callRequestedAt = new Date().toISOString();
        draft.callback.callSid = call.sid;
        draft.status = "callback_queued";
        draft.events.push({ type: "callback_call_requested", value: call.sid, at: new Date().toISOString() });
        return draft;
      });
      results.push({ leadId: lead.id, status: "queued", callSid: call.sid });
    } catch (error) {
      updateLead(lead.id, (draft) => {
        draft.callback.lastAttemptAt = new Date().toISOString();
        draft.callback.lastError = error.message;
        draft.events.push({ type: "callback_call_failed", value: error.message, at: new Date().toISOString() });
        return draft;
      });
      results.push({ leadId: lead.id, status: "failed", error: error.message });
    }
  }
  return results;
}

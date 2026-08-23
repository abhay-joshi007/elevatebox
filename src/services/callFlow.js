import { config } from "../config.js";
import { getLead, updateLead } from "../lib/storage.js";
import { scheduleCallback } from "./scheduler.js";
import { analyzeConversationTurn, generateFollowUpMessage } from "./qualification.js";
import { sendWhatsAppMessage, sayAndGather, sayAndHangup } from "./twilio.js";

const LANGUAGE_HINTS = {
  "en-IN": ["budget", "timeline", "products", "website", "catalog", "checkout"],
  "hi-IN": ["budget", "timeline", "products", "website", "catalog", "checkout"],
  "te-IN": ["budget", "timeline", "products", "website", "catalog", "checkout"]
};

const DISCOVERY_PROMPTS = {
  "en-IN": "Thanks. I help businesses build e-commerce websites with custom catalog, payments, and growth features. Could you tell me what you want to sell online and what kind of store you are planning?",
  "hi-IN": "धन्यवाद। मैं कस्टम कैटलॉग, पेमेंट और ग्रोथ फीचर्स वाली ई-कॉमर्स वेबसाइट बनाने में मदद करता हूं। आप ऑनलाइन क्या बेचना चाहते हैं और किस तरह का स्टोर बनाना चाहते हैं?",
  "te-IN": "ధన్యవాదాలు. కస్టమ్ క్యాటలాగ్, పేమెంట్స్ మరియు గ్రోత్ ఫీచర్లతో ఈ-కామర్స్ వెబ్‌సైట్ రూపొందించడంలో నేను సహాయం చేస్తాను. మీరు ఆన్‌లైన్‌లో ఏమి అమ్మాలనుకుంటున్నారు, ఎలాంటి స్టోర్ కావాలి?"
};

const OBJECTIVE_PROMPTS = {
  "en-IN": {
    discover_budget: "Could you share the budget range you have in mind for this website project?",
    discover_products: "What do you sell, and roughly how many products or categories would the store need to handle?",
    discover_timeline: "By when are you hoping to launch this e-commerce website?",
    discover_features: "Which features matter most to you, for example payments, inventory, COD, multilingual support, or admin tools?",
    schedule_callback: "Sure, what time should we call you back?",
    close_high_intent: "That sounds promising. I am sending you our details on WhatsApp right now. Is there anything important you want included before I wrap up?",
    close_general: "Thanks, that helps. What else matters most for this e-commerce website?"
  },
  "hi-IN": {
    discover_budget: "इस वेबसाइट प्रोजेक्ट के लिए आपका अनुमानित बजट कितना है?",
    discover_products: "आप क्या बेचते हैं और स्टोर में लगभग कितने प्रोडक्ट या कैटेगरी होंगी?",
    discover_timeline: "आप यह ई-कॉमर्स वेबसाइट कब तक लॉन्च करना चाहते हैं?",
    discover_features: "आपके लिए कौन से फीचर्स सबसे जरूरी हैं, जैसे पेमेंट, इन्वेंटरी, कैश ऑन डिलीवरी, कई भाषाएं या एडमिन टूल्स?",
    schedule_callback: "ज़रूर, हम आपको किस समय वापस कॉल करें?",
    close_high_intent: "यह अच्छा लग रहा है। मैं अभी WhatsApp पर जानकारी भेज रहा हूं। कॉल समाप्त करने से पहले क्या कोई जरूरी बात शामिल करनी है?",
    close_general: "धन्यवाद, इससे मदद मिली। इस ई-कॉमर्स वेबसाइट में आपके लिए और क्या महत्वपूर्ण है?"
  },
  "te-IN": {
    discover_budget: "ఈ వెబ్‌సైట్ ప్రాజెక్ట్ కోసం మీరు అనుకున్న బడ్జెట్ పరిధి ఎంత?",
    discover_products: "మీరు ఏమి అమ్ముతారు, స్టోర్‌లో సుమారుగా ఎన్ని ప్రొడక్ట్స్ లేదా కేటగిరీలు ఉంటాయి?",
    discover_timeline: "ఈ ఈ-కామర్స్ వెబ్‌సైట్‌ను ఎప్పటికి ప్రారంభించాలని అనుకుంటున్నారు?",
    discover_features: "పేమెంట్స్, ఇన్వెంటరీ, క్యాష్ ఆన్ డెలివరీ, బహుభాషా మద్దతు లేదా అడ్మిన్ టూల్స్ వంటి ఏ ఫీచర్లు మీకు ముఖ్యమైనవి?",
    schedule_callback: "సరే, మేము మీకు ఏ సమయంలో తిరిగి కాల్ చేయాలి?",
    close_high_intent: "ఇది ఆసక్తికరంగా ఉంది. నేను ఇప్పుడు WhatsAppలో వివరాలు పంపుతున్నాను. ముగించే ముందు మీరు చేర్చాలనుకునే ముఖ్యమైన విషయం ఏదైనా ఉందా?",
    close_general: "ధన్యవాదాలు, ఇది ఉపయోగకరంగా ఉంది. ఈ ఈ-కామర్స్ వెబ్‌సైట్‌లో మీకు ఇంకా ఏమి ముఖ్యమైనది?"
  }
};

export function buildOpeningPrompt() {
  return "Hello, this is an AI consultant calling about e-commerce website development. You can speak in English, Hindi, or Telugu. Which language would you prefer, and are you currently exploring a new online store for your business?";
}

export function buildVoiceResponse(leadId) {
  const lead = getLead(leadId);
  if (!lead) {
    return sayAndHangup({
      prompt: "Sorry, I could not load this lead record. Please try again later.",
      language: config.defaultLanguage
    });
  }

  const prompt = lead.transcript.length === 0 ? buildOpeningPrompt() : lead.nextPrompt || "Please tell me a bit more about your website requirement.";
  return sayAndGather({
    prompt,
    actionUrl: `${config.appBaseUrl}/twilio/voice/step?leadId=${encodeURIComponent(leadId)}`,
    language: lead.language || config.defaultLanguage,
    hints: LANGUAGE_HINTS[lead.language] || LANGUAGE_HINTS[config.defaultLanguage]
  });
}

function detectLanguage(text) {
  const lower = text.toLowerCase();
  if (lower.includes("hindi")) {
    return "hi-IN";
  }
  if (lower.includes("telugu")) {
    return "te-IN";
  }
  if (lower.includes("english")) {
    return "en-IN";
  }
  return null;
}

function nextPromptFromObjective(objective, language) {
  const prompts = OBJECTIVE_PROMPTS[language] || OBJECTIVE_PROMPTS["en-IN"];
  return prompts[objective] || prompts.close_general;
}

export async function processVoiceStep(leadId, speechResult) {
  let lead = getLead(leadId);
  if (!lead) {
    return sayAndHangup({
      prompt: "Sorry, the lead session has expired.",
      language: config.defaultLanguage
    });
  }

  const detectedLanguage = detectLanguage(speechResult);
  if (lead.transcript.length === 0 && detectedLanguage) {
    lead = updateLead(leadId, (draft) => {
      draft.language = detectedLanguage;
      draft.transcript.push({ role: "caller", text: speechResult, at: new Date().toISOString() });
      draft.nextPrompt = DISCOVERY_PROMPTS[detectedLanguage];
      draft.status = "in_progress";
      draft.events.push({ type: "language_selected", value: detectedLanguage, at: new Date().toISOString() });
      return draft;
    });

    return sayAndGather({
      prompt: lead.nextPrompt,
      actionUrl: `${config.appBaseUrl}/twilio/voice/step?leadId=${encodeURIComponent(leadId)}`,
      language: lead.language,
      hints: LANGUAGE_HINTS[lead.language]
    });
  }

  const analysis = await analyzeConversationTurn(lead, speechResult);
  lead = updateLead(leadId, (draft) => {
    draft.status = "in_progress";
    draft.language = analysis.language || draft.language;
    draft.classification = analysis.classification;
    draft.signals.highIntent = analysis.highIntent;
    draft.signals.callbackRequested = analysis.callbackRequested;
    draft.slots = {
      budget: analysis.slots.budget || draft.slots.budget,
      products: analysis.slots.products || draft.slots.products,
      timeline: analysis.slots.timeline || draft.slots.timeline,
      features: analysis.slots.features || draft.slots.features
    };
    draft.transcript.push({ role: "caller", text: speechResult, at: new Date().toISOString() });
    draft.notes.push({ type: "turn_summary", text: analysis.summary, at: new Date().toISOString() });
    draft.nextPrompt = analysis.reply || nextPromptFromObjective(analysis.nextObjective, draft.language);
    draft.events.push({
      type: "classification",
      value: analysis.classification,
      highIntent: analysis.highIntent,
      at: new Date().toISOString()
    });
    if (analysis.callbackTimeReference) {
      draft.callbackReference = analysis.callbackTimeReference;
    }
    return draft;
  });

  if (analysis.highIntent && !lead.events.some((event) => event.type === "mid_call_whatsapp_sent")) {
    await sendMidCallWhatsApp(lead);
    lead = updateLead(leadId, (draft) => {
      draft.events.push({ type: "mid_call_whatsapp_sent", at: new Date().toISOString() });
      return draft;
    });
  }

  if (analysis.callbackRequested && analysis.callbackTimeReference) {
    const callback = await scheduleCallback(analysis.callbackTimeReference);
    lead = updateLead(leadId, (draft) => {
      draft.callback = callback;
      draft.events.push({ type: "callback_processed", value: callback, at: new Date().toISOString() });
      draft.nextPrompt =
        callback?.status === "scheduled"
          ? `Perfect, I have marked the callback for ${callback.isoLocal}. I will also send the project details on WhatsApp right away.`
          : "I understood that you want a callback, but the exact time was a bit unclear. I will mention that in the WhatsApp follow-up so you can confirm it there.";
      return draft;
    });
  }

  const shouldClose = lead.events.filter((event) => event.type === "classification").length >= 4 || Boolean(lead.callback);
  if (shouldClose) {
    await sendFinalFollowUp(leadId);
    return sayAndHangup({
      prompt: lead.nextPrompt || "Thank you for your time. I have sent you the details on WhatsApp.",
      language: lead.language
    });
  }

  return sayAndGather({
    prompt: lead.nextPrompt,
    actionUrl: `${config.appBaseUrl}/twilio/voice/step?leadId=${encodeURIComponent(leadId)}`,
    language: lead.language,
    hints: LANGUAGE_HINTS[lead.language] || LANGUAGE_HINTS[config.defaultLanguage]
  });
}

export async function handleStatusUpdate(leadId, status, callSid) {
  let shouldSendFollowUp = false;
  updateLead(leadId, (draft) => {
    draft.callSid = callSid || draft.callSid;
    draft.events.push({ type: "twilio_status", value: status, at: new Date().toISOString() });
    draft.status = status;
    if (status === "completed") {
      shouldSendFollowUp = !draft.events.some((event) => event.type === "final_whatsapp_sent");
    }
    return draft;
  });

  if (shouldSendFollowUp) {
    await sendFinalFollowUp(leadId);
  }
}

async function sendMidCallWhatsApp(lead) {
  const body = [
    `Hi, this is ${config.callerName}.`,
    "Sharing the e-commerce website details we are discussing right now.",
    `Current need: ${lead.slots.products || "capturing catalog details"}.`,
    `Timeline: ${lead.slots.timeline || "to be confirmed"}.`,
    `Budget: ${lead.slots.budget || "to be confirmed"}.`,
    `You can call me back on ${config.yourMobileNumber || "the number shared in the follow-up"}.`
  ].join(" ");

  await sendWhatsAppMessage({
    to: lead.phoneNumber,
    body,
    mediaUrls: [lead.artifacts.architectureImageUrl]
  });
}

export async function sendFinalFollowUp(leadId) {
  let lead = getLead(leadId);
  if (!lead || lead.events.some((event) => event.type === "final_whatsapp_sent")) {
    return;
  }

  const message = await generateFollowUpMessage(lead);
  await sendWhatsAppMessage({
    to: lead.phoneNumber,
    body: `${message}\n\nMy number: ${config.yourMobileNumber || "Please set YOUR_MOBILE_NUMBER in env."}`,
    mediaUrls: [lead.artifacts.resumeUrl, lead.artifacts.architectureImageUrl]
  });

  lead = updateLead(leadId, (draft) => {
    draft.events.push({ type: "final_whatsapp_sent", at: new Date().toISOString(), body: message });
    draft.status = "completed";
    return draft;
  });

  return lead;
}

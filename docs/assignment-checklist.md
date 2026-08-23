# ElevateBox Assignment Checklist

This file maps the PDF requirements to the code and artifacts in this repository.

## Must-do items from the assignment

1. Place the call automatically
   Implemented by `POST /api/outbound/call`, which creates a lead and uses the Twilio Calls API.
2. Speak Telugu, Hindi, or English
   The call opens by asking for the preferred language and stores `en-IN`, `hi-IN`, or `te-IN`.
3. Sell e-commerce website development
   The opening and subsequent prompts are designed around selling custom e-commerce website development.
4. Ask budget, products, timeline, and features
   The qualification loop extracts and stores these four slots on every turn.
5. Understand the answers
   OpenAI structured output updates lead state from real caller speech.
6. Classify Hot, Warm, or Cold
   Every analyzed turn returns one of these three states.
7. Fire a WhatsApp mid-call on high intent
   When high intent is detected, the service sends WhatsApp immediately and logs the event.
8. Book a callback from spoken time
   Callback phrasing is parsed into a local ISO datetime or marked for manual confirmation. A durable lead record is scanned every minute and an outbound callback is queued when the stored time is due.
9. Follow up using what the caller actually said
   Final WhatsApp generation uses transcript context and extracted slots.
10. Send resume, number, and build image
   The final WhatsApp includes your mobile number and media attachment URLs for the resume and architecture image.

## Scorecard alignment

- `25/100` conversation handling
  The Twilio voice webhook loop supports multi-turn speech collection and adaptive replies.
- `10/100` language handling
  Language preference is captured early and reused through the rest of the call.
- `10/100` discovery quality
  The system keeps asking until core qualification data is gathered.
- `15/100` intent classification
  Structured classification is stored per turn and used to trigger actions.
- `15/100` mid-call action
  A dedicated mid-call WhatsApp path is triggered before the call ends.
- `10/100` callback scheduling
  Spoken time references are normalized into scheduled callback metadata.
- `10/100` WhatsApp quality
  The follow-up is generated from actual call context and includes the requested assets.
- `5/100` engineering judgment
  The repo uses simple primitives, persistent state, explicit webhook flows, path-safe artifact serving, preflight configuration checks, and a portable Docker deployment path that are easy to defend in a live walkthrough.

## Missing real-world inputs you still have to provide

- Real API credentials
- A public HTTPS deployment URL
- A WhatsApp-enabled Twilio sender with required business approvals
- Your actual mobile number
- Your actual resume PDF at `assets/resume.pdf`

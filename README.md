# ElevateBox AI Voice Seller

This repository is a full working prototype for the ElevateBox SDE Intern assignment: an outbound AI caller that pitches e-commerce website development, qualifies the buyer, classifies intent, sends WhatsApp during the call for hot leads, captures spoken callback times, and sends a contextual follow-up with the requested recruiter artifacts.

## What is in the repo

- A low-dependency Node.js server in `src/server.js`
- Twilio Voice and WhatsApp integration points in `src/services/twilio.js`
- Lead understanding, classification, and follow-up generation through the OpenAI Responses API
- A local dashboard to trigger calls and inspect lead state
- An architecture image at `assets/architecture.svg`
- A short recruiter note served from `/artifacts/build-note.txt`

## Quick start

1. Copy `.env.example` to `.env`
2. Fill in Twilio, OpenAI, public HTTPS URL, your mobile number, and media paths
3. Put your real resume at `assets/resume.pdf` (the app refuses to report healthy until this exists)
4. Run `node src/server.js`
5. Open `http://localhost:3000`
6. Click `Place Outbound Call`

The call button returns a clear `503` configuration response until all live credentials, public URLs, mobile number, and resume asset are present; it never attempts a malformed Twilio request.

Before placing a real call, run `npm run preflight`. It prints the exact missing values and exits successfully only when the live deployment is ready.

## Environment notes

- `APP_BASE_URL` must be a public HTTPS domain for Twilio webhooks and media attachments
- `TWILIO_WHATSAPP_NUMBER` must already be enabled for WhatsApp
- `TARGET_PHONE_NUMBER` defaults to the assignment number `+918688664337`
- The app stores lead state in `data/leads.json`

## Deploy for a live call

1. Build and deploy the included `Dockerfile` to any HTTPS-capable host. `render.yaml` is included for Render's Docker deployment flow.
2. Set the values from `.env.example` in the host's environment settings, including your real mobile number and WhatsApp-approved Twilio sender.
3. Upload your actual `assets/resume.pdf` before the Docker build, then set `APP_BASE_URL` to the deployed HTTPS URL.
4. Open `/api/health`. It must return `"ok": true` before placing a call. Configure Twilio Voice webhooks through the call API flow; the app supplies the webhook URLs per call.
5. Place the initial call from the dashboard. Callback leads are scanned once per minute and automatically called at the stored time.

## Important reality check

The codebase is complete enough to deploy and run, but live calling will not work until you provide:

- Real Twilio credentials
- A public webhook URL
- OpenAI API access
- Your actual resume PDF
- Your actual mobile number

## Assignment deliverables covered

- Working outbound call trigger
- Multilingual voice qualification flow
- Hot, warm, cold lead classification
- Mid-call WhatsApp trigger
- Callback scheduling from speech, followed by an automatic outbound callback at the stored time
- Contextual final WhatsApp follow-up
- Architecture image
- Short implementation note

## Suggested demo flow

1. Start the app and confirm `/api/health` is healthy
2. Use the dashboard or `POST /api/outbound/call`
3. Answer the phone in English, Hindi, or Telugu
4. Mention product type, budget, timeline, and features
5. Ask for details or say you want a callback tomorrow morning
6. Confirm the WhatsApp arrives during or immediately after the call

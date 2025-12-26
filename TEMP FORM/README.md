Temp Form — README

Overview
--------
This is a simple static HTML form that opens WhatsApp (web/mobile) to send a pre-filled message to the committee number **011-28151179** when the form is submitted — no Make or WhatsApp API required.

Quick steps
-----------
1. Open `index.html` in a browser (or via GitHub Pages).
2. Fill the form and press **Hantar sekarang** — the browser will open WhatsApp Web (or the WhatsApp app on mobile) with a prefilled message to **011-28151179**. You must press **Send** in WhatsApp to actually send the notification.

Optional: automatic forwarding
------------------------------
- If you prefer fully automatic forwarding (no manual Send in WhatsApp), set up a Make scenario or a server that accepts the form payload and forwards it to Twilio's WhatsApp sandbox or another provider. The form used to include `notify_to` in the payload to help routing if you want to enable this later.

Notes & tips
-----------
- This implementation opens WhatsApp so the admin must press Send — it's simplest and avoids needing WhatsApp Business API credentials.
- For production (sending to many users without manual action), you will need a WhatsApp Business provider and approved message templates.

Need help?
---------
If you want automatic forwarding later, tell me and I can outline a Make / Twilio setup or implement a server-side forwarder for you.
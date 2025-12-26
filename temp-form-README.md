Temp Form — README

Overview
--------
This is a simple static HTML form that posts JSON to a Make (Integromat) webhook. Once Make receives the payload you can forward the data to WhatsApp using Twilio (sandbox) or any provider you prefer.

Quick steps
-----------
1. Create a Make scenario:
   - Add module: **Webhooks > Custom webhook** → *Create a new webhook* → copy the generated webhook URL.
2. Edit `index.html` and replace `REPLACE_WITH_YOUR_MAKE_WEBHOOK_URL` with the webhook URL you copied.
3. Add a module in the same scenario to forward the incoming webhook to WhatsApp:
   - If using **Twilio WhatsApp sandbox**: add **Twilio > Send a WhatsApp message** (connect with your Account SID / Auth Token).
   - Map the message body to a formatted text, for example:

```
Nama: {{nama}}
Unit: {{unit}}
No telefon: {{phone}}
Jumlah anak: Lelaki: {{anak_lelaki}} Perempuan: {{anak_perempuan}}
Submitted at: {{submitted_at}}
```

4. Set the Twilio "To" field to the WhatsApp number that will receive the notification (your admin number).
   - For Twilio sandbox testing, the receiving WhatsApp number must have joined the sandbox (follow Twilio instructions to send the join code from the phone).
5. Turn the scenario ON in Make and test by opening `index.html` (locally or via GitHub Pages) and submitting the form.

Notes & tips
-----------
- Make webhook will accept public POST requests. If you want to avoid abuse, add a secret key in the payload or add basic validation in Make.
- For production (sending to many users), you will need a proper WhatsApp Business setup and templates for messages outside the 24-hour window.

Need help?
---------
Tell me your Make webhook URL and the WhatsApp number you want to receive notifications and I can help configure the scenario body mapping and a test plan.
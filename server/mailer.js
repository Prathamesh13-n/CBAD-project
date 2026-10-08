/* ============================================================
   CDAD server :: mailer.js
   Sends the Forgot Password confirmation code over real email via
   Gmail SMTP, using an App Password (never your actual Google
   password) — see GMAIL_USER / GMAIL_APP_PASSWORD in server/.env.
   ============================================================ */
require('dotenv').config();
const nodemailer = require('nodemailer');

const configured = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

const transporter = configured
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    })
  : null;

if (!configured) {
  console.warn(
    'mailer.js: GMAIL_USER / GMAIL_APP_PASSWORD not set — Forgot Password will not be able to send emails ' +
    '(see server/.env.example).'
  );
}

/** Sends the 6-digit reset code. Throws if the mailer isn't configured or the send fails — callers should catch. */
async function sendResetCodeEmail(toEmail, code) {
  if (!configured) throw new Error('Email is not configured on this server. Contact faculty/admin.');
  await transporter.sendMail({
    from: `"CDAD" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Your CDAD password reset code',
    text: `Your password reset code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p>Your password reset code is <strong style="font-size:18px;">${code}</strong>.</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`
  });
}

module.exports = { sendResetCodeEmail, isConfigured: () => configured };

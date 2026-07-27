import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST || "";
const port = Number(process.env.SMTP_PORT || 0);
const user = process.env.SMTP_USER || "";
const pass = process.env.SMTP_PASS || "";
const from = process.env.SMTP_FROM || "Colegio <no-reply@colegio.edu>";

const canSend = Boolean(host && port);

const transporter = canSend
  ? nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: user && pass ? { user, pass } : undefined,
    })
  : null;

export function canSendEmail() {
  return Boolean(transporter);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!transporter) return false;
  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return true;
}

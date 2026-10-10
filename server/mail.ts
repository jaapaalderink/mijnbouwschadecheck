import nodemailer from "nodemailer";
export const mailConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.EMAIL_FROM);
export async function sendMail(to: string, subject: string, text: string) {
  if (!mailConfigured()) throw Error("EMAIL_NOT_CONFIGURED");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS:
      process.env.SMTP_SECURE !== "true" &&
      process.env.SMTP_REQUIRE_TLS !== "false",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  await transport.sendMail({ from: process.env.EMAIL_FROM, to, subject, text });
}

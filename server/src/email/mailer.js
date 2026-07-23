import nodemailer from "nodemailer";

export class EmailSendError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = "EmailSendError";
    this.cause = cause;
  }
}

let transporterPromise;

// Flip to true to exercise SMTP locally (still required automatically in production / on Heroku).
const FORCE_SIGNUP_EMAIL_LOCALLY = true;

/**
 * Signup email gates account creation when required.
 * Local development skips SMTP unless FORCE_SIGNUP_EMAIL_LOCALLY is true.
 */
export function isSignupEmailRequired() {
  return (
    FORCE_SIGNUP_EMAIL_LOCALLY ||
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.DYNO)
  );
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new EmailSendError(`Missing required email config: ${name}`);
  }
  return value;
}

function createTransporter() {
  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass: pass || "" } : undefined,
  });
}

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = Promise.resolve(createTransporter());
  }
  return transporterPromise;
}

function getFromAddress() {
  return process.env.EMAIL_FROM?.trim() || requireEnv("SMTP_USER");
}

/**
 * Sends the signup welcome email when required by the environment.
 * In local development, skips SMTP and returns { skipped: true }.
 * In production/Heroku, resolves only when the provider accepts the message.
 * @param {{ to: string, firstName: string }} params
 * @returns {Promise<{ skipped: true } | import('nodemailer').SentMessageInfo>}
 */
export async function sendSignupEmail({ to, firstName }) {
  if (!isSignupEmailRequired()) {
    console.info(
      `[email] Skipping signup email in local development (to=${to})`,
    );
    return { skipped: true };
  }

  const displayName = String(firstName || "").trim() || "there";
  const from = getFromAddress();
  const subject = "Welcome to Soccer Predictor";
  const text = [
    `Hi ${displayName},`,
    "",
    "Thanks for signing up for Soccer Predictor.",
    "Your account is ready — sign in with this email to start making predictions.",
    "",
    "If you did not create this account, you can ignore this message.",
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(displayName)},</p>
    <p>Thanks for signing up for <strong>Soccer Predictor</strong>.</p>
    <p>Your account is ready — sign in with this email to start making predictions.</p>
    <p>If you did not create this account, you can ignore this message.</p>
  `.trim();

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    if (info.rejected?.length) {
      throw new EmailSendError(`Email provider rejected address: ${to}`);
    }
    console.info(`[email] Signup email sent to ${to}`);
    console.log(text);
    return info;
  } catch (err) {
    if (err instanceof EmailSendError) throw err;
    throw new EmailSendError("Failed to send signup email", { cause: err });
  }
}

/**
 * Sends a league invite email when SMTP is required by the environment.
 * In local development, skips SMTP and returns { skipped: true } unless forced.
 * @param {{ to: string, leagueName: string, inviterName: string, joinUrl: string }} params
 * @returns {Promise<{ skipped: true } | import('nodemailer').SentMessageInfo>}
 */
export async function sendLeagueInviteEmail({
  to,
  leagueName,
  inviterName,
  joinUrl,
}) {
  if (!isSignupEmailRequired()) {
    console.info(
      `[email] Skipping league invite email in local development (to=${to})`,
    );
    return { skipped: true };
  }

  const league = String(leagueName || "").trim() || "a league";
  const inviter = String(inviterName || "").trim() || "A commissioner";
  const url = String(joinUrl || "").trim();
  if (!url) {
    throw new EmailSendError("joinUrl is required for league invite emails");
  }

  const from = getFromAddress();
  const subject = `You're invited to join ${league} on Soccer Predictor`;
  const text = [
    `Hi,`,
    "",
    `${inviter} invited you to join the fantasy league "${league}" on Soccer Predictor.`,
    "",
    `Join here: ${url}`,
    "",
    "You'll need an account to accept the invite. If you did not expect this message, you can ignore it.",
  ].join("\n");

  const html = `
    <p>Hi,</p>
    <p><strong>${escapeHtml(inviter)}</strong> invited you to join the fantasy league <strong>${escapeHtml(league)}</strong> on Soccer Predictor.</p>
    <p><a href="${escapeHtml(url)}">Join the league</a></p>
    <p>You'll need an account to accept the invite. If you did not expect this message, you can ignore it.</p>
  `.trim();

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    if (info.rejected?.length) {
      throw new EmailSendError(`Email provider rejected address: ${to}`);
    }
    console.info(`[email] League invite email sent to ${to}`);
    return info;
  } catch (err) {
    if (err instanceof EmailSendError) throw err;
    throw new EmailSendError("Failed to send league invite email", {
      cause: err,
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

import {Resend} from 'resend';
import {
  verificationEmailTemplate,
  resetPasswordEmailTemplate,
  emailChangeTemplate} from './emailTemplates'
const resend = new Resend(process.env.RESEND_API_KEY);

type SendParams = Parameters<typeof resend.emails.send>[0];

// resend.emails.send NON lancia: restituisce { data, error }. Lo trasformiamo in eccezione.
// Il messaggio non contiene mai token/URL, e gli indirizzi email vengono oscurati.
const send = async (params: SendParams) => {
  const { error } = await resend.emails.send(params);
  if (error) {
    const msg = String(error.message ?? '').replace(/\S+@\S+/g, '[email]');
    throw new Error(`Invio email fallito (${error.name}): ${msg}`);
  }
};

export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  await send({
    from: process.env.SMTP_FROM || '',
    to: email,
    subject: 'Verifica il tuo account',
    html: verificationEmailTemplate(verificationUrl),
  });
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await send({
    from: process.env.SMTP_FROM || '',
    to: email,
    subject: 'Reset Password',
      html: resetPasswordEmailTemplate(resetUrl),
  });
};

export const sendEmailChangeVerification = async (newEmail: string, token: string) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email-change?token=${token}`;

  await send({
    from: process.env.SMTP_FROM || '',
    to: newEmail,
    subject: 'Conferma il tuo nuovo indirizzo email — Finance Tracker',
    html: emailChangeTemplate(verificationUrl, newEmail),
  });
};

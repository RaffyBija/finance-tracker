import {Resend} from 'resend';
import {verificationEmailTemplate, resetPasswordEmailTemplate} from './emailTemplates'
const resend = new Resend(process.env.RESEND_API_KEY);


export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  await resend.emails.send({
    from: process.env.SMTP_FROM || '',
    to: email,
    subject: 'Verifica il tuo account',
    html: verificationEmailTemplate(verificationUrl),
  });
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  await resend.emails.send({
    from: process.env.SMTP_FROM || '',
    to: email,
    subject: 'Reset Password',
      html: resetPasswordEmailTemplate(resetUrl),
  });
};
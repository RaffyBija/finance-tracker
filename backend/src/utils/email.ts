import {Resend} from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);


export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  await resend.emails.send({
    from: process.env.SMTP_FROM || '"Finance Tracker" <noreply@financetracker.com>',
    to: email,
    subject: 'Verifica il tuo account',
    html: `
      <h1>Benvenuto su Finance Tracker!</h1>
      <p>Clicca sul link per verificare il tuo account:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>Il link è valido per 24 ore.</p>
    `,
  });
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  await resend.emails.send({
    from: process.env.SMTP_FROM || '"Finance Tracker" <noreply@financetracker.com>',
    to: email,
    subject: 'Reset Password',
    html: `
      <h1>Reset Password</h1>
      <p>Clicca sul link per reimpostare la password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>Il link è valido per 1 ora.</p>
    `,
  });
};
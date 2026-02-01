import nodemailer from 'nodemailer';

// Usa un servizio come SendGrid, Mailgun, o Gmail
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  await transporter.sendMail({
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
  
  await transporter.sendMail({
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
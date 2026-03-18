import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma";
import { RegisterDTO, LoginDTO, AuthResponse } from "../types";
import crypto from "crypto";
import { 
  sendVerificationEmail, 
  sendPasswordResetEmail,
  sendEmailChangeVerification, } from "../utils/email";
import { AuthRequest } from "../types";


// Registrazione utente
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name }: RegisterDTO = req.body;
    // Validazione base
    if (!email.trim() || !password.trim() || !name.trim()) {
      return res
        .status(400)
        .json({ error: "Email, password e nome sono obbligatori" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Email non valida' });
      }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email già in uso" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Genera token di verifica
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ore

    // Invia email di verifica
    await sendVerificationEmail(email, verifyToken);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
      },
    });

    res.status(201).json({
      message:
        "Registrazione completata! Controlla la tua email per verificare l'account.",
      userId: user.id,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Errore del server" });
  }
};

// Verifica email
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
      },
    });

    if (!user) {
      return res.status(400).json({ error: "Token non valido o scaduto" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    res.json({ message: "Email verificata con successo!" });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ error: "Errore del server" });
  }
};

// Request password reset
export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Non rivelare se l'email esiste per sicurezza
      return res.json({
        message: "Se l'email esiste, riceverai un link per il reset",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 ora

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: "Se l'email esiste, riceverai un link per il reset" });
  } catch (error) {
    console.error("Request reset error:", error);
    res.status(500).json({ error: "Errore del server" });
  }
};

// Reset password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password deve essere di almeno 6 caratteri" });
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gte: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: "Token non valido o scaduto" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    res.json({ message: "Password reimpostata con successo!" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Errore del server" });
  }
};

// Login utente
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginDTO = req.body;

    // Validazione base
    if (!email.trim() || !password.trim()) {
      return res
        .status(400)
        .json({ error: "Email e password sono obbligatori" });
    }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Email non valida' });
      }
    // Trova l'utente
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    //Verifico che l'email sia verificata
    if (!user.isEmailVerified) {
      return res
        .status(401)
        .json({
          error: "Email non verificata. Controlla la tua casella di posta.",
        });
    }

    // Verifica password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }

    // Genera JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!, // il fail-fast in server.ts garantisce che esista
      { expiresIn: "7d" },
    );

    const response: AuthResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Errore del server" });
  }
};

// Get user info
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    res.json(user);
  } catch (error) {
    console.error("GetMe error:", error);
    res.status(500).json({ error: "Errore del server" });
  }
};

// Aggiorna profilo — il nome si aggiorna subito, l'email richiede verifica
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, email } = req.body;

    if (!name?.trim() && !email?.trim()) {
      return res.status(400).json({ error: 'Fornisci almeno un campo da aggiornare' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    // ── Aggiornamento nome ──────────────────────────────────────────
    if (name?.trim()) {
      if (name.trim().length < 2) {
        return res.status(400).json({ error: 'Il nome deve avere almeno 2 caratteri' });
      }
      if (name.trim().length > 50) {
        return res.status(400).json({ error: 'Il nome è troppo lungo (max 50 caratteri)' });
      }
    }

    // ── Aggiornamento email ─────────────────────────────────────────
    let emailChangeRequested = false;

    if (email?.trim() && email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Email non valida' });
      }

      // Verifica che non sia già in uso
      const existing = await prisma.user.findFirst({
        where: { email: email.trim().toLowerCase(), NOT: { id: userId } },
      });
      if (existing) {
        return res.status(409).json({ error: 'Email già in uso da un altro account' });
      }

      // Genera token e salva email pendente
      const changeToken = crypto.randomBytes(32).toString('hex');
      const changeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ore

      await prisma.user.update({
        where: { id: userId },
        data: {
          pendingEmail: email.trim().toLowerCase(),
          // Riutilizziamo emailVerifyToken per il cambio email
          emailVerifyToken: changeToken,
          emailVerifyExpires: changeExpires,
          // Aggiorna subito il nome se fornito
          ...(name?.trim() && { name: name.trim() }),
        },
      });

      // Invia email di verifica alla NUOVA email
      await sendEmailChangeVerification(email.trim(), changeToken);
      emailChangeRequested = true;

    } else if (name?.trim()) {
      // Solo aggiornamento nome, nessuna modifica email
      await prisma.user.update({
        where: { id: userId },
        data: { name: name.trim() },
      });
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    res.json({
      user: updatedUser,
      emailChangeRequested,
      message: emailChangeRequested
        ? `Abbiamo inviato un link di conferma a ${email}. La tua email attuale rimane invariata fino alla conferma.`
        : 'Profilo aggiornato con successo',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Verifica cambio email — chiamata quando l'utente clicca il link
export const verifyEmailChange = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token mancante' });
    }

    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpires: { gte: new Date() },
        pendingEmail: { not: null },
      },
    });

    if (!user || !user.pendingEmail) {
      return res.status(400).json({ error: 'Token non valido o scaduto' });
    }

    // Verifica che la nuova email non sia stata presa nel frattempo
    const emailTaken = await prisma.user.findFirst({
      where: { email: user.pendingEmail, NOT: { id: user.id } },
    });
    if (emailTaken) {
      await prisma.user.update({
        where: { id: user.id },
        data: { pendingEmail: null, emailVerifyToken: null, emailVerifyExpires: null },
      });
      return res.status(409).json({ error: 'Questa email è già in uso. La modifica è stata annullata.' });
    }

    // Aggiorna l'email definitivamente
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.pendingEmail,
        pendingEmail: null,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    res.json({ message: 'Email aggiornata con successo! Accedi con il nuovo indirizzo.' });
  } catch (error) {
    console.error('Verify email change error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Cambio password (richiede password attuale)
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Le nuove password non corrispondono' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La nuova password deve avere almeno 8 caratteri' });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ error: 'La nuova password deve essere diversa da quella attuale' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Password attuale non corretta' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password aggiornata con successo' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Eliminazione account (richiede conferma email)
export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { confirmEmail } = req.body;

    if (!confirmEmail) {
      return res.status(400).json({ error: 'Inserisci la tua email per confermare' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (user.email.toLowerCase() !== confirmEmail.toLowerCase().trim()) {
      return res.status(400).json({ error: 'Email non corretta' });
    }

    // Cascade delete grazie alle relazioni Prisma (onDelete: Cascade)
    await prisma.user.delete({ where: { id: userId } });

    res.json({ message: 'Account eliminato con successo' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

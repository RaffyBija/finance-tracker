import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { RegisterDTO, LoginDTO, AuthResponse } from '../types';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';

// Registrazione utente
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name }: RegisterDTO = req.body;
    // Validazione base
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password e nome sono obbligatori' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email già in uso' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Genera token di verifica
    const verifyToken = crypto.randomBytes(32).toString('hex');
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
      message: 'Registrazione completata! Controlla la tua email per verificare l\'account.',
      userId: user.id 
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};


// Verifica email
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Token non valido o scaduto' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    res.json({ message: 'Email verificata con successo!' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Request password reset
export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      // Non rivelare se l'email esiste per sicurezza
      return res.json({ message: 'Se l\'email esiste, riceverai un link per il reset' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 ora

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: 'Se l\'email esiste, riceverai un link per il reset' });
  } catch (error) {
    console.error('Request reset error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Reset password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password deve essere di almeno 6 caratteri' });
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gte: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Token non valido o scaduto' });
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

    res.json({ message: 'Password reimpostata con successo!' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Login utente
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginDTO = req.body;

    // Validazione base
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password sono obbligatori' });
    }

    // Trova l'utente
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    // Verifica password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    // Genera JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Get user info
export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

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
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    res.json(user);
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Fail-fast: se JWT_SECRET non è configurato, il server non parte
if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET non configurato nelle variabili d\'ambiente');
}

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Security headers (helmet copre X-Frame-Options, CSP, HSTS, ecc.)
app.use(helmet());

// ✅ CORS limitato al tuo dominio frontend
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173']; // solo dev fallback

app.use(cors({
  origin: (origin, callback) => {
    // Permetti richieste senza origin (es. Postman in dev, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origine non permessa: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10kb' })); // ✅ Limite dimensione body

// ✅ Rate limiting globale (tutte le route API)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe richieste, riprova tra poco.' },
});
app.use('/api/', globalLimiter);

// ✅ Rate limiting più stretto sugli endpoint di autenticazione
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 10, // max 10 tentativi per IP ogni 15 minuti
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi di accesso, riprova tra 15 minuti.' },
  skipSuccessfulRequests: true, // i login riusciti non consumano il limite
});

// Routes
import authRoutes from './routes/auth.routes';
import transactionRoutes from './routes/transaction.routes';
import categoryRoutes from './routes/category.routes';
import dashboardRoutes from './routes/dashboard.routes';
import budgetRoutes from './routes/budget.routes';
import recurringRoutes from './routes/recurring.routes';
import plannedRoutes from './routes/planned.routes';

// Health check (fuori dal rate limiter)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ✅ Rate limiter specifico applicato alle sole route auth sensibili
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/request-password-reset', authLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/planned', plannedRoutes);

// ✅ Error handler globale (evita che Express esponga stack trace in produzione)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Errore del server' : err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;


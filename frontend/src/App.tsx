import { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout/Layout";
import PublicRoute from "./components/PublicRoute";
import { ToastProvider } from "./contexts/ToastContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import LoadingSpinner from "./components/shared/LoadingSpinner";
import { lazyWithReload } from "./utils/lazyWithReload";
import { inject } from "@vercel/analytics";

// Eager: primo accesso non autenticato e fallback 404 (nessuno spinner-waterfall)
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import NotFoundPage from "./pages/NotFoundPage";

// Lazy: chunk separati scaricati on-demand
const RegisterPage = lazyWithReload(() => import("./pages/RegisterPage"));
const DashboardPage = lazyWithReload(() => import("./pages/DashboardPage"));
const TransactionsPage = lazyWithReload(() => import("./pages/TransactionsPage"));
const CategoriesPage = lazyWithReload(() => import("./pages/CategoriesPage"));
const Budgets = lazyWithReload(() => import("./pages/BudgetsPage").then(m => ({ default: m.Budgets })));
const RecurringTransactions = lazyWithReload(() => import("./pages/RecurringTransactions").then(m => ({ default: m.RecurringTransactions })));
const PlannedTransactions = lazyWithReload(() => import("./pages/PlannedPage").then(m => ({ default: m.PlannedTransactions })));
const Privacy = lazyWithReload(() => import("./pages/Privacy").then(m => ({ default: m.Privacy })));
const ForgotPasswordPage = lazyWithReload(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazyWithReload(() => import("./pages/ResetPasswordPage"));
const VerifyEmailPage = lazyWithReload(() => import("./pages/VerifyEmailPage"));
const VerifyEmailChangePage = lazyWithReload(() => import("./pages/VerifyEmailChangePage"));
const ProfilePage = lazyWithReload(() => import("./pages/ProfilePage"));
const CalendarPage = lazyWithReload(() => import("./pages/CalendarPage"));
const AccountsPage = lazyWithReload(() => import("./pages/AccountsPage"));
const AccountDetailPage = lazyWithReload(() => import("./pages/AccountDetailPage"));
const ProjectionPage = lazyWithReload(() => import("./pages/ProjectionPage"));
const PatrimonioPage = lazyWithReload(() => import("./pages/PatrimonioPage"));

inject();

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            {/* Suspense esterno: copre le rotte pubbliche lazy senza Layout
                (Register, ForgotPassword, ...). Per le rotte protette il
                Suspense interno in Layout è il boundary più vicino e cattura
                per primo, tenendo la navbar montata. */}
            <Suspense fallback={<LoadingSpinner size="lg" />}>
            <Routes>
            {/* Public Routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProfilePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/verify-email-change" element={<VerifyEmailChangePage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route index element={<LandingPage />} />
            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <DashboardPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CategoriesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/transactions"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TransactionsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/budgets"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Budgets />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/recurring"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RecurringTransactions />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/planned"
              element={
                <ProtectedRoute>
                  <Layout>
                    <PlannedTransactions />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CalendarPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/projection"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProjectionPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/patrimonio"
              element={
                <ProtectedRoute>
                  <Layout>
                    <PatrimonioPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/accounts"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AccountsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/accounts/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AccountDetailPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Redirect root to dashboard
            <Route path="/" element={<Navigate to="/dashboard" replace />} /> */}

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;

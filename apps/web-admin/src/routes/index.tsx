import { Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from '@cbt/ui';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { EmailVerifyPage } from '@/pages/EmailVerifyPage';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';
import { CertificateVerifyPage } from '@/pages/CertificateVerifyPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { UsersPage } from '@/pages/UsersPage';
import { RolesPage } from '@/pages/RolesPage';
import { QuestionBanksPage } from '@/pages/QuestionBanksPage';
import { QuestionBankDetailPage } from '@/pages/QuestionBankDetailPage';
import { QuestionFormPage } from '@/pages/QuestionFormPage';
import { ExamsPage } from '@/pages/ExamsPage';
import { ExamDetailPage } from '@/pages/ExamDetailPage';
import { ExamAnalyticsPage } from '@/pages/ExamAnalyticsPage';
import { QuestionReviewPage } from '@/pages/QuestionReviewPage';
import { ManualGradingPage } from '@/pages/ManualGradingPage';
import { TaxonomyPage } from '@/pages/TaxonomyPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { SessionDetailPage } from '@/pages/SessionDetailPage';
import { ResultsPage } from '@/pages/ResultsPage';
import { ResultDetailPage } from '@/pages/ResultDetailPage';
import { BillingPage } from '@/pages/BillingPage';
import { CatalogPage } from '@/pages/CatalogPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { SecurityPage } from '@/pages/SecurityPage';
import { SupportPage } from '@/pages/SupportPage';
import { SupportDetailPage } from '@/pages/SupportDetailPage';
import { SettingsPage } from '@/pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicOnlyRoute>
            <ResetPasswordPage />
          </PublicOnlyRoute>
        }
      />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="/verify-email" element={<EmailVerifyPage />} />
      <Route path="/certificates/verify" element={<CertificateVerifyPage />} />
      <Route path="/certificates/verify/:code" element={<CertificateVerifyPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="question-banks" element={<QuestionBanksPage />} />
        <Route path="question-banks/:id" element={<QuestionBankDetailPage />} />
        <Route path="questions/new" element={<QuestionFormPage />} />
        <Route path="questions/:id/edit" element={<QuestionFormPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="exams/:id" element={<ExamDetailPage />} />
        <Route path="exams/:id/analytics" element={<ExamAnalyticsPage />} />
        <Route path="reviews/questions" element={<QuestionReviewPage />} />
        <Route path="reviews/manual" element={<ManualGradingPage />} />
        <Route path="taxonomy" element={<TaxonomyPage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="sessions/:id" element={<SessionDetailPage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="results/:id" element={<ResultDetailPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="support/:id" element={<SupportDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

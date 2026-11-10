import { Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from '@cbt/ui';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/VerifyEmailPage';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';
import { CertificateVerifyPage } from '@/pages/CertificateVerifyPage';
import { ExamLobbyPage } from '@/pages/ExamLobbyPage';
import { ExamTakerPage } from '@/pages/ExamTakerPage';
import { ResultsPage } from '@/pages/ResultsPage';
import { ResultDetailPage } from '@/pages/ResultDetailPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SupportPage } from '@/pages/SupportPage';
import { SupportDetailPage } from '@/pages/SupportDetailPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { SecurityPage } from '@/pages/SecurityPage';

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

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="/certificates/verify" element={<CertificateVerifyPage />} />
      <Route path="/certificates/verify/:code" element={<CertificateVerifyPage />} />
      <Route
        path="/exam/:attemptId"
        element={
          <ProtectedRoute>
            <ExamTakerPage />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ExamLobbyPage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="results/:id" element={<ResultDetailPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="support/:id" element={<SupportDetailPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="security" element={<SecurityPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

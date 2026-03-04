import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FinanceProvider } from "@/contexts/FinanceContext";
import { DimensionsProvider } from "@/contexts/DimensionsContext";
import { AssetsProvider } from "@/contexts/AssetsContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { SubscriptionGuard } from "@/components/layout/SubscriptionGuard";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import CategoriesPage from "./pages/CategoriesPage";
import PersonsManagePage from "./pages/PersonsManagePage";
import ImportPage from "./pages/ImportPage";
import AdminPage from "./pages/AdminPage";
import AISettingsPage from "./pages/AISettingsPage";
import AssetsPage from "./pages/AssetsPage";
import DimensionsPage from "./pages/DimensionsPage";
import InsightsPage from "./pages/InsightsPage";
import AgendaPage from "./pages/AgendaPage";
import GoalsPage from "./pages/GoalsPage";
import EventsPage from "./pages/EventsPage";
import NotificationSettingsPage from "./pages/NotificationSettingsPage";
import Auth from "./pages/Auth";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import SettingsPage from "./pages/SettingsPage";
import PlansPage from "./pages/PlansPage";
import StartTrialPage from "./pages/StartTrialPage";
import SubscriptionSuccessPage from "./pages/SubscriptionSuccessPage";
import SubscriptionBlockedPage from "./pages/SubscriptionBlockedPage";
import SubscriptionManagePage from "./pages/SubscriptionManagePage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function ProtectedWithSubscription({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <SubscriptionGuard>{children}</SubscriptionGuard>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/esqueci-senha" element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route path="/plans" element={<PlansPage />} />
      <Route path="/start-trial" element={<StartTrialPage />} />

      {/* Subscription status pages (require auth but not active subscription) */}
      <Route path="/subscription/success" element={<ProtectedRoute><SubscriptionSuccessPage /></ProtectedRoute>} />
      <Route path="/subscription/blocked" element={<ProtectedRoute><SubscriptionBlockedPage /></ProtectedRoute>} />
      <Route path="/subscription/manage" element={<ProtectedRoute><SubscriptionManagePage /></ProtectedRoute>} />

      {/* Protected + Subscription required */}
      <Route path="/" element={<ProtectedWithSubscription><Dashboard /></ProtectedWithSubscription>} />
      <Route path="/alterar-senha" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
      <Route path="/insights" element={<ProtectedWithSubscription><InsightsPage /></ProtectedWithSubscription>} />
      <Route path="/transactions" element={<ProtectedWithSubscription><Transactions /></ProtectedWithSubscription>} />
      <Route path="/timeline" element={<Navigate to="/" replace />} />
      <Route path="/persons" element={<Navigate to="/" replace />} />
      <Route path="/table" element={<Navigate to="/transactions" replace />} />
      <Route path="/categories" element={<ProtectedWithSubscription><CategoriesPage /></ProtectedWithSubscription>} />
      <Route path="/persons-manage" element={<ProtectedWithSubscription><PersonsManagePage /></ProtectedWithSubscription>} />
      <Route path="/import" element={<ProtectedWithSubscription><ImportPage /></ProtectedWithSubscription>} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/ai-settings" element={<ProtectedWithSubscription><AISettingsPage /></ProtectedWithSubscription>} />
      <Route path="/dimensions" element={<ProtectedWithSubscription><DimensionsPage /></ProtectedWithSubscription>} />
      <Route path="/assets" element={<ProtectedWithSubscription><AssetsPage /></ProtectedWithSubscription>} />
      <Route path="/agenda" element={<ProtectedWithSubscription><AgendaPage /></ProtectedWithSubscription>} />
      <Route path="/goals" element={<ProtectedWithSubscription><GoalsPage /></ProtectedWithSubscription>} />
      <Route path="/events" element={<ProtectedWithSubscription><EventsPage /></ProtectedWithSubscription>} />
      <Route path="/auto-messages" element={<Navigate to="/notification-settings" replace />} />
      <Route path="/notification-settings" element={<Navigate to="/settings" replace />} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <SubscriptionProvider>
          <FinanceProvider>
            <DimensionsProvider>
              <AssetsProvider>
                <BrowserRouter>
                  <AppRoutes />
                </BrowserRouter>
              </AssetsProvider>
            </DimensionsProvider>
          </FinanceProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

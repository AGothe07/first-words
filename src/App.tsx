import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FinanceProvider } from "@/contexts/FinanceContext";
import { DimensionsProvider } from "@/contexts/DimensionsContext";
import { AssetsProvider } from "@/contexts/AssetsContext";
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
// AutoMessagesPage removed — functionality centralized in NotificationSettingsPage
import NotificationSettingsPage from "./pages/NotificationSettingsPage";
import Auth from "./pages/Auth";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
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

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/esqueci-senha" element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route path="/alterar-senha" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
      <Route path="/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      <Route path="/timeline" element={<Navigate to="/" replace />} />
      <Route path="/persons" element={<Navigate to="/" replace />} />
      <Route path="/table" element={<Navigate to="/transactions" replace />} />
      <Route path="/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
      <Route path="/persons-manage" element={<ProtectedRoute><PersonsManagePage /></ProtectedRoute>} />
      <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/ai-settings" element={<ProtectedRoute><AISettingsPage /></ProtectedRoute>} />
      <Route path="/dimensions" element={<ProtectedRoute><DimensionsPage /></ProtectedRoute>} />
      <Route path="/assets" element={<ProtectedRoute><AssetsPage /></ProtectedRoute>} />
      <Route path="/agenda" element={<ProtectedRoute><AgendaPage /></ProtectedRoute>} />
      <Route path="/goals" element={<ProtectedRoute><GoalsPage /></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
      <Route path="/auto-messages" element={<Navigate to="/notification-settings" replace />} />
      <Route path="/notification-settings" element={<ProtectedRoute><NotificationSettingsPage /></ProtectedRoute>} />
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
        <FinanceProvider>
          <DimensionsProvider>
            <AssetsProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </AssetsProvider>
          </DimensionsProvider>
        </FinanceProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

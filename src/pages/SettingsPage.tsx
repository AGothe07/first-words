import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { AccountSection } from "@/components/settings/AccountSection";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import { FinancialSection } from "@/components/settings/FinancialSection";
import { GoalsSection } from "@/components/settings/GoalsSection";
import { AgendaSection } from "@/components/settings/AgendaSection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { AdvancedSection } from "@/components/settings/AdvancedSection";
import { FamilyModeSection } from "@/components/settings/FamilyModeSection";
import { Settings, User, Bell, DollarSign, Target, CalendarDays, Palette, Shield, Settings2, Users, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { preferences, loading, updatePreferences } = useUserPreferences();

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" /> Configurações
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie sua conta, preferências e configurações do sistema</p>
        </div>

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="account" className="gap-1.5 text-xs">
              <User className="h-3.5 w-3.5" /> Conta
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 text-xs">
              <Bell className="h-3.5 w-3.5" /> Notificações
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-1.5 text-xs">
              <DollarSign className="h-3.5 w-3.5" /> Finanças
            </TabsTrigger>
            <TabsTrigger value="goals" className="gap-1.5 text-xs">
              <Target className="h-3.5 w-3.5" /> Metas
            </TabsTrigger>
            <TabsTrigger value="agenda" className="gap-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5" /> Agenda
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1.5 text-xs">
              <Palette className="h-3.5 w-3.5" /> Aparência
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs">
              <Shield className="h-3.5 w-3.5" /> Segurança
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" /> Avançado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-4">
            <AccountSection />
          </TabsContent>
          <TabsContent value="notifications" className="mt-4">
            <NotificationsSection preferences={preferences} onUpdate={updatePreferences} />
          </TabsContent>
          <TabsContent value="financial" className="mt-4">
            <FinancialSection preferences={preferences} onUpdate={updatePreferences} />
          </TabsContent>
          <TabsContent value="goals" className="mt-4">
            <GoalsSection preferences={preferences} onUpdate={updatePreferences} />
          </TabsContent>
          <TabsContent value="agenda" className="mt-4">
            <AgendaSection preferences={preferences} onUpdate={updatePreferences} />
          </TabsContent>
          <TabsContent value="appearance" className="mt-4">
            <AppearanceSection preferences={preferences} onUpdate={updatePreferences} />
          </TabsContent>
          <TabsContent value="security" className="mt-4">
            <SecuritySection preferences={preferences} onUpdate={updatePreferences} />
          </TabsContent>
          <TabsContent value="advanced" className="mt-4">
            <AdvancedSection preferences={preferences} onUpdate={updatePreferences} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

import React, { useState } from "react";
import { createDrawerNavigator, DrawerContentScrollView, DrawerContentComponentProps } from "@react-navigation/drawer";
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from "react-native";
import { colors } from "@/theme/colors";
import { useAuth } from "@/contexts/AuthContext";

import DashboardScreen from "@/screens/DashboardScreen";
import TransactionsScreen from "@/screens/TransactionsScreen";
import GoalsScreen from "@/screens/GoalsScreen";
import CategoriesScreen from "@/screens/CategoriesScreen";
import PersonsScreen from "@/screens/PersonsScreen";
import BudgetScreen from "@/screens/BudgetScreen";
import DebtsScreen from "@/screens/DebtsScreen";
import AssetsScreen from "@/screens/AssetsScreen";
import InvestmentsScreen from "@/screens/InvestmentsScreen";
import AgendaScreen from "@/screens/AgendaScreen";
import EventsScreen from "@/screens/EventsScreen";
import RecurringScreen from "@/screens/RecurringScreen";
import InsightsScreen from "@/screens/InsightsScreen";
import FinancialScoreScreen from "@/screens/FinancialScoreScreen";
import SettingsScreen from "@/screens/SettingsScreen";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface NavItem {
  label: string;
  icon: string;
  screen: string;
}

interface ModuleGroup {
  id: string;
  title: string;
  icon: string;
  items: NavItem[];
  subItems?: { label: string; items: NavItem[] };
}

const modules: ModuleGroup[] = [
  {
    id: "financas",
    title: "Finanças",
    icon: "💰",
    items: [
      { label: "Dashboard", icon: "📊", screen: "Dashboard" },
      { label: "Insights", icon: "💡", screen: "Insights" },
      { label: "Saúde Financeira", icon: "❤️", screen: "ScoreFinanceiro" },
      { label: "Patrimônio", icon: "🏠", screen: "Patrimônio" },
      { label: "Investimentos", icon: "📈", screen: "Investimentos" },
      { label: "Lançamentos", icon: "↔️", screen: "Lançamentos" },
      { label: "Recorrentes", icon: "🔄", screen: "Recorrentes" },
      { label: "Orçamento", icon: "🐷", screen: "Orçamento" },
      { label: "Dívidas", icon: "🏦", screen: "Dívidas" },
    ],
    subItems: {
      label: "CADASTROS",
      items: [
        { label: "Categorias", icon: "📂", screen: "Categorias" },
        { label: "Pessoas", icon: "👥", screen: "Pessoas" },
      ],
    },
  },
  {
    id: "agenda",
    title: "Agenda",
    icon: "📅",
    items: [{ label: "Meus Compromissos", icon: "📅", screen: "Agenda" }],
  },
  {
    id: "metas",
    title: "Metas",
    icon: "🎯",
    items: [{ label: "Minhas Metas", icon: "🎯", screen: "Metas" }],
  },
  {
    id: "eventos",
    title: "Eventos",
    icon: "🎉",
    items: [{ label: "Datas Importantes", icon: "🎂", screen: "DatasImportantes" }],
  },
  {
    id: "config",
    title: "Configurações",
    icon: "⚙️",
    items: [{ label: "Configurações", icon: "⚙️", screen: "Configurações" }],
  },
];

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { navigation, state } = props;
  const { signOut, user } = useAuth();
  const activeRoute = state.routes[state.index]?.name;

  // Find which module contains the active route
  const activeModuleId = modules.find(m =>
    m.items.some(i => i.screen === activeRoute) ||
    m.subItems?.items.some(i => i.screen === activeRoute)
  )?.id || null;

  const [expandedModule, setExpandedModule] = useState<string | null>(activeModuleId);

  const toggleModule = (moduleId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedModule(prev => prev === moduleId ? null : moduleId);
  };

  return (
    <DrawerContentScrollView {...props} style={styles.drawer} contentContainerStyle={{ paddingTop: 0 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚀 LifeHub</Text>
        <Text style={styles.headerSubtitle}>Seu Agente Pessoal</Text>
      </View>

      {/* Module groups - accordion */}
      {modules.map((mod) => {
        const isExpanded = expandedModule === mod.id;
        const hasActiveItem = mod.items.some(i => i.screen === activeRoute) ||
          mod.subItems?.items.some(i => i.screen === activeRoute);

        return (
          <View key={mod.id} style={styles.moduleGroup}>
            {/* Module header - clickable to expand/collapse */}
            <TouchableOpacity
              style={[styles.moduleHeader, hasActiveItem && styles.moduleHeaderActive]}
              onPress={() => toggleModule(mod.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.moduleIcon}>{mod.icon}</Text>
              <Text style={[styles.moduleTitle, hasActiveItem && styles.moduleTitleActive]}>
                {mod.title}
              </Text>
              <Text style={[styles.chevron, isExpanded && styles.chevronExpanded]}>
                {isExpanded ? "▾" : "▸"}
              </Text>
            </TouchableOpacity>

            {/* Expanded items */}
            {isExpanded && (
              <View style={styles.itemsContainer}>
                {mod.items.map((item) => {
                  const isActive = activeRoute === item.screen;
                  return (
                    <TouchableOpacity
                      key={item.screen}
                      style={[styles.navItem, isActive && styles.navItemActive]}
                      onPress={() => navigation.navigate(item.screen)}
                    >
                      {isActive && <View style={styles.activeIndicator} />}
                      <Text style={styles.navIcon}>{item.icon}</Text>
                      <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {mod.subItems && mod.subItems.items.length > 0 && (
                  <View style={styles.subSection}>
                    <Text style={styles.subSectionLabel}>{mod.subItems.label}</Text>
                    {mod.subItems.items.map((item) => {
                      const isActive = activeRoute === item.screen;
                      return (
                        <TouchableOpacity
                          key={item.screen}
                          style={[styles.navItem, styles.subNavItem, isActive && styles.navItemActive]}
                          onPress={() => navigation.navigate(item.screen)}
                        >
                          <Text style={[styles.navIcon, { fontSize: 14 }]}>{item.icon}</Text>
                          <Text style={[styles.navLabel, styles.subNavLabel, isActive && styles.navLabelActive]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerEmail} numberOfLines={1}>{user?.email}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <Text style={styles.logoutText}>🚪 Sair</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

const Drawer = createDrawerNavigator();

export default function AppNavigator() {
  return (
    <Drawer.Navigator
      id="main-drawer"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontSize: 16, fontWeight: "600", color: colors.text },
        drawerType: "front",
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Dashboard" }} />
      <Drawer.Screen name="Insights" component={InsightsScreen} options={{ title: "Insights" }} />
      <Drawer.Screen name="ScoreFinanceiro" component={FinancialScoreScreen} options={{ title: "Saúde Financeira" }} />
      <Drawer.Screen name="Patrimônio" component={AssetsScreen} options={{ title: "Patrimônio" }} />
      <Drawer.Screen name="Investimentos" component={InvestmentsScreen} options={{ title: "Investimentos" }} />
      <Drawer.Screen name="Lançamentos" component={TransactionsScreen} options={{ title: "Lançamentos" }} />
      <Drawer.Screen name="Recorrentes" component={RecurringScreen} options={{ title: "Recorrentes" }} />
      <Drawer.Screen name="Orçamento" component={BudgetScreen} options={{ title: "Orçamento" }} />
      <Drawer.Screen name="Dívidas" component={DebtsScreen} options={{ title: "Dívidas" }} />
      <Drawer.Screen name="Categorias" component={CategoriesScreen} options={{ title: "Categorias" }} />
      <Drawer.Screen name="Pessoas" component={PersonsScreen} options={{ title: "Pessoas" }} />
      <Drawer.Screen name="Agenda" component={AgendaScreen} options={{ title: "Agenda" }} />
      <Drawer.Screen name="Metas" component={GoalsScreen} options={{ title: "Metas" }} />
      <Drawer.Screen name="DatasImportantes" component={EventsScreen} options={{ title: "Datas Importantes" }} />
      <Drawer.Screen name="Configurações" component={SettingsScreen} options={{ title: "Configurações" }} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  moduleGroup: {
    marginBottom: 2,
    paddingHorizontal: 8,
  },
  moduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 2,
    borderRadius: 10,
  },
  moduleHeaderActive: {
    backgroundColor: `${colors.primary}08`,
  },
  moduleIcon: {
    fontSize: 18,
  },
  moduleTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },
  moduleTitleActive: {
    color: colors.primary,
  },
  chevron: {
    fontSize: 12,
    color: colors.textMuted,
  },
  chevronExpanded: {
    color: colors.primary,
  },
  itemsContainer: {
    paddingLeft: 8,
    paddingBottom: 4,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 10,
    gap: 10,
    position: "relative",
  },
  navItemActive: {
    backgroundColor: `${colors.primary}15`,
  },
  navIcon: {
    fontSize: 16,
    width: 24,
    textAlign: "center",
  },
  navLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  activeIndicator: {
    position: "absolute",
    left: 0,
    top: "50%",
    marginTop: -8,
    width: 3,
    height: 16,
    backgroundColor: colors.primary,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  subSection: {
    marginLeft: 24,
    marginTop: 2,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: `${colors.border}80`,
  },
  subSectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: colors.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  subNavItem: {
    paddingVertical: 8,
  },
  subNavLabel: {
    fontSize: 13,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    marginTop: 8,
  },
  footerEmail: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 8,
  },
  logoutBtn: {
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
});

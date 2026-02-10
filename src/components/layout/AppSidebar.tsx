import { LayoutDashboard, ArrowLeftRight, Tags, UserCog, LogOut, FileUp } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Lançamentos", url: "/transactions", icon: ArrowLeftRight },
];

const settingsItems = [
  { title: "Categorias", url: "/categories", icon: Tags },
  { title: "Pessoas", url: "/persons-manage", icon: UserCog },
  { title: "Importar Dados", url: "/import", icon: FileUp },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <Sidebar className="border-r border-border">
      <div className="p-4 pb-2">
        <h1 className="text-lg font-bold text-primary tracking-tight">💰 FinanceHub</h1>
        <p className="text-xs text-muted-foreground">Gestão Financeira Pessoal</p>
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground truncate mb-1">{user?.email}</p>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" onClick={signOut}>
          <LogOut className="h-3 w-3" /> Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

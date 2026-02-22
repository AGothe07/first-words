import {
  LayoutDashboard, ArrowLeftRight, Tags, UserCog, LogOut, FileUp,
  ShieldAlert, Bot, Landmark, Sliders, Lightbulb, CalendarDays,
  Target, PartyPopper, MessageSquareHeart, ChevronRight, Wallet
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

type NavItem = { title: string; url: string; icon: React.ElementType };

interface ModuleConfig {
  label: string;
  icon: React.ElementType;
  mainItems: NavItem[];
  subItems?: NavItem[];
}

const modules: ModuleConfig[] = [
  {
    label: "Finanças",
    icon: Wallet,
    mainItems: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Insights", url: "/insights", icon: Lightbulb },
      { title: "Patrimônio", url: "/assets", icon: Landmark },
      { title: "Lançamentos", url: "/transactions", icon: ArrowLeftRight },
    ],
    subItems: [
      { title: "Categorias", url: "/categories", icon: Tags },
      { title: "Pessoas", url: "/persons-manage", icon: UserCog },
      { title: "Dimensões", url: "/dimensions", icon: Sliders },
      { title: "Importar Dados", url: "/import", icon: FileUp },
    ],
  },
  {
    label: "Agenda",
    icon: CalendarDays,
    mainItems: [{ title: "Meus Compromissos", url: "/agenda", icon: CalendarDays }],
  },
  {
    label: "Metas",
    icon: Target,
    mainItems: [{ title: "Minhas Metas", url: "/goals", icon: Target }],
  },
  {
    label: "Eventos",
    icon: PartyPopper,
    mainItems: [
      { title: "Datas Importantes", url: "/events", icon: PartyPopper },
      { title: "Mensagens Automáticas", url: "/auto-messages", icon: MessageSquareHeart },
    ],
  },
];

function ModuleGroup({ config, isOpen, onToggle }: { config: ModuleConfig; isOpen: boolean; onToggle: () => void }) {
  const location = useLocation();
  const allUrls = [...config.mainItems, ...(config.subItems || [])].map(i => i.url);
  const isModuleActive = allUrls.includes(location.pathname);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className={cn(
        "mx-2 rounded-xl transition-all duration-200 mb-1.5",
        isModuleActive
          ? "bg-primary/10 border border-primary/25 shadow-sm"
          : "border border-transparent hover:bg-sidebar-accent/50"
      )}>
        {/* Module header — strong visual identity */}
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-3 rounded-xl transition-colors group cursor-pointer">
          <span className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200",
              isModuleActive
                ? "bg-primary/20 text-primary shadow-sm"
                : "bg-sidebar-accent text-sidebar-foreground/50 group-hover:text-sidebar-foreground group-hover:bg-sidebar-accent/80"
            )}>
              <config.icon className="h-5 w-5" />
            </div>
            <span className={cn(
              "text-[13px] font-bold uppercase tracking-wide transition-colors",
              isModuleActive ? "text-primary" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground"
            )}>
              {config.label}
            </span>
          </span>
          <ChevronRight className={cn(
            "h-3.5 w-3.5 text-sidebar-foreground/30 transition-transform duration-200",
            isOpen && "rotate-90"
          )} />
        </CollapsibleTrigger>

        {/* Expanded content — pages with subordinate styling */}
        <CollapsibleContent>
          <div className="px-2 pb-2 pt-0.5">
            <div className="border-l-2 border-primary/15 ml-[18px] pl-0">
              <SidebarMenu>
                {config.mainItems.map(item => {
                  const active = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active}>
                        <NavLink to={item.url} className={cn(
                          "relative ml-3 gap-2.5 py-1.5 text-[13px] rounded-md transition-colors",
                          active
                            ? "text-primary font-semibold bg-primary/8"
                            : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                        )}>
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                          {active && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r-full" />
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>

              {/* Sub-items (cadastros) — even more subordinate */}
              {config.subItems && config.subItems.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-sidebar-foreground/8">
                  <span className="ml-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">
                    Cadastros
                  </span>
                  <SidebarMenu className="mt-1">
                    {config.subItems.map(item => {
                      const active = location.pathname === item.url;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={active}>
                            <NavLink to={item.url} className={cn(
                              "ml-3 gap-2.5 py-1 text-[12px] rounded-md transition-colors",
                              active
                                ? "text-primary font-medium bg-primary/8"
                                : "text-sidebar-foreground/50 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/30"
                            )}>
                              <item.icon className="h-3.5 w-3.5 shrink-0" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);

  // Toggle accordion: click open module → close it; click different → switch
  const [openModule, setOpenModule] = useState<string | null>(() => {
    for (const m of modules) {
      const allUrls = [...m.mainItems, ...(m.subItems || [])].map(i => i.url);
      if (allUrls.includes(window.location.pathname)) return m.label;
    }
    return null;
  });

  const handleToggle = (label: string) => {
    setOpenModule(prev => prev === label ? null : label);
  };

  // Preserve scroll position on route change
  useEffect(() => {
    const el = contentRef.current?.closest('[data-sidebar="content"]');
    if (!el) return;
    const handler = () => { scrollPosRef.current = el.scrollTop; };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const el = contentRef.current?.closest('[data-sidebar="content"]');
    if (el) {
      requestAnimationFrame(() => { el.scrollTop = scrollPosRef.current; });
    }
  }, [location.pathname]);

  return (
    <Sidebar className="border-r border-border">
      <div className="p-4 pb-3">
        <h1 className="text-lg font-bold text-primary tracking-tight">🚀 LifeHub</h1>
        <p className="text-[11px] text-muted-foreground">Seu Agente Pessoal</p>
      </div>
      <SidebarContent>
        <div ref={contentRef} className="space-y-0.5 py-1">
          {modules.map(m => (
            <ModuleGroup
              key={m.label}
              config={m}
              isOpen={openModule === m.label}
              onToggle={() => handleToggle(m.label)}
            />
          ))}

          {/* IA standalone — same module-level styling */}
          <div className={cn(
            "mx-2 rounded-xl transition-all duration-200 mb-1.5",
            location.pathname === "/ai-settings"
              ? "bg-primary/10 border border-primary/25 shadow-sm"
              : "border border-transparent hover:bg-sidebar-accent/50"
          )}>
            <NavLink to="/ai-settings" className="flex items-center gap-3 px-3 py-3" onClick={() => setOpenModule(null)}>
              <div className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200",
                location.pathname === "/ai-settings"
                  ? "bg-primary/20 text-primary shadow-sm"
                  : "bg-sidebar-accent text-sidebar-foreground/50"
              )}>
                <Bot className="h-5 w-5" />
              </div>
              <span className={cn(
                "text-[13px] font-bold uppercase tracking-wide",
                location.pathname === "/ai-settings" ? "text-primary" : "text-sidebar-foreground/55"
              )}>IA Conversacional</span>
            </NavLink>
          </div>

          {isAdmin && (
            <div className={cn(
              "mx-2 rounded-xl transition-all duration-200 mb-1.5",
              location.pathname === "/admin"
                ? "bg-destructive/10 border border-destructive/25 shadow-sm"
                : "border border-transparent hover:bg-sidebar-accent/50"
            )}>
              <NavLink to="/admin" className="flex items-center gap-3 px-3 py-3" onClick={() => setOpenModule(null)}>
                <div className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200",
                  location.pathname === "/admin"
                    ? "bg-destructive/20 text-destructive shadow-sm"
                    : "bg-sidebar-accent text-sidebar-foreground/50"
                )}>
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-[13px] font-bold uppercase tracking-wide",
                  location.pathname === "/admin" ? "text-destructive" : "text-sidebar-foreground/55"
                )}>Painel Admin</span>
              </NavLink>
            </div>
          )}
        </div>
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

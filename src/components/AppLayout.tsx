import { Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/providers/trpc";
import { useTheme } from "./theme-provider";
import ComposeEmail from "./ComposeEmail";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  ShieldAlert,
  Archive,
  Star,
  Settings,
  Globe,
  Mail,
  Search,
  Plus,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Shield,
} from "lucide-react";

function SidebarItem({
  icon: Icon,
  label,
  to: _to,
  count,
  isActive,
  onClick,
}: {
  icon: typeof Inbox;
  label: string;
  to: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
        isActive
          ? "bg-primary/10 text-primary dark:bg-primary/20"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth({ redirectOnUnauthenticated: true });
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats } = trpc.email.stats.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate("/?search=" + encodeURIComponent(searchQuery.trim()));
    }
  };

  const navItems = [
    { icon: Inbox, label: "Inbox", to: "/inbox", count: stats?.unread },
    { icon: Star, label: "Starred", to: "/starred", count: stats?.starred },
    { icon: Send, label: "Sent", to: "/sent" },
    { icon: FileText, label: "Drafts", to: "/drafts", count: stats?.drafts },
    { icon: Archive, label: "Archive", to: "/archive" },
    { icon: Trash2, label: "Trash", to: "/trash", count: stats?.trash },
    { icon: ShieldAlert, label: "Spam", to: "/spam", count: stats?.spam },
  ];

  const settingsItems = [
    { icon: Globe, label: "Domains", to: "/domains" },
    { icon: Mail, label: "Mailboxes", to: "/mailboxes" },
    { icon: Settings, label: "Settings", to: "/settings" },
  ];

  const isActive = (path: string) => {
    if (path === "/inbox" && location.pathname === "/") return true;
    return location.pathname === path;
  };

  if (!user) return null;

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
          <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
            <Mail className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg tracking-tight">MailVault</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden h-8 w-8"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 py-2">
          {/* Compose Button */}
          <div className="px-3 mb-4">
            <Button
              className="w-full gap-2"
              onClick={() => setComposeOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Compose
            </Button>
          </div>

          {/* Main Navigation */}
          <div className="px-3 space-y-0.5">
            {navItems.map((item) => (
              <SidebarItem
                key={item.to}
                {...item}
                isActive={isActive(item.to)}
                onClick={() => {
                  navigate(item.to);
                  setSidebarOpen(false);
                }}
              />
            ))}
          </div>

          <Separator className="my-3 mx-3 w-auto" />

          {/* Settings Navigation */}
          <div className="px-3 space-y-0.5">
            {settingsItems.map((item) => (
              <SidebarItem
                key={item.to}
                {...item}
                isActive={isActive(item.to)}
                onClick={() => {
                  navigate(item.to);
                  setSidebarOpen(false);
                }}
              />
            ))}
          </div>

          {isAdmin && (
            <>
              <Separator className="my-3 mx-3 w-auto" />
              <div className="px-3 space-y-0.5">
                <SidebarItem
                  icon={Shield}
                  label="Admin"
                  to="/admin"
                  isActive={isActive("/admin")}
                  onClick={() => {
                    navigate("/admin");
                    setSidebarOpen(false);
                  }}
                />
              </div>
            </>
          )}
        </ScrollArea>

        {/* User Section */}
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">
              {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name || user.email}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 border-b border-border flex items-center gap-3 px-4 shrink-0 bg-card/50 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search emails..."
                className="pl-9 h-9 bg-muted/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>

          <div className="flex items-center gap-2 ml-auto">
            {stats && stats.unread > 0 && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full font-medium">
                {stats.unread} unread
              </span>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>

      {/* Compose Modal */}
      <ComposeEmail open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}

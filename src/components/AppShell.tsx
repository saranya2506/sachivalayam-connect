import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth, type AppRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell,
  LogOut,
  ShieldCheck,
  Users,
  FileText,
  BarChart3,
  FilePlus2,
  UserCog,
  ScrollText,
  LayoutDashboard,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: Record<AppRole, NavItem[]> = {
  citizen: [
    { to: "/citizen", label: "Dashboard", icon: LayoutDashboard },
    { to: "/citizen/new", label: "New Complaint", icon: FilePlus2 },
    { to: "/citizen/services", label: "Government Services", icon: FileCheck },
    { to: "/profile", label: "Profile", icon: UserCog },
  ],
  officer: [
    { to: "/officer", label: "Dashboard", icon: LayoutDashboard },
    { to: "/officer/applications", label: "Service Applications", icon: FileCheck },
    { to: "/profile", label: "Profile", icon: UserCog },
  ],
  admin: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/complaints", label: "Complaints", icon: FileText },
    { to: "/admin/applications", label: "Service Applications", icon: FileCheck },
    { to: "/admin/officers", label: "Officers", icon: Users },
    { to: "/profile", label: "Profile", icon: UserCog },
  ],
  government_authority: [
    { to: "/authority", label: "Dashboard", icon: LayoutDashboard },
    { to: "/authority/admin-requests", label: "Admin Requests", icon: ShieldCheck },
    { to: "/authority/applications", label: "Service Applications", icon: FileCheck },
    { to: "/authority/complaints", label: "All Complaints", icon: FileText },
    { to: "/authority/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/authority/audit-logs", label: "Audit Logs", icon: ScrollText },
    { to: "/profile", label: "Profile", icon: UserCog },
  ],
};

const ROLE_LABEL: Record<AppRole, string> = {
  government_authority: "Government Authority",
  admin: "Sachivalayam Admin",
  officer: "Officer",
  citizen: "Citizen",
};

function NotificationBell({ userId }: { userId: string }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<
    Array<{
      id: string;
      title: string;
      body: string | null;
      link: string | null;
      read: boolean;
      created_at: string;
    }>
  >([]);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data ?? []);
    setCount((data ?? []).filter((n) => !n.read).length);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t); /* eslint-disable-next-line */
  }, [userId]);

  const markAllRead = async () => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    load();
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) markAllRead();
        }}
        className="relative rounded-full p-2 hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border bg-popover shadow-lg">
          <div className="border-b p-3 font-semibold text-sm">Notifications</div>
          <div className="max-h-96 overflow-auto">
            {items.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No notifications yet.</div>
            )}
            {items.map((n) => (
              <div key={n.id} className="border-b p-3 text-sm last:border-b-0">
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="text-muted-foreground">{n.body}</div>}
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = role ? NAV[role] : [];

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-accent text-accent-foreground font-bold">
              ఎస్
            </div>
            <div>
              <div className="text-base font-bold leading-tight">Digital Sachivalayam</div>
              <div className="text-xs text-sidebar-foreground/70">Grievance Portal</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((it) => {
            const isIndex = /^\/(citizen|admin|officer|authority)\/?$/.test(it.to);
            const active = isIndex
              ? pathname === it.to || pathname === it.to + "/"
              : pathname === it.to || pathname.startsWith(it.to + "/");
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-xs text-sidebar-foreground/70">
          {role && (
            <div className="mb-1 font-semibold uppercase tracking-wide text-sidebar-foreground/60">
              {ROLE_LABEL[role]}
            </div>
          )}
          {user?.email}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
          <div className="md:hidden font-bold">Sachivalayam</div>
          <div className="hidden md:block text-sm text-muted-foreground">
            {role ? ROLE_LABEL[role] : ""} · Government of Andhra Pradesh
          </div>
          <div className="flex items-center gap-3">
            {user && <NotificationBell userId={user.id} />}
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-2 md:hidden">
          {items.map((it) => {
            const active = pathname === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    submitted: "bg-muted text-foreground",
    assigned: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
    under_review: "bg-amber-100 text-amber-900",
    in_progress: "bg-indigo-100 text-indigo-900",
    resolved: "bg-emerald-100 text-emerald-900",
    rejected: "bg-red-100 text-red-900",
    pending: "bg-amber-100 text-amber-900",
    approved: "bg-emerald-100 text-emerald-900",
    completed: "bg-teal-100 text-teal-900",
    uploaded: "bg-blue-100 text-blue-900",
    verified: "bg-emerald-100 text-emerald-900",
    documents_required: "bg-orange-100 text-orange-900",
    under_verification: "bg-purple-100 text-purple-900",
    archived: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        cls[status] ?? "bg-muted",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

import { useAuth, AppRole } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  ClipboardList,
  CalendarCheck,
  Banknote,
  AlertTriangle,
  CalendarDays,
  DollarSign,
  FileText,
  TrendingUp,
  Package,
  ShoppingCart,
  Beaker,
  Send,
  Megaphone,
  UserCircle,
  LogOut,
  BarChart3,
  Menu,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItem {
  to: string;
  icon: any;
  label: string;
  roles: AppRole[];
}

interface NavGroup {
  label: string;
  icon: any;
  roles: AppRole[];
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Dashboard',
    icon: BarChart3,
    roles: ['management'],
    items: [
      { to: '/dashboard', icon: BarChart3, label: 'Dashboard Analytics', roles: ['management'] },
    ],
  },
  {
    label: 'Personalia',
    icon: Users,
    roles: ['management', 'pic', 'crew', 'stockman', 'staff'],
    items: [
      { to: '/personalia/staff', icon: Users, label: 'Data Karyawan', roles: ['management', 'pic'] },
      { to: '/personalia/performance', icon: ClipboardList, label: 'Penilaian Kinerja', roles: ['management', 'pic'] },
      { to: '/personalia/attendance', icon: CalendarCheck, label: 'Rekapan Absensi', roles: ['management', 'pic'] },
      { to: '/personalia/cashbon', icon: Banknote, label: 'Cashbon', roles: ['management', 'pic', 'crew', 'stockman', 'staff'] },
      { to: '/personalia/punishment', icon: AlertTriangle, label: 'Punishment & SP', roles: ['management', 'pic'] },
      { to: '/personalia/leave', icon: CalendarDays, label: 'Verifikasi Cuti', roles: ['management', 'pic'] },
      { to: '/personalia/payroll', icon: DollarSign, label: 'Payroll', roles: ['management', 'pic'] },
      { to: '/personalia/roles', icon: ShieldCheck, label: 'Kelola Role & Akses', roles: ['management'] },
      { to: '/profile', icon: UserCircle, label: 'Profil Saya', roles: ['management', 'pic', 'crew', 'stockman', 'staff'] },
    ],
  },
  {
    label: 'Finance',
    icon: TrendingUp,
    roles: ['management', 'pic'],
    items: [
      { to: '/finance/daily-recap', icon: FileText, label: 'Rekapan Laporan Harian', roles: ['management', 'pic'] },
      { to: '/finance/profit-loss', icon: TrendingUp, label: 'Laporan Laba Rugi', roles: ['management', 'pic'] },
    ],
  },
  {
    label: 'Stok & Inventaris',
    icon: Package,
    roles: ['management', 'pic', 'stockman', 'staff'],
    items: [
      { to: '/inventory/daily-stock', icon: Package, label: 'Input Stok Harian', roles: ['management', 'pic', 'stockman', 'staff'] },
      { to: '/inventory/shopping-list', icon: ShoppingCart, label: 'Rekomendasi Belanja', roles: ['management', 'pic', 'stockman'] },
      { to: '/inventory/material-control', icon: Beaker, label: 'Kontrol Bahan Baku', roles: ['management', 'pic', 'stockman'] },
    ],
  },
  {
    label: 'Laporan Harian',
    icon: Send,
    roles: ['management', 'pic', 'crew', 'stockman', 'staff'],
    items: [
      { to: '/daily-report', icon: Send, label: 'Input Laporan Closing', roles: ['management', 'pic', 'crew', 'stockman', 'staff'] },
    ],
  },
  {
    label: 'Marketing',
    icon: Megaphone,
    roles: ['management', 'pic'],
    items: [
      { to: '/marketing/content-plan', icon: Megaphone, label: 'Content Plan', roles: ['management', 'pic'] },
    ],
  },
];

export default function AppSidebar() {
  const { role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const visibleGroups = navGroups
    .filter((g) => role && g.roles.includes(role))
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => role && item.roles.includes(role)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-primary text-primary-foreground shadow-lg"
        onClick={() => setOpen(!open)}
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 bg-foreground/20 z-40 md:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 md:translate-x-0 overflow-y-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 border-b border-sidebar-border text-black bg-black">
          <h1 className="text-xl font-bold text-primary-foreground font-sans">
            Dua Legenda
          </h1>
          <p className="text-xs text-sidebar-foreground/60 mt-1">Business Management</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {visibleGroups.map((group) => {
            const isGroupActive = group.items.some((item) => location.pathname === item.to);

            if (group.items.length === 1) {
              const item = group.items[0];
              const active = location.pathname === item.to;
              return (
                <button
                  key={item.to}
                  onClick={() => { navigate(item.to); setOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <group.icon className="w-4 h-4" />
                  {group.label}
                </button>
              );
            }

            return (
              <Collapsible key={group.label} defaultOpen={isGroupActive}>
                <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">
                  <span className="flex items-center gap-3">
                    <group.icon className="w-4 h-4" />
                    {group.label}
                  </span>
                  <ChevronDown className="w-3 h-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-4 pl-3 border-l border-sidebar-border/50 space-y-0.5 mt-1">
                    {group.items.map((item) => {
                      const active = location.pathname === item.to;
                      return (
                        <button
                          key={item.to}
                          onClick={() => { navigate(item.to); setOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors',
                            active
                              ? 'bg-sidebar-accent text-sidebar-primary'
                              : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground'
                          )}
                        >
                          <item.icon className="w-3.5 h-3.5" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
            onClick={signOut}
          >
            <LogOut className="w-5 h-5" />
            Keluar
          </Button>
        </div>
      </aside>
    </>
  );
}

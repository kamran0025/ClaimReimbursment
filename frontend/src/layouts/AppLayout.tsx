import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '@/app/AuthContext';
import { NAV_BY_ROLE, ROLE_LABEL } from './navConfig';
import type { NavItem } from './navConfig';
import { Button } from '@/components/ui/Button';

/** Role-specific shell: sidebar nav (per plan.md §22 `layouts/`) + top bar. */
export function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;
  const navItems = NAV_BY_ROLE[user.role];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <SidebarContent navItems={navItems} appLabel={ROLE_LABEL[user.role]} />
      </aside>

      {/* Sidebar (mobile) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex w-64 flex-col bg-white shadow-xl">
            <SidebarContent navItems={navItems} appLabel={ROLE_LABEL[user.role]} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {user.name.charAt(0)}
            </div>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Log out
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  navItems,
  appLabel,
  onNavigate,
}: {
  navItems: NavItem[];
  appLabel: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">EC</div>
        <div>
          <p className="text-sm font-semibold leading-none text-slate-900">ExpenseClaims</p>
          <p className="text-[11px] text-slate-400">{appLabel} portal</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

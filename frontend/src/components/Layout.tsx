import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface NavItem {
  label: string;
  to: string;
}

const staffNav: NavItem[] = [
  { label: "Dashboard", to: "/admin" },
  { label: "Students", to: "/students" },
  { label: "Batches", to: "/batches" },
  { label: "Attendance", to: "/attendance" },
  { label: "Notes", to: "/notes" },
  { label: "Fees", to: "/fees" },
];

const studentNav: NavItem[] = [{ label: "Dashboard", to: "/student" }];

export function Layout() {
  const { user, logout } = useAuth();
  const navItems = user?.role === "STUDENT" ? studentNav : staffNav;

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-mist to-cream">
      <header className="sticky top-0 z-30 border-b border-sand bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="font-display text-xl text-charcoal sm:text-2xl">Coaching Management System</h1>
            <p className="text-xs text-charcoal/70">Operations console for coaching institutes</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-sand bg-mist px-3 py-2 text-xs text-charcoal">
              <p className="font-semibold">{user?.full_name}</p>
              <p>{user?.role}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-charcoal px-3 py-2 text-xs font-semibold text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-sand bg-white p-3 shadow-card">
          <nav className="grid gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold ${
                    isActive ? "bg-bronze text-white" : "text-charcoal hover:bg-mist"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="rounded-2xl border border-sand bg-white p-4 shadow-card sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


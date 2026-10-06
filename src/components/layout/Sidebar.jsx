import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Camera,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import BrandMark from "./BrandMark";

const navItems = [
  {
    path: "/",
    icon: Camera,
    label: "Live Monitor",
    description: "Monitor compliance in real-time",
  },
  {
    path: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    description: "Overview and analytics",
  },
  {
    path: "/incidents",
    icon: AlertTriangle,
    label: "Incidents",
    description: "Report and manage incidents",
  },
  {
    path: "/workers",
    icon: Users,
    label: "Workers",
    description: "Manage workforce",
  },
  {
    path: "/entry-points",
    icon: Shield,
    label: "Entry Points",
    description: "Manage access points",
  },
  {
    path: "/settings",
    icon: Settings,
    label: "Settings",
    description: "System preferences",
  },
];

export default function Sidebar({
  mobileOpen = false,
  onMobileOpenChange,
}) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    onMobileOpenChange?.(false);
  }, [location.pathname, onMobileOpenChange]);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onMobileOpenChange?.(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onMobileOpenChange]);

  const nav = (
    <>
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border",
          collapsed ? "h-20 justify-center px-2" : "h-[5.5rem] gap-3 px-4"
        )}
      >
        <Link
          to="/"
          title="AI SafeGuard home"
          className={cn(
            "flex min-w-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            collapsed ? "justify-center" : "gap-3"
          )}
        >
          <BrandMark
            className={cn(
              "flex-shrink-0",
              collapsed ? "h-11 w-11" : "h-12 w-12"
            )}
          />

          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <p className="truncate text-[1.35rem] font-bold leading-none tracking-tight text-sidebar-foreground">
                AI SafeGuard
              </p>
              <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/70">
                Gear Compliance
              </p>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Main">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);

          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : item.description}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex min-h-[56px] items-center rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />

              {!collapsed && (
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold leading-tight">
                    {item.label}
                  </div>

                  <div
                    className={cn(
                      "mt-0.5 truncate text-xs leading-tight",
                      isActive
                        ? "text-sidebar-primary-foreground/80"
                        : "text-sidebar-foreground/65"
                    )}
                  >
                    {item.description}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          className={cn(
            "hidden w-full items-center rounded-xl text-sm font-medium text-sidebar-foreground/75 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:flex",
            collapsed
              ? "justify-center px-3 py-3"
              : "justify-start gap-3 px-4 py-3"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              <span>Collapse Menu</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close navigation menu"
          onClick={() => onMobileOpenChange?.(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-[272px] flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:sticky lg:z-0 lg:translate-x-0",
          collapsed ? "lg:w-[76px]" : "lg:w-[272px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {nav}
      </aside>
    </>
  );
}

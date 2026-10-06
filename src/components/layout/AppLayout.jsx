import { useState } from "react";
import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";
import BrandMark from "./BrandMark";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground lg:hidden">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label="Open navigation menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <BrandMark className="h-8 w-8" />
          <p className="text-sm font-semibold tracking-tight">AI SafeGuard</p>
        </header>

        <main className="sg-page-enter min-h-0 min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

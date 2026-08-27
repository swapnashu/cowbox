"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { CommandPalette } from "@/components/ui/command-palette";

export function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isStandalonePage = pathname === "/login" || pathname === "/status";

  if (isStandalonePage) {
    return <main className="flex-1 w-full">{children}</main>;
  }

  return (
    <>
      <CommandPalette />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </>
  );
}

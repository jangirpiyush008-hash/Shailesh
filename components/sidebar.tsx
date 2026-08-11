"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FolderKanban, Settings, LogOut, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ profile }: { profile: { full_name: string | null; email: string; role: string } | null }) {
  const path = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white h-screen sticky top-0 flex flex-col">
      <div className="p-5 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sbj-logo.svg" alt="SBJ Technical Works" className="h-9 w-auto" />
        </Link>
        <div className="mt-2 text-[11px] uppercase tracking-wider text-slate-400 font-medium">Technical Works LLC</div>
      </div>
      <nav className="p-3 space-y-1 flex-1">
        {NAV.map((item) => {
          const active = path === item.href || (item.href !== "/dashboard" && path.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-violet-50 text-violet-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-3 rounded-lg p-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-rose-500 grid place-items-center text-white text-sm font-semibold">
            {profile?.full_name?.[0]?.toUpperCase() ?? profile?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{profile?.full_name ?? profile?.email}</div>
            <div className="text-xs text-slate-500 capitalize">{profile?.role}</div>
          </div>
        </div>
        <button onClick={signOut} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  );
}

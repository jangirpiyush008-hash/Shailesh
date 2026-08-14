import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  // All roles can log in. Non-admins see a role-limited view enforced by RLS
  // + the granular permissions system (financials hidden, no user mgmt, etc.)
  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

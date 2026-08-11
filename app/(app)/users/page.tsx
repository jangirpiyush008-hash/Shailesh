import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentProfile, permissions, permissions as computePerms, ACCESS_LEVEL_LABELS, PERM_GROUPS } from "@/lib/permissions";
import { Card, CardBody } from "@/components/ui";
import { UsersClient } from "./users-client";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await currentProfile();
  const perms = permissions(me);
  if (!perms.canManageUsers) redirect("/dashboard");

  const supabase = createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, access_level, permissions_overrides, created_at")
    .order("created_at", { ascending: false });

  const serviceKeySet = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 grid place-items-center"><Users size={18} /></div>
          <h1 className="text-2xl font-semibold">Users & Access</h1>
        </div>
        <p className="text-sm text-slate-500">Add teammates, change their roles, and set what coordinators can see and do.</p>
      </div>

      {!serviceKeySet && (
        <Card className="bg-amber-50 border-amber-300">
          <CardBody className="text-sm">
            <div className="font-semibold text-amber-900 mb-1">⚠ Setup required: SUPABASE_SERVICE_ROLE_KEY</div>
            <div className="text-amber-800">
              To create or delete users you must add the service-role key in <b>Railway → Variables</b>. Get it from Supabase → Settings → API → <b>Secret keys</b> (starts with <code>sb_secret_</code>).
              Once added, redeploy and this warning goes away.
            </div>
          </CardBody>
        </Card>
      )}

      <UsersClient
        currentUserId={me!.id}
        profiles={profiles ?? []}
        accessLevels={ACCESS_LEVEL_LABELS}
        permGroups={PERM_GROUPS}
        serviceKeySet={serviceKeySet}
      />
    </div>
  );
}

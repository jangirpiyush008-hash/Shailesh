"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle, Button, Input, Label, Select, Badge } from "@/components/ui";
import { shortDate, cn } from "@/lib/utils";
import { permissions as computePerms, type PermKey } from "@/lib/permissions";
import { Plus, Trash2, Save, UserPlus, ChevronDown, ChevronUp } from "lucide-react";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "coordinator" | "employee";
  access_level: "full" | "edit" | "read" | "view";
  permissions_overrides?: Record<string, boolean>;
  created_at: string;
};

type PermGroup = { section: string; keys: { key: PermKey; label: string; hint?: string }[] };

export function UsersClient({
  currentUserId, profiles, accessLevels, permGroups, serviceKeySet,
}: {
  currentUserId: string;
  profiles: Profile[];
  accessLevels: Record<string, { label: string; desc: string }>;
  permGroups: PermGroup[];
  serviceKeySet: boolean;
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setInviteOpen((v) => !v)} disabled={!serviceKeySet}>
          <UserPlus size={16} /> {inviteOpen ? "Cancel" : "Add user"}
        </Button>
      </div>

      {inviteOpen && <InviteForm onDone={() => { setInviteOpen(false); router.refresh(); }} />}

      <Card>
        <CardHeader><CardTitle>Team ({profiles.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
              <tr>
                <th className="text-left px-5 py-3">Name / Email</th>
                <th className="text-left px-5 py-3 w-40">Role</th>
                <th className="text-left px-5 py-3 w-56">Access level</th>
                <th className="text-left px-5 py-3 w-32">Joined</th>
                <th className="w-24 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <UserRow
                  key={p.id}
                  profile={p}
                  isSelf={p.id === currentUserId}
                  accessLevels={accessLevels}
                  permGroups={permGroups}
                  serviceKeySet={serviceKeySet}
                  onChanged={() => router.refresh()}
                />
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <div className="text-xs text-slate-500 text-center">
        Access level presets a starting set of permissions. Expand any row (▼) to fine-tune individual checkboxes and save.
      </div>
    </div>
  );
}

/* -------------------- ROW -------------------- */
function UserRow({ profile, isSelf, accessLevels, permGroups, serviceKeySet, onChanged }: {
  profile: Profile;
  isSelf: boolean;
  accessLevels: any;
  permGroups: PermGroup[];
  serviceKeySet: boolean;
  onChanged: () => void;
}) {
  const [role, setRole] = useState(profile.role);
  const [level, setLevel] = useState(profile.access_level);
  const [name, setName] = useState(profile.full_name || "");
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Start with the current effective permissions (base + any saved overrides)
  const initial = computePerms({
    role: profile.role, access_level: profile.access_level,
    permissions_overrides: profile.permissions_overrides ?? {},
  });
  const [perms, setPerms] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    permGroups.flatMap((g) => g.keys).forEach(({ key }) => { out[key] = (initial as any)[key]; });
    return out;
  });
  const [pendingCheckboxChange, setPendingCheckboxChange] = useState(false);

  const baseChanged = role !== profile.role || level !== profile.access_level || name !== (profile.full_name || "");
  const changed = baseChanged || pendingCheckboxChange;

  function toggle(key: PermKey) {
    setPerms((p) => ({ ...p, [key]: !p[key] }));
    setPendingCheckboxChange(true);
  }

  async function save() {
    setSaving(true);
    try {
      // Send every checkbox as an explicit override — clean and predictable
      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, access_level: level, full_name: name, permissions_overrides: perms }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setPendingCheckboxChange(false);
      onChanged();
    } catch (e: any) {
      alert("Failed to save: " + (e?.message ?? ""));
    } finally { setSaving(false); }
  }

  async function del() {
    if (!confirm(`Delete ${profile.email}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${profile.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      onChanged();
    } catch (e: any) {
      alert("Failed to delete: " + (e?.message ?? ""));
    } finally { setSaving(false); }
  }

  const isAdmin = role === "admin";
  const showAccess = role === "coordinator";

  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50/50">
        <td className="px-5 py-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="max-w-xs" />
          <div className="text-xs text-slate-500 mt-1">{profile.email} {isSelf && <span className="ml-2 text-violet-600 font-medium">(you)</span>}</div>
        </td>
        <td className="px-5 py-3">
          <Select value={role} onChange={(e) => setRole(e.target.value as any)} disabled={isSelf}>
            <option value="admin">Admin</option>
            <option value="coordinator">Coordinator</option>
            <option value="employee">Employee</option>
          </Select>
        </td>
        <td className="px-5 py-3">
          <Select
            value={level}
            onChange={(e) => setLevel(e.target.value as any)}
            disabled={!showAccess}
            title={!showAccess ? (isAdmin ? "Admin always has full access" : "Employees are always view-only") : ""}
          >
            {Object.entries(accessLevels).map(([k, v]: any) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </td>
        <td className="px-5 py-3 text-slate-600">{shortDate(profile.created_at)}</td>
        <td className="px-3">
          <div className="flex gap-1 justify-end items-center">
            <button
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                "p-2 rounded-md hover:bg-slate-100",
                expanded ? "text-violet-700 bg-violet-50" : "text-slate-500"
              )}
              title="Permissions"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {changed && (
              <button
                onClick={save}
                disabled={saving || !serviceKeySet}
                className="p-2 rounded-md bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-50"
                title="Save changes"
              >
                <Save size={14} />
              </button>
            )}
            {!isSelf && (
              <button
                onClick={del}
                disabled={saving || !serviceKeySet}
                className="p-2 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                title="Delete user"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expandable permission panel */}
      {expanded && (
        <tr className="border-t border-slate-100 bg-slate-50/70">
          <td colSpan={5} className="px-5 py-5">
            <div className="text-sm font-semibold text-slate-900 mb-4">Permissions</div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              {permGroups.map((group) => (
                <div key={group.section}>
                  <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">{group.section}</div>
                  <div className="space-y-1.5">
                    {group.keys.map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-start gap-2 cursor-pointer rounded-md px-2 py-1 -mx-2 hover:bg-slate-100"
                      >
                        <input
                          type="checkbox"
                          checked={!!perms[key]}
                          onChange={() => toggle(key)}
                          className="mt-0.5 accent-violet-600"
                        />
                        <span className="text-sm text-slate-700 leading-tight">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {changed && (
              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end gap-2 items-center">
                <span className="text-xs text-slate-500">Unsaved changes</span>
                <Button onClick={save} disabled={saving || !serviceKeySet} size="sm" className="bg-gradient-to-r from-violet-600 to-rose-500">
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* -------------------- INVITE FORM -------------------- */
function InviteForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("employee");
  const [level, setLevel] = useState("view");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Auto-adjust default access level when role changes
  function onRoleChange(v: string) {
    setRole(v);
    if (v === "admin") setLevel("full");
    else if (v === "coordinator") setLevel("full");
    else setLevel("view");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      // Normalise phone: strip everything except digits + leading +
      const cleanPhone = phone.replace(/[^\d+]/g, "").replace(/^00/, "+");
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name, email, password, role, access_level: level, phone_number: cleanPhone || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setName(""); setEmail(""); setPassword(""); setPhone("");
      onDone();
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally { setSaving(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Add new user</CardTitle></CardHeader>
      <CardBody>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jane Doe" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="jane@company.com" />
          </div>
          <div>
            <Label>WhatsApp phone (with country code)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 511 8431" />
            <div className="text-xs text-slate-500 mt-1">📱 The number they'll message the SBJ WhatsApp bot from. Without this, they can't use WhatsApp entry.</div>
          </div>
          <div>
            <Label>Temporary password {`${role === "admin" ? "(admin needs to log into web)" : "(unused — non-admins use WhatsApp)"}`}</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onChange={(e) => onRoleChange(e.target.value)}>
              <option value="admin">Admin (web dashboard access)</option>
              <option value="coordinator">Coordinator (WhatsApp only)</option>
              <option value="employee">Employee (WhatsApp only)</option>
            </Select>
          </div>
          {role === "coordinator" && (
            <div className="md:col-span-2">
              <Label>Coordinator access level</Label>
              <Select value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="full">Full — prices + add + edit + delete + create projects</option>
                <option value="edit">Edit — prices + add + edit + create (no delete)</option>
                <option value="read">Read-only — see prices, no edit</option>
                <option value="view">View-only — no prices visible</option>
              </Select>
            </div>
          )}
          {err && <div className="md:col-span-2 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{err}</div>}
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving} className="bg-gradient-to-r from-violet-600 to-rose-500">
              {saving ? "Creating…" : <><Plus size={16} /> Create user</>}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle, Badge, Button, Select } from "@/components/ui";
import { Users, Plus, X, Check, MessageCircle } from "lucide-react";

type Member = {
  id: string;              // profile id
  full_name: string | null;
  email: string;
  role: "admin" | "coordinator" | "employee";
  phone_number: string | null;
  team_role?: string;      // member / lead
  assigned_at?: string;
};

type AvailableUser = {
  id: string;
  full_name: string | null;
  email: string;
  role: "admin" | "coordinator" | "employee";
  phone_number: string | null;
};

export function TeamPanel({
  projectId, teamMembers, availableUsers, canManage,
}: {
  projectId: string;
  teamMembers: Member[];
  availableUsers: AvailableUser[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [busy, setBusy] = useState(false);

  // Only filter out users already ADDED to the team
  const takenIds = new Set(teamMembers.map((m) => m.id));
  const pickable = availableUsers.filter((u) => !takenIds.has(u.id));

  async function addMember() {
    if (!selectedUser) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUser }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setSelectedUser("");
      setAdding(false);
      router.refresh();
    } catch (e: any) {
      alert("Add failed: " + (e?.message ?? ""));
    } finally { setBusy(false); }
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this person from the team?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/team?user=${userId}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.refresh();
    } catch (e: any) {
      alert("Remove failed: " + (e?.message ?? ""));
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Users size={16} className="text-violet-600" /> Team ({teamMembers.length})
        </CardTitle>
        {canManage && (
          <Button size="sm" variant={adding ? "outline" : "default"} onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : <><Plus size={14} /> Add member</>}
          </Button>
        )}
      </CardHeader>
      <CardBody className="space-y-2">
        {adding && (
          <div className="flex gap-2 pb-3 border-b border-slate-200 mb-2">
            <Select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="flex-1">
              <option value="">— Pick a user —</option>
              {pickable.map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.full_name ?? u.email)} ({u.role}){u.phone_number ? "" : "  ⚠ no WhatsApp"}
                </option>
              ))}
            </Select>
            <Button onClick={addMember} disabled={!selectedUser || busy}>
              {busy ? "Adding…" : <><Check size={14} /> Add</>}
            </Button>
          </div>
        )}

        {teamMembers.map((m) => (
          <MemberRow
            key={m.id}
            m={m}
            badgeLabel={m.role === "employee" ? "Employee" : m.role === "coordinator" ? "Coordinator" : "Admin"}
            badgeVariant={m.role === "employee" ? "outline" : m.role === "admin" ? "success" : "info"}
            canRemove={canManage}
            onRemove={() => removeMember(m.id)}
          />
        ))}

        {teamMembers.length === 0 && !adding && (
          <div className="text-center text-sm text-slate-500 py-8">
            <Users size={32} className="mx-auto text-slate-300 mb-2" />
            No one assigned yet. {canManage && <button onClick={() => setAdding(true)} className="text-violet-600 hover:underline font-medium">Add someone</button>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function MemberRow({ m, badgeLabel, badgeVariant, canRemove, onRemove }: {
  m: Member; badgeLabel: string; badgeVariant: any; canRemove: boolean; onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 hover:bg-slate-50 p-2.5 group">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-rose-500 grid place-items-center text-white text-sm font-semibold shrink-0">
        {(m.full_name ?? m.email)[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 truncate">{m.full_name ?? m.email}</div>
        <div className="text-xs text-slate-500 truncate flex items-center gap-2">
          {m.email}
          {m.phone_number ? (
            <span className="inline-flex items-center gap-1 text-emerald-700"><MessageCircle size={10} /> {m.phone_number}</span>
          ) : (
            <span className="text-amber-600">⚠ no WhatsApp</span>
          )}
        </div>
      </div>
      <Badge variant={badgeVariant}>{badgeLabel}</Badge>
      {canRemove && (
        <button
          onClick={onRemove}
          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition"
          title="Remove from team"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

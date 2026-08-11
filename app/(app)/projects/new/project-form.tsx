"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { COORDINATOR_PRESETS } from "@/lib/constants";

export function ProjectForm({ coordinators }: { coordinators: { id: string; full_name: string | null; email: string }[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [coordinatorName, setCoordinatorName] = useState<string>("");
  const [coordinatorCustom, setCoordinatorCustom] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);   // capture before await
    setErr(null);
    setSaving(true);
    try {
    const supabase = createClient();
    const payload = {
      job_card_number: String(fd.get("job_card_number")).trim(),
      project_name: String(fd.get("project_name")).trim(),
      client_name: String(fd.get("client_name")).trim(),
      client_address: String(fd.get("client_address") || "") || null,
      client_lpo_no: String(fd.get("client_lpo_no") || "") || null,
      client_lpo_date: String(fd.get("client_lpo_date") || "") || null,
      stand_name: String(fd.get("stand_name") || "") || null,
      exhibition_name: String(fd.get("exhibition_name") || "") || null,
      country: String(fd.get("country") || "") || null,
      city: String(fd.get("city") || "") || null,
      venue: String(fd.get("venue") || "") || null,
      coordinator_id: String(fd.get("coordinator_id") || "") || null,
      coordinator_name: coordinatorName === "__other__"
        ? (coordinatorCustom.trim() || null)
        : (coordinatorName || null),
      sales_person: String(fd.get("sales_person") || "") || null,
      project_value: Number(fd.get("project_value") || 0),
      estimated_profit: Number(fd.get("estimated_profit") || 0),
      status: String(fd.get("status") || "active") as any,
      priority: String(fd.get("priority") || "medium") as any,
      start_date: String(fd.get("start_date") || "") || null,
      end_date: String(fd.get("end_date") || "") || null,
      instructions: String(fd.get("instructions") || "") || null,
      description: String(fd.get("description") || "") || null,
    };

    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("projects").insert({ ...payload, created_by: user.user!.id }).select("id").single();

    if (error) throw error;

    await supabase.from("activity_log").insert({
      project_id: data!.id, user_id: user.user!.id, action: "project.created",
      entity_type: "project", entity_id: data!.id,
      meta: { job_card_number: payload.job_card_number },
    });

    router.push(`/projects/${data!.id}`);
    router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create project");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Job Card #</Label>
          <Input name="job_card_number" required placeholder="SBJ-JC-26-415" />
        </div>
        <div>
          <Label>Project name</Label>
          <Input name="project_name" required placeholder="Agentic AI for UAE Government" />
        </div>
        <div>
          <Label>Client name</Label>
          <Input name="client_name" required placeholder="Rain Light" />
        </div>
        <div>
          <Label>Coordinator</Label>
          <Select value={coordinatorName} onChange={(e) => setCoordinatorName(e.target.value)}>
            <option value="">— Select —</option>
            {COORDINATOR_PRESETS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
            {coordinators.length > 0 && <option disabled>──────</option>}
            {coordinators.map((c) => (
              <option key={c.id} value={c.full_name ?? c.email}>{c.full_name ?? c.email} (user)</option>
            ))}
            <option value="__other__">Other — type a name…</option>
          </Select>
          {coordinatorName === "__other__" && (
            <Input
              className="mt-2"
              placeholder="Coordinator name"
              value={coordinatorCustom}
              onChange={(e) => setCoordinatorCustom(e.target.value)}
            />
          )}
          {/* Hidden field so the form still POSTs a value (unused server-side; we send from state) */}
          <input type="hidden" name="coordinator_id" value="" />
        </div>
        <div className="md:col-span-2">
          <Label>Client address</Label>
          <Input name="client_address" placeholder="Conrad Abu Dhabi, Etihad Tower" />
        </div>
        <div>
          <Label>Stand name</Label>
          <Input name="stand_name" />
        </div>
        <div>
          <Label>Exhibition name</Label>
          <Input name="exhibition_name" />
        </div>
        <div>
          <Label>Country</Label>
          <Input name="country" />
        </div>
        <div>
          <Label>City / Venue</Label>
          <Input name="city" placeholder="Abu Dhabi" />
        </div>
        <div>
          <Label>Client LPO No.</Label>
          <Input name="client_lpo_no" />
        </div>
        <div>
          <Label>LPO date</Label>
          <Input type="date" name="client_lpo_date" />
        </div>
        <div>
          <Label>Start date</Label>
          <Input type="date" name="start_date" />
        </div>
        <div>
          <Label>End date</Label>
          <Input type="date" name="end_date" />
        </div>
        <div>
          <Label>Project value (AED)</Label>
          <Input type="number" step="0.01" name="project_value" defaultValue="0" />
        </div>
        <div>
          <Label>Estimated profit (AED)</Label>
          <Input type="number" step="0.01" name="estimated_profit" defaultValue="0" />
        </div>
        <div>
          <Label>Status</Label>
          <Select name="status" defaultValue="active">
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </Select>
        </div>
        <div>
          <Label>Priority</Label>
          <Select name="priority" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>
        <div>
          <Label>Sales person</Label>
          <Input name="sales_person" />
        </div>
      </div>

      <div>
        <Label>Instructions</Label>
        <Textarea name="instructions" placeholder="Special instructions to appear on the Job Card…" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea name="description" />
      </div>

      {err && <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{err}</div>}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving} className="bg-gradient-to-r from-violet-600 to-rose-500">
          {saving ? "Creating…" : "Create project"}
        </Button>
      </div>
    </form>
  );
}

import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label, value, sub, icon: Icon, tone = "violet",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: "violet" | "emerald" | "amber" | "rose" | "sky";
}) {
  const tones: Record<string, string> = {
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    sky: "bg-sky-50 text-sky-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        {Icon && (
          <div className={cn("w-10 h-10 rounded-lg grid place-items-center shrink-0", tones[tone])}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </Card>
  );
}

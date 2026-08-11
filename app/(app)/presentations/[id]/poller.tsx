"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui";
import { Loader2 } from "lucide-react";

export function PresentationStatus({ id }: { id: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("Gamma is building your presentation…");

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      while (!cancelled && attempts < 60) {
        attempts++;
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const res = await fetch(`/api/presentations/${id}/status`, { cache: "no-store" });
          const j = await res.json();
          if (j.status === "completed" || j.status === "failed" || j.error) {
            router.refresh();
            return;
          }
        } catch {}
      }
      if (!cancelled) setMsg("Still working — refresh in a minute to check again.");
    }
    void poll();
    return () => { cancelled = true; };
  }, [id, router]);

  return (
    <Card>
      <CardBody className="flex items-center gap-3 p-4 bg-violet-50 border-violet-200">
        <Loader2 className="animate-spin text-violet-600" size={20} />
        <div className="text-sm text-slate-700">{msg}</div>
      </CardBody>
    </Card>
  );
}

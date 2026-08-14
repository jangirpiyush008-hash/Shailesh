"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button, Card, CardBody, Input, Label } from "@/components/ui";

export function AuthForm() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!configured) {
    return (
      <Card>
        <CardBody className="p-6 space-y-3 text-sm">
          <div className="font-semibold text-slate-900">Setup required</div>
          <p className="text-slate-600">
            Supabase is not connected yet. Add these variables in <b>Railway → your service → Variables</b>, then trigger a redeploy:
          </p>
          <pre className="bg-slate-900 text-slate-100 rounded-md p-3 text-xs overflow-x-auto">{`NEXT_PUBLIC_SUPABASE_URL       = https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY      = eyJhbGci...`}</pre>
        </CardBody>
      </Card>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      router.replace("/dashboard");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardBody className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </div>

          {err && <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{err}</div>}

          <Button type="submit" className="w-full bg-gradient-to-r from-violet-600 to-rose-500" disabled={loading}>
            {loading ? "Please wait…" : "Sign in"}
          </Button>

          <p className="text-xs text-slate-500 text-center pt-2 border-t border-slate-100 mt-4">
            🔒 Internal dashboard — admin access only. Coordinators &amp; employees log entries via the official SBJ WhatsApp bot.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}

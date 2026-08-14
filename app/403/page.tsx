import Link from "next/link";
import { Button } from "@/components/ui";
import { Lock, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="max-w-md text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 grid place-items-center mb-4">
          <Lock size={28} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">403 — Access Denied</h1>
        <p className="text-slate-600 mb-6">
          This dashboard is <b>admin-only</b>. Coordinators and employees log all entries through the official SBJ WhatsApp bot.
        </p>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle size={16} className="text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-800">Send entries here instead</span>
          </div>
          <div className="text-emerald-900 font-mono font-bold text-lg">+971 50 511 8431</div>
          <div className="text-xs text-emerald-700 mt-1">Save this contact as "SBJ Bot" — send projects updates, expenses, labour anytime.</div>
        </div>
        <Link href="/login">
          <Button variant="outline" className="w-full">Back to sign in</Button>
        </Link>
      </div>
    </div>
  );
}

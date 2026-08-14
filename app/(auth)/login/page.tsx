import { AuthForm } from "./auth-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-violet-50 via-white to-rose-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex flex-col items-center gap-1 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sbj-logo.png" alt="SBJ Technical Works" className="h-14 w-auto" />
            <span className="text-[11px] uppercase tracking-widest text-slate-400 font-medium">Technical Works LLC</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin sign in</h1>
          <p className="text-slate-500 text-sm mt-1">Internal dashboard for SBJ Technical Works.</p>
        </div>
        <AuthForm />
      </div>
    </div>
  );
}

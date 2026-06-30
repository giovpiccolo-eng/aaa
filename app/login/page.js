"use client";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [session, router]);

  if (status === "loading") return null;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#16494A" }}>
      {/* Blob background shapes */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: "#CAF104", transform: "translate(30%, -30%)" }} />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10" style={{ backgroundColor: "#17C430", transform: "translate(-30%, 30%)" }} />

      {/* Swoosh corner */}
      <div className="absolute top-0 right-0 w-48 h-48 overflow-hidden pointer-events-none">
        <svg viewBox="0 0 200 200" className="absolute top-0 right-0 w-full h-full">
          <path d="M200 0 Q100 0 40 80 Q0 120 0 200 L200 200 Z" fill="#CAF104" opacity="0.15"/>
          <path d="M200 0 Q140 20 90 90 Q50 140 0 200" stroke="#CAF104" strokeWidth="2" fill="none" opacity="0.4"/>
        </svg>
      </div>

      <div className="relative z-10 bg-white rounded-3xl shadow-2xl p-10 max-w-sm w-full mx-4">
        {/* Acorn mark */}
        <div className="flex justify-center mb-6">
          <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl" style={{ backgroundColor: "#16494A" }}>
            <svg viewBox="0 0 60 72" className="w-9 h-9">
              <ellipse cx="30" cy="50" rx="18" ry="20" fill="#CAF104"/>
              <rect x="27" y="28" width="6" height="14" rx="3" fill="#CAF104" opacity=".7"/>
              <ellipse cx="30" cy="30" rx="16" ry="7" fill="#CAF104" opacity=".85"/>
            </svg>
          </div>
        </div>

        {/* Lime rule */}
        <div className="h-0.5 w-12 mx-auto mb-5 rounded-full" style={{ backgroundColor: "#CAF104" }} />

        <h1 className="text-3xl font-bold text-center mb-1" style={{ fontFamily: "'Fredoka', sans-serif", color: "#16494A" }}>
          Concordance
        </h1>
        <p className="text-sm text-center text-gray-500 mb-1">Acorn International School</p>
        <p className="text-xs text-center text-gray-400 mb-8">Integrated History</p>

        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: "#16494A" }}
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign in with Google
        </button>

        <p className="mt-5 text-xs text-center text-gray-400">
          @acorninternationalschool.eu accounts only
        </p>
      </div>
    </div>
  );
}

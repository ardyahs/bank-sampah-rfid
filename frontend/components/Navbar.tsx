"use client";

import { useRouter } from "next/navigation";
import { Recycle, LogOut } from "lucide-react";
import { clearSession, SessionUser } from "@/lib/auth";

export default function Navbar({ user }: { user: SessionUser | null }) {
  const router = useRouter();

  function logout() {
    clearSession();
    router.push("/login");
  }

  return (
    <nav className="sticky top-0 z-20 bg-primary/95 backdrop-blur text-white shadow-eco">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-white/20" aria-hidden>
            <Recycle className="w-5 h-5" />
          </span>
          <div className="leading-tight">
            <div className="font-semibold text-[15px]">Bank Sampah Digital</div>
            <div className="text-[11px] text-green-50/80 -mt-0.5">Ramah lingkungan · berbasis RFID</div>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-green-50/90">
              Hai, <span className="font-medium">{user.username}</span>
            </span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 bg-white/95 text-primary-dark font-medium px-3.5 py-1.5 rounded-lg hover:bg-white transition active:scale-[0.98]"
            >
              <LogOut className="w-4 h-4" />
              Keluar
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

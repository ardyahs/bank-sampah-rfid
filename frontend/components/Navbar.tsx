"use client";

import { useRouter } from "next/navigation";
import { clearSession, SessionUser } from "@/lib/auth";

export default function Navbar({ user }: { user: SessionUser | null }) {
  const router = useRouter();

  function logout() {
    clearSession();
    router.push("/login");
  }

  return (
    <nav className="bg-primary text-white px-6 py-4 flex items-center justify-between shadow">
      <div className="font-semibold text-lg">Bank Sampah Digital RFID</div>
      {user && (
        <div className="flex items-center gap-4 text-sm">
          <span className="opacity-90">Role: {user.role}</span>
          <button
            onClick={logout}
            className="bg-white text-primary px-3 py-1 rounded hover:bg-gray-100"
          >
            Keluar
          </button>
        </div>
      )}
    </nav>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
    } else if (user.role === "admin" || user.role === "petugas") {
      router.replace("/admin");
    } else {
      router.replace("/warga");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <span className="text-4xl animate-pulse" aria-hidden>♻️</span>
      <p className="text-green-700/80 text-sm">Memuat...</p>
    </div>
  );
}

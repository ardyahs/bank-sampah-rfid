"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Recycle } from "lucide-react";
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
      <Recycle className="w-10 h-10 text-primary animate-pulse" aria-hidden />
      <p className="text-green-700/80 text-sm">Memuat...</p>
    </div>
  );
}

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
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Memuat...</p>
    </div>
  );
}

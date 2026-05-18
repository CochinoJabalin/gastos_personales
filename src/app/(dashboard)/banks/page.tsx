"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BanksPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/banks");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-body-md text-on-surface-variant">Redirigiendo...</div>
    </div>
  );
}

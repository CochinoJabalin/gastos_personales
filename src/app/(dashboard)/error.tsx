"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="md:ml-56 pt-14 pb-20 md:pb-6 min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-container-margin py-4">
        <div className="text-center py-12">
          <h2 className="text-headline-md text-on-surface mb-4">
            Algo sali&oacute; mal
          </h2>
          <p className="text-body-md text-on-surface-variant mb-8">
            {error.message || "Ha ocurrido un error inesperado."}
          </p>
          <button
            onClick={reset}
            className="bg-primary text-on-primary px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [autoLogging, setAutoLogging] = useState(true);

  useEffect(() => {
    async function autoLogin() {
      const result = await signIn("credentials", {
        username: "admin",
        password: "admin",
        redirect: false,
      });

      if (result?.error) {
        setAutoLogging(false);
        setError("Credenciales inválidas");
      } else {
        router.push("/dashboard");
      }
    }
    autoLogin();
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const form = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      username: form.get("username") as string,
      password: form.get("password") as string,
      redirect: false,
    });

    if (result?.error) {
      setError("Credenciales inválidas");
    } else {
      router.push("/dashboard");
    }
  }

  if (autoLogging) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="text-center">
          <h1 className="text-headline-md text-on-surface mb-2">
            Gestor Patrimonial
          </h1>
          <p className="text-body-sm text-on-surface-variant">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-headline-md text-on-surface mb-2">
            Gestor Patrimonial
          </h1>
          <p className="text-body-sm text-on-surface-variant">
            Inicia sesión para continuar
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-container rounded-xl p-6 space-y-4 border border-surface-container-high"
        >
          <div>
            <label
              htmlFor="username"
              className="block text-label-caps text-on-surface-variant mb-1.5 uppercase tracking-wider"
            >
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="w-full rounded-lg bg-surface-container-high border border-surface-container-highest px-3 py-2.5 text-body-md text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="admin"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-label-caps text-on-surface-variant mb-1.5 uppercase tracking-wider"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-lg bg-surface-container-high border border-surface-container-highest px-3 py-2.5 text-body-md text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-body-sm text-error bg-error-container/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-body-md font-medium text-primary-on hover:bg-primary/90 transition-colors"
          >
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

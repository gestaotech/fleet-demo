"use client";

import { useActionState } from "react";
import { loginFormAction } from "./actions";

const initialState = { ok: false as const, error: "" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    loginFormAction,
    initialState,
  );

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 24 }}>
      <h1>Gestão de Frota</h1>
      <p>Acesso ao sistema</p>
      <form action={formAction}>
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
        {state.error ? <p role="alert">{state.error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <p style={{ fontSize: 12, color: "#666" }}>
        A autenticação e autorização são validadas no servidor.
      </p>
    </main>
  );
}

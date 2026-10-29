"use strict";

(() => {
  const form = document.getElementById("setup-admin-form");
  const status = document.getElementById("setup-status");
  const submit = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "Criando administrador...";
    submit.disabled = true;

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.token = String(payload.token || "").trim();

    try {
      const response = await fetch("/api/v1/setup/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error?.message || "Não foi possível criar o administrador.");
      }

      form.reset();
      status.textContent = "Administrador criado. Agora entre na tela de login e remova ADMIN_BOOTSTRAP_TOKEN da Vercel assim que confirmar o acesso.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Falha inesperada.";
    } finally {
      submit.disabled = false;
    }
  });
})();

/*
 * Persistência do estado operacional no servidor (Neon, via /api/v1/workspace).
 *
 * Não há LocalStorage nem SessionStorage: nenhum dado operacional fica no navegador.
 * A revisão informada em cada gravação permite ao servidor recusar alterações feitas
 * sobre uma versão antiga (409), evitando que uma atualização sobrescreva outra.
 */
const Storage = (function () {
  /* Carrega { state, revision } da empresa da sessão. */
  async function load() {
    const resposta = await Api.get('/workspace');
    if (!resposta.ok) return { ok: false, status: resposta.status, error: resposta.error };
    return { ok: true, state: resposta.data.state, revision: resposta.data.revision };
  }

  /*
   * Grava o estado inteiro com a revisão lida. Só retorna ok quando o servidor confirmou.
   * Em caso de conflito (409) a interface deve recarregar antes de continuar.
   */
  async function save(state, revision) {
    const resposta = await Api.put('/workspace', { baseRevision: revision, state });
    if (!resposta.ok) return { ok: false, status: resposta.status, error: resposta.error };
    return { ok: true, revision: resposta.data.revision };
  }

  return { load, save };
})();

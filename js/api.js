/*
 * Cliente HTTP da API (/api/v1). Único ponto em que a interface fala com o servidor.
 *
 * - Sempre envia cookies da mesma origem (a sessão fica em cookie HttpOnly, que o
 *   JavaScript não lê).
 * - Em alterações (POST, PUT, PATCH, DELETE) envia o token CSRF do cookie gt_csrf
 *   no cabeçalho X-CSRF-Token.
 * - Nunca lança exceção para erros HTTP: devolve { ok, status, data, error }, para que
 *   cada tela mostre a mensagem adequada. Falha de rede vira code SEM_CONEXAO.
 */
const Api = (function () {
  const BASE = '/api/v1';
  const METODOS_QUE_ALTERAM = ['POST', 'PUT', 'PATCH', 'DELETE'];

  function lerCookie(nome) {
    const partes = String(document.cookie || '').split(';');
    for (const parte of partes) {
      const indice = parte.indexOf('=');
      if (indice === -1) continue;
      if (parte.slice(0, indice).trim() === nome) {
        return decodeURIComponent(parte.slice(indice + 1).trim());
      }
    }
    return '';
  }

  async function request(metodo, caminho, corpo) {
    const cabecalhos = { Accept: 'application/json' };
    const opcoes = { method: metodo, credentials: 'same-origin', headers: cabecalhos, cache: 'no-store' };
    if (corpo !== undefined) {
      cabecalhos['Content-Type'] = 'application/json';
      opcoes.body = JSON.stringify(corpo);
    }
    if (METODOS_QUE_ALTERAM.includes(metodo)) {
      cabecalhos['X-CSRF-Token'] = lerCookie('gt_csrf');
    }

    let resposta;
    try {
      resposta = await fetch(BASE + caminho, opcoes);
    } catch (erro) {
      return { ok: false, status: 0, data: null, error: { code: 'SEM_CONEXAO', message: 'Não foi possível conectar ao servidor. Verifique sua conexão.' } };
    }

    let json = null;
    try {
      json = await resposta.json();
    } catch (erro) {
      json = null;
    }

    if (resposta.ok) {
      return { ok: true, status: resposta.status, data: json ? json.data : null, error: null };
    }
    const erro = (json && json.error) || { code: 'ERRO', message: 'Não foi possível concluir a operação.' };
    return { ok: false, status: resposta.status, data: null, error: erro };
  }

  return {
    get: caminho => request('GET', caminho),
    post: (caminho, corpo) => request('POST', caminho, corpo === undefined ? {} : corpo),
    put: (caminho, corpo) => request('PUT', caminho, corpo),
    patch: (caminho, corpo) => request('PATCH', caminho, corpo),
    request,
  };
})();

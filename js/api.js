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

  // Uma ação por vez: bloqueia cliques/submit repetidos até a resposta da API.
  let acaoEmAndamento = false;
  let requisicaoDeGravacao = false;
  let controleAtivo = null;

  function bloquearControle(controle) {
    if (!controle || controle.disabled) return;
    controleAtivo = {
      elemento: controle,
      disabledOriginal: controle.disabled,
      textoOriginal: 'value' in controle ? controle.value : controle.textContent,
      ariaBusyOriginal: controle.getAttribute('aria-busy'),
    };
    controle.disabled = true;
    controle.setAttribute('aria-busy', 'true');
    if ('value' in controle && controle.tagName === 'INPUT') controle.value = 'Aguarde...';
    else if (controle.tagName === 'BUTTON') controle.textContent = 'Aguarde...';
  }

  function liberarAcao() {
    if (controleAtivo && controleAtivo.elemento.isConnected) {
      const { elemento, disabledOriginal, textoOriginal, ariaBusyOriginal } = controleAtivo;
      elemento.disabled = disabledOriginal;
      if ('value' in elemento && elemento.tagName === 'INPUT') elemento.value = textoOriginal;
      else if (elemento.tagName === 'BUTTON') elemento.textContent = textoOriginal;
      if (ariaBusyOriginal === null) elemento.removeAttribute('aria-busy');
      else elemento.setAttribute('aria-busy', ariaBusyOriginal);
    }
    controleAtivo = null;
    requisicaoDeGravacao = false;
    acaoEmAndamento = false;
  }

  function iniciarAcao(controle) {
    if (acaoEmAndamento) return false;
    acaoEmAndamento = true;
    bloquearControle(controle);
    return true;
  }

  document.addEventListener('click', event => {
    const controle = event.target.closest('button, input[type="button"], input[type="submit"]');
    if (acaoEmAndamento) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!controle || controle.disabled || controle.type === 'submit') return;
    iniciarAcao(controle);
    queueMicrotask(() => { if (!requisicaoDeGravacao) liberarAcao(); });
  }, true);

  document.addEventListener('submit', event => {
    if (acaoEmAndamento) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const form = event.target;
    const submit = form.querySelector('button[type="submit"]:not(:disabled), input[type="submit"]:not(:disabled)') ||
      form.querySelector('button:not(:disabled)');
    iniciarAcao(submit);
    queueMicrotask(() => { if (!requisicaoDeGravacao) liberarAcao(); });
  }, true);

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
    const alteraDados = METODOS_QUE_ALTERAM.includes(metodo);
    if (alteraDados) {
      if (requisicaoDeGravacao) {
        return { ok: false, status: 409, data: null, error: { code: 'ACAO_EM_ANDAMENTO', message: 'Aguarde a conclusão da operação atual antes de realizar outra ação.' } };
      }
      if (!acaoEmAndamento) iniciarAcao(null);
      requisicaoDeGravacao = true;
    }
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
    } finally {
      if (alteraDados) liberarAcao();
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

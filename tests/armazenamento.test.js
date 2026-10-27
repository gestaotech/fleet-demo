const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

/* Resposta falsa de fetch com corpo JSON, no formato devolvido pela API. */
function resposta(status, corpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo };
}

function comFetch(app, manipulador) {
  const chamadas = [];
  app.sandbox.fetch = async (url, opcoes) => {
    chamadas.push({ url, opcoes });
    return manipulador(url, opcoes);
  };
  return chamadas;
}

test('a interface não usa LocalStorage nem SessionStorage para dados operacionais', () => {
  const app = loadApp();
  delete app.sandbox.localStorage;
  delete app.sandbox.sessionStorage;
  comFetch(app, () => resposta(200, { data: { revision: 3, state: { veiculos: [] } } }));
  return app.api('Storage').load().then(r => {
    assert.equal(r.ok, true);
    assert.equal(r.revision, 3);
  });
});

test('load devolve estado e revisão da resposta da API', async () => {
  const app = loadApp();
  const chamadas = comFetch(app, () => resposta(200, { data: { revision: 7, state: { veiculos: [{ id: 'VEI-001' }] } } }));
  const r = await app.api('Storage').load();
  assert.equal(r.ok, true);
  assert.equal(r.revision, 7);
  assert.equal(r.state.veiculos[0].id, 'VEI-001');
  assert.equal(chamadas[0].url, '/api/v1/workspace');
  assert.equal(chamadas[0].opcoes.method, 'GET');
  assert.equal(chamadas[0].opcoes.credentials, 'same-origin');
  assert.equal(chamadas[0].opcoes.headers['X-CSRF-Token'], undefined, 'leitura não envia CSRF');
});

test('save envia a revisão lida e só confirma com a resposta do servidor', async () => {
  const app = loadApp();
  app.sandbox.document.cookie = 'outro=1; gt_csrf=token-csrf-123';
  const chamadas = comFetch(app, () => resposta(200, { data: { revision: 8 } }));
  const r = await app.api('Storage').save({ veiculos: [] }, 7);
  assert.equal(r.ok, true);
  assert.equal(r.revision, 8);
  const envio = chamadas[0];
  assert.equal(envio.opcoes.method, 'PUT');
  assert.equal(envio.opcoes.headers['X-CSRF-Token'], 'token-csrf-123');
  const corpo = JSON.parse(envio.opcoes.body);
  assert.equal(corpo.baseRevision, 7);
  assert.deepEqual(corpo.state, { veiculos: [] });
});

test('conflito de revisão (409) não é tratado como sucesso', async () => {
  const app = loadApp();
  comFetch(app, () => resposta(409, { error: { code: 'REVISAO_DESATUALIZADA', message: 'Os dados foram alterados por outro usuário.', revisaoAtual: 9 } }));
  const r = await app.api('Storage').save({}, 7);
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
  assert.equal(r.error.code, 'REVISAO_DESATUALIZADA');
});

test('falha de rede vira erro SEM_CONEXAO sem lançar exceção', async () => {
  const app = loadApp();
  app.sandbox.fetch = async () => {
    throw new TypeError('fetch failed');
  };
  const r = await app.api('Api').get('/workspace');
  assert.equal(r.ok, false);
  assert.equal(r.status, 0);
  assert.equal(r.error.code, 'SEM_CONEXAO');
});

test('resposta de erro sem envelope padrão recebe mensagem genérica', async () => {
  const app = loadApp();
  comFetch(app, () => ({ ok: false, status: 500, json: async () => { throw new Error('não é json'); } }));
  const r = await app.api('Api').get('/workspace');
  assert.equal(r.ok, false);
  assert.equal(r.status, 500);
  assert.ok(r.error.message.length > 0);
});

test('alterações enviam CSRF; leituras não', async () => {
  const app = loadApp();
  app.sandbox.document.cookie = 'gt_csrf=abc123';
  const chamadas = comFetch(app, () => resposta(200, { data: {} }));
  await app.api('Api').post('/auth/logout');
  await app.api('Api').get('/auth/session');
  assert.equal(chamadas[0].opcoes.headers['X-CSRF-Token'], 'abc123');
  assert.equal(chamadas[1].opcoes.headers['X-CSRF-Token'], undefined);
});

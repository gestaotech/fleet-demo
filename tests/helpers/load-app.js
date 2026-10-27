/*
 * Carrega os mesmos arquivos JavaScript que o index.html usa, em um contexto isolado (vm).
 * `fetch` e `document` são simulados: a interface fala com a API, e os testes controlam
 * as respostas. Não há LocalStorage: a persistência é do servidor.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

const FILES = [
  'js/data.js',
  'js/api.js',
  'js/storage.js',
  'js/core/utils.js',
  'js/core/period.js',
  'js/core/access.js',
  'js/core/vehicles.js',
  'js/core/maintenance.js',
  'js/core/warehouse.js',
  'js/core/fuel.js',
  'js/core/oil.js',
  'js/core/costs.js',
  'js/core/reports.js',
  'js/router.js',
];

function loadApp() {
  const sandbox = {
    console,
    document: { cookie: '', getElementById: () => null },
    fetch: async () => {
      throw new Error('fetch não configurado no teste');
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  }
  const api = name => vm.runInContext(name, sandbox);
  /* Cópia isolada do conjunto de dados original para cada teste. */
  const fresh = () => JSON.parse(JSON.stringify(api('DemoData.createSeed()')));
  return { sandbox, api, fresh };
}

module.exports = { loadApp, ROOT };

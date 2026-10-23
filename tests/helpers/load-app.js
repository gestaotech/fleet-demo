/*
 * Carrega os mesmos arquivos JavaScript que o index.html usa, em um contexto isolado (vm),
 * com LocalStorage e SessionStorage simulados. Assim os testes exercitam o código real do navegador.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

const FILES = [
  'js/data.js',
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

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    clear: () => data.clear(),
  };
}

function loadApp() {
  const sandbox = {
    console,
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
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

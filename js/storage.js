/*
 * Persistência local (LocalStorage) dos dados de demonstração.
 * Limitação: é armazenamento do próprio navegador, sem sincronização entre usuários.
 * Se o navegador bloquear o LocalStorage, os dados ficam apenas em memória até a recarga.
 *
 * Compatibilidade: dados salvos em versões anteriores (schemaVersion 1) são migrados
 * sem perder registros. Estruturas desconhecidas ou corrompidas voltam ao conjunto original.
 */
const Storage = (function () {
  const DATA_KEY = 'gestaotech.frota-demo.dados.v1';
  const SESSION_KEY = 'gestaotech.frota-demo.sessao';
  let memoryData = null;
  let memorySession = null;

  function hasLocalStorage() {
    try {
      const probe = '__gt_probe__';
      window.localStorage.setItem(probe, probe);
      window.localStorage.removeItem(probe);
      return true;
    } catch (error) {
      return false;
    }
  }

  const COLLECTIONS = ['usuarios', 'veiculos', 'pecas', 'movimentacoes', 'pecasExternas', 'manutencoes', 'despesas'];

  function hasCollections(data) {
    return Boolean(data) && COLLECTIONS.every(key => Array.isArray(data[key]));
  }

  /* Migrações de estrutura, aplicadas em sequência. Retorna null quando não é possível migrar. */
  function migrate(data) {
    if (!hasCollections(data)) return null;
    let changed = false;
    const version = Number(data.schemaVersion) || 0;

    if (version < 1) return null;

    if (version < 2) {
      /* v2: combustível, trocas de óleo, parâmetros e quilometragem de manutenção. */
      data.abastecimentos = Array.isArray(data.abastecimentos) ? data.abastecimentos : [];
      data.trocasOleo = Array.isArray(data.trocasOleo) ? data.trocasOleo : [];
      data.configuracoes = { ...DemoData.defaultConfiguracoes(), ...(data.configuracoes || {}) };
      data.manutencoes.forEach(m => {
        if (!('quilometragem' in m)) m.quilometragem = null;
      });
      /* Libera o novo módulo apenas para administradores ativos, evitando bloquear a gestão. */
      data.usuarios.forEach(u => {
        const isAdmin = u.ativo === true && Array.isArray(u.permissoes) && u.permissoes.includes('admin');
        if (isAdmin && !u.permissoes.includes('combustivel')) u.permissoes.push('combustivel');
      });
      data.schemaVersion = 2;
      changed = true;
    }

    if (!Array.isArray(data.abastecimentos) || !Array.isArray(data.trocasOleo)) return null;
    if (!data.configuracoes || typeof data.configuracoes !== 'object') {
      data.configuracoes = DemoData.defaultConfiguracoes();
      changed = true;
    }
    if (data.schemaVersion !== DemoData.SCHEMA_VERSION) {
      data.schemaVersion = DemoData.SCHEMA_VERSION;
      changed = true;
    }
    return { data, changed };
  }

  function readRaw() {
    return hasLocalStorage() ? window.localStorage.getItem(DATA_KEY) : (memoryData ? JSON.stringify(memoryData) : null);
  }

  function writeRaw(serialized) {
    if (hasLocalStorage()) {
      window.localStorage.setItem(DATA_KEY, serialized);
    } else {
      memoryData = JSON.parse(serialized);
    }
  }

  function load() {
    const raw = readRaw();
    if (raw) {
      try {
        const migrated = migrate(JSON.parse(raw));
        if (migrated) {
          if (migrated.changed) writeRaw(JSON.stringify(migrated.data));
          return migrated.data;
        }
      } catch (error) {
        /* Dados corrompidos: volta para os dados originais de demonstração. */
      }
    }
    return DemoData.createSeed();
  }

  function save(state) {
    state.schemaVersion = DemoData.SCHEMA_VERSION;
    const serialized = JSON.stringify(state);
    if (hasLocalStorage()) {
      try {
        window.localStorage.setItem(DATA_KEY, serialized);
        return { ok: true };
      } catch (error) {
        return { ok: false, errors: ['Não foi possível salvar no navegador (armazenamento cheio ou bloqueado).'] };
      }
    }
    memoryData = JSON.parse(serialized);
    return { ok: true };
  }

  function restoreSeed() {
    const seed = DemoData.createSeed();
    if (hasLocalStorage()) window.localStorage.removeItem(DATA_KEY);
    memoryData = null;
    return seed;
  }

  function saveSession(userId) {
    memorySession = userId;
    if (hasLocalStorage()) window.sessionStorage.setItem(SESSION_KEY, userId);
  }

  function readSession() {
    if (hasLocalStorage()) return window.sessionStorage.getItem(SESSION_KEY);
    return memorySession;
  }

  function clearSession() {
    memorySession = null;
    if (hasLocalStorage()) window.sessionStorage.removeItem(SESSION_KEY);
  }

  return { load, save, restoreSeed, saveSession, readSession, clearSession };
})();

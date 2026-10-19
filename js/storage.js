/*
 * Persistência local (LocalStorage) dos dados de demonstração.
 * Limitação: é armazenamento do próprio navegador, sem sincronização entre usuários.
 * Se o navegador bloquear o LocalStorage, os dados ficam apenas em memória até a recarga.
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

  function isValidState(data) {
    return Boolean(data) && data.schemaVersion === DemoData.SCHEMA_VERSION &&
      Array.isArray(data.usuarios) && Array.isArray(data.veiculos) && Array.isArray(data.pecas) &&
      Array.isArray(data.movimentacoes) && Array.isArray(data.pecasExternas) &&
      Array.isArray(data.manutencoes) && Array.isArray(data.despesas);
  }

  function load() {
    let raw = null;
    if (hasLocalStorage()) {
      raw = window.localStorage.getItem(DATA_KEY);
    } else {
      raw = memoryData ? JSON.stringify(memoryData) : null;
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (isValidState(parsed)) return parsed;
      } catch (error) {
        // Dados corrompidos: volta para os dados originais de demonstração.
      }
    }
    return DemoData.createSeed();
  }

  function save(state) {
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

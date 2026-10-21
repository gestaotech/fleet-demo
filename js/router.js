/*
 * Roteamento por hash (#/...). Função pura: decide página, redirecionamento,
 * exigência de login ou acesso negado. A renderização fica em app.js.
 */
const Router = (function () {
  const ROUTES = [
    { path: '/', page: 'home' },
    { path: '/login', page: 'login' },
    { path: '/admin', page: 'adminHome' },
    { path: '/admin/usuarios', page: 'adminUsers' },
    { path: '/admin/usuarios/novo', page: 'adminUserForm' },
    { path: '/admin/usuarios/:id', page: 'adminUserForm' },
    { path: '/admin/dados', page: 'adminData' },
    { path: '/admin/parametros', page: 'adminSettings' },
    { path: '/almoxarifado', redirect: '/almoxarifado/estoque' },
    { path: '/almoxarifado/estoque', page: 'warehouseStock' },
    { path: '/almoxarifado/estoque/novo', page: 'partForm' },
    { path: '/almoxarifado/estoque/entrada', page: 'entryForm' },
    { path: '/almoxarifado/estoque/:id/editar', page: 'partForm' },
    { path: '/almoxarifado/estoque/:id', page: 'partHistory' },
    { path: '/almoxarifado/retiradas', page: 'warehouseWithdrawals' },
    { path: '/almoxarifado/externas', page: 'warehouseExternal' },
    { path: '/veiculos', page: 'vehicleList' },
    { path: '/veiculos/novo', page: 'vehicleForm' },
    { path: '/veiculos/:id/editar', page: 'vehicleForm' },
    { path: '/veiculos/:id', page: 'vehicleDetail' },
    { path: '/manutencao', page: 'maintenanceList' },
    { path: '/manutencao/nova', page: 'maintenanceForm' },
    { path: '/manutencao/oleo', page: 'oilList' },
    { path: '/manutencao/oleo/nova', page: 'oilForm' },
    { path: '/manutencao/oleo/:id/editar', page: 'oilForm' },
    { path: '/manutencao/:id', page: 'maintenanceDetail' },
    { path: '/combustivel', page: 'fuelList' },
    { path: '/combustivel/novo', page: 'fuelForm' },
    { path: '/combustivel/:id/editar', page: 'fuelForm' },
    { path: '/relatorios', redirect: '/relatorios/geral' },
    { path: '/relatorios/geral', page: 'reportGeneral' },
    { path: '/relatorios/veiculos', page: 'reportVehicles' },
    { path: '/relatorios/almoxarifado', page: 'reportWarehouse' },
    { path: '/relatorios/retiradas', page: 'reportWithdrawals' },
    { path: '/relatorios/manutencoes', page: 'reportMaintenance' },
    { path: '/relatorios/combustivel', page: 'reportFuel' },
    { path: '/relatorios/trocas-oleo', page: 'reportOil' },
    { path: '/relatorios/completo', page: 'reportFull' },
  ];

  const MODULE_SEGMENTS = Access.MODULE_IDS;

  function normalizeHash(hash) {
    let path = String(hash || '').replace(/^#/, '');
    if (!path.startsWith('/')) path = `/${path}`;
    if (path.length > 1) path = path.replace(/\/+$/, '');
    return path || '/';
  }

  function matchRoute(path) {
    for (const route of ROUTES) {
      const pattern = route.path.split('/').filter(Boolean);
      const actual = path.split('/').filter(Boolean);
      if (pattern.length !== actual.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < pattern.length; i += 1) {
        if (pattern[i].startsWith(':')) {
          params[pattern[i].slice(1)] = decodeURIComponent(actual[i]);
        } else if (pattern[i] !== actual[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return { route, params };
    }
    return null;
  }

  function moduleOf(path) {
    const segment = path.split('/')[1];
    return MODULE_SEGMENTS.includes(segment) ? segment : null;
  }

  /* Retorna { kind: 'page'|'redirect'|'login'|'denied'|'notFound', ... } */
  function resolve(hash, user) {
    const path = normalizeHash(hash);
    const found = matchRoute(path);
    if (!found) return { kind: 'notFound', path };

    const moduleId = moduleOf(path);
    if (moduleId && !user) return { kind: 'login', next: `#${path}`, module: moduleId };
    if (moduleId && !Access.canAccess(user, moduleId)) return { kind: 'denied', module: moduleId };

    if (found.route.redirect) return { kind: 'redirect', to: `#${found.route.redirect}` };
    return { kind: 'page', page: found.route.page, params: found.params, path, module: moduleId };
  }

  return { ROUTES, normalizeHash, resolve, moduleOf };
})();

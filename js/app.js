/* Inicialização, casca da aplicação (cabeçalho, menu, rodapé), login e página inicial. */
const App = (function () {
  let state = null;
  let pendingHash = '#/';

  const PAGES = {
    adminHome: AdminScreens.home,
    adminUsers: AdminScreens.users,
    adminUserForm: AdminScreens.userForm,
    adminData: AdminScreens.dataPage,
    adminSettings: AdminScreens.settings,
    warehouseStock: WarehouseScreens.stock,
    partForm: WarehouseScreens.partForm,
    entryForm: WarehouseScreens.entryForm,
    partHistory: WarehouseScreens.partHistory,
    warehouseWithdrawals: WarehouseScreens.withdrawals,
    warehouseExternal: WarehouseScreens.external,
    vehicleList: VehicleScreens.list,
    vehicleForm: VehicleScreens.form,
    vehicleDetail: VehicleScreens.detail,
    maintenanceList: MaintenanceScreens.list,
    maintenanceForm: MaintenanceScreens.form,
    maintenanceDetail: MaintenanceScreens.detail,
    oilList: OilScreens.list,
    oilForm: OilScreens.form,
    fuelList: FuelScreens.list,
    fuelForm: FuelScreens.form,
    reportGeneral: ReportScreens.general,
    reportVehicles: ReportScreens.vehicles,
    reportWarehouse: ReportScreens.warehouse,
    reportWithdrawals: ReportScreens.withdrawals,
    reportMaintenance: ReportScreens.maintenances,
    reportFuel: ReportScreens.fuel,
    reportOil: ReportScreens.oil,
    reportFull: ReportScreens.full,
  };

  /* Abas horizontais por módulo. Relatórios usam menu lateral próprio. */
  const SECTIONS = {
    admin: [
      { label: 'Visão geral', href: '#/admin' },
      { label: 'Usuários e permissões', href: '#/admin/usuarios' },
      { label: 'Parâmetros', href: '#/admin/parametros' },
      { label: 'Dados da demonstração', href: '#/admin/dados' },
    ],
    almoxarifado: [
      { label: 'Estoque de peças', href: '#/almoxarifado/estoque' },
      { label: 'Retiradas', href: '#/almoxarifado/retiradas' },
      { label: 'Peças externas', href: '#/almoxarifado/externas' },
    ],
    veiculos: [
      { label: 'Frota', href: '#/veiculos' },
      { label: 'Novo veículo', href: '#/veiculos/novo' },
    ],
    manutencao: [
      { label: 'Manutenções', href: '#/manutencao' },
      { label: 'Nova manutenção', href: '#/manutencao/nova' },
      { label: 'Trocas de óleo', href: '#/manutencao/oleo' },
      { label: 'Nova troca de óleo', href: '#/manutencao/oleo/nova' },
    ],
    combustivel: [
      { label: 'Abastecimentos', href: '#/combustivel' },
      { label: 'Novo abastecimento', href: '#/combustivel/novo' },
    ],
    relatorios: [],
  };

  const HOME_CARDS = [
    { id: 'admin', numero: '1', titulo: 'Administrador', texto: 'Usuários, permissões de acesso, parâmetros e situação da frota.' },
    { id: 'almoxarifado', numero: '2', titulo: 'Almoxarifado', texto: 'Estoque de peças com pesquisa, entradas, retiradas e peças externas.' },
    { id: 'veiculos', numero: '3', titulo: 'Veículos', texto: 'Cadastro da frota e histórico integrado de cada veículo.' },
    { id: 'manutencao', numero: '4', titulo: 'Manutenção de veículos', texto: 'Manutenções com quilometragem e controle de trocas de óleo.' },
    { id: 'combustivel', numero: '5', titulo: 'Combustível', texto: 'Abastecimentos, preço por litro, gastos e consumo médio.' },
    { id: 'relatorios', numero: '6', titulo: 'Relatórios', texto: 'Oito relatórios, incluindo combustível e trocas de óleo.' },
  ];

  const ctx = {
    get state() { return state; },
    get user() { return currentUser(); },
    save() {
      const result = Storage.save(state);
      if (!result.ok) {
        UI.toast(result.errors[0], 'error');
        return false;
      }
      return true;
    },
    setState(next) {
      state = next;
      ctx.save();
    },
    go(hash) {
      if (location.hash === hash) route();
      else location.hash = hash;
    },
    refresh() { route(); },
    toast: UI.toast,
  };

  function currentUser() {
    const id = Storage.readSession();
    if (!id) return null;
    const user = state.usuarios.find(u => u.id === id);
    return user && user.ativo ? user : null;
  }

  function currentPath() {
    return Router.normalizeHash(location.hash);
  }

  function brandHtml() {
    return `<a class="brand" href="#/" aria-label="Início">
              <img src="assets/logo-tarcisio.jpeg" alt="Logo Tarcísio Araújo Transportes" class="brand-logo">
              <span class="brand-text"><strong>Tarcísio Araújo Transportes</strong><small>Demonstração de gestão de frota</small></span>
            </a>`;
  }

  function footerHtml() {
    return `<footer class="app-footer">
              <span>Desenvolvido por Gestão Tech</span>
              <span class="muted">Dados fictícios, apenas para demonstração.</span>
            </footer>`;
  }

  function headerHtml(user) {
    const account = user
      ? `<span class="user-chip">${UI.esc(user.nome)}</span><button type="button" class="btn btn-ghost btn-small" id="logout-btn">Sair</button>`
      : '<a class="btn btn-ghost btn-small" href="#/login">Entrar</a>';
    return `<header class="app-header">
              <button type="button" class="menu-toggle" id="menu-toggle" aria-label="Abrir menu">Menu</button>
              ${brandHtml()}
              <div class="header-account">${account}</div>
            </header>`;
  }

  function sidebarHtml(user) {
    const modules = Access.MODULES.filter(m => Access.canAccess(user, m.id));
    const links = [`<a href="#/">Início</a>`]
      .concat(modules.map(m => `<a href="#/${m.id}">${UI.esc(m.nome)}</a>`));
    return `<nav class="sidebar" id="sidebar" aria-label="Módulos">${links.join('')}</nav>`;
  }

  function sectionsHtml(moduleId, path) {
    const sections = SECTIONS[moduleId] || [];
    if (!sections.length) return '';
    const matches = sections.filter(s => path === s.href || path.startsWith(`${s.href}/`));
    const active = matches.sort((a, b) => b.href.length - a.href.length)[0];
    return `<nav class="section-tabs" aria-label="Seções do módulo">${sections.map(s =>
      `<a href="${s.href}" class="${s === active ? 'active' : ''}">${UI.esc(s.label)}</a>`).join('')}</nav>`;
  }

  function mount(html) {
    document.getElementById('app').innerHTML = html;
    const toggle = document.getElementById('menu-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => document.body.classList.toggle('nav-open'));
    }
    const logout = document.getElementById('logout-btn');
    if (logout) {
      logout.addEventListener('click', () => {
        Storage.clearSession();
        UI.toast('Sessão encerrada.');
        location.hash = '#/';
        route();
      });
    }
  }

  function renderPageWithShell(moduleId, path, render) {
    const user = currentUser();
    mount(`
      ${headerHtml(user)}
      <div class="app-body">
        ${sidebarHtml(user)}
        <div class="content">
          ${sectionsHtml(moduleId, path)}
          <div id="page-slot"></div>
        </div>
      </div>
      ${footerHtml()}`);
    const slot = document.getElementById('page-slot');
    const page = document.createElement('div');
    page.className = 'page';
    slot.appendChild(page);
    render(page);
    document.body.classList.remove('nav-open');
    window.scrollTo(0, 0);
  }

  function renderHome() {
    const user = currentUser();
    const cards = HOME_CARDS.map(card => {
      const allowed = Access.canAccess(user, card.id);
      const lock = user && !allowed ? '<span class="badge badge-muted">Sem permissão</span>' : '';
      return `<a class="module-card" href="#/${card.id}">
                <span class="module-number">${card.numero}</span>
                <span class="module-body"><strong>${UI.esc(card.titulo)}</strong><small>${UI.esc(card.texto)}</small></span>
                ${lock}
              </a>`;
    }).join('');
    mount(`
      ${headerHtml(user)}
      <main class="home">
        <section class="hero">
          <img src="assets/logo-tarcisio.jpeg" alt="Logo Tarcísio Araújo Transportes" class="hero-logo">
          <h1>Tarcísio Araújo Transportes</h1>
          <p>Sistema de gestão de frota, almoxarifado e manutenção</p>
          <span class="badge badge-info">Demonstração com dados fictícios</span>
        </section>
        <section class="module-grid" aria-label="Módulos">${cards}</section>
        ${user ? '' : '<p class="muted center">Entre para acessar os módulos. <a class="link" href="#/login">Entrar</a></p>'}
      </main>
      ${footerHtml()}`);
  }

  function renderLogin() {
    mount(`
      ${headerHtml(null)}
      <main class="login-wrap">
        <form class="card login-card" id="login-form" novalidate>
          <h1>Entrar na demonstração</h1>
          <div class="form-errors" id="login-errors"></div>
          <label class="field">Usuário<input name="login" autocomplete="username" required></label>
          <label class="field">Senha<input name="senha" type="password" autocomplete="current-password" required></label>
          <button class="btn btn-primary btn-block" type="submit">Entrar</button>
          <p class="hint">Acesso fictício de demonstração: usuário <code>admin</code>, senha <code>demo123</code>.
            Em produção, a autenticação ocorre no servidor.</p>
        </form>
      </main>
      ${footerHtml()}`);

    document.getElementById('login-form').addEventListener('submit', event => {
      event.preventDefault();
      const data = UI.readForm(event.currentTarget);
      const result = Access.authenticate(state, data.login, data.senha);
      if (!result.ok) {
        UI.showErrors(document.getElementById('login-errors'), result.errors);
        return;
      }
      Storage.saveSession(result.value.id);
      UI.toast(`Bem-vindo, ${result.value.nome}.`);
      const destination = pendingHash && pendingHash !== '#/login' ? pendingHash : '#/';
      pendingHash = '#/';
      location.hash = destination;
      if (location.hash === destination) route();
    });
  }

  function renderDenied(moduleId) {
    const module = Access.moduleById(moduleId);
    renderPageWithShell(moduleId, currentPath(), page => {
      page.innerHTML = `${UI.pageHeader('Acesso restrito')}
        <section class="card">
          <p>Seu perfil não tem permissão para o módulo <strong>${UI.esc(module ? module.nome : moduleId)}</strong>.</p>
          <p class="muted">Solicite ao administrador a liberação do módulo na tela de usuários e permissões.</p>
          <a class="btn btn-ghost" href="#/">Voltar à página inicial</a>
        </section>`;
    });
  }

  function route() {
    if (!state) return;
    const resolved = Router.resolve(location.hash, currentUser());

    if (resolved.kind === 'redirect') {
      location.replace(resolved.to);
      return;
    }
    if (resolved.kind === 'login') {
      pendingHash = resolved.next;
      renderLogin();
      return;
    }
    if (resolved.kind === 'denied') {
      renderDenied(resolved.module);
      return;
    }
    if (resolved.kind === 'notFound') {
      renderPageWithShell(null, resolved.path, page => {
        page.innerHTML = `${UI.pageHeader('Página não encontrada')}<p><a class="link" href="#/">Voltar à página inicial</a></p>`;
      });
      return;
    }
    if (resolved.page === 'home') {
      renderHome();
      return;
    }
    if (resolved.page === 'login') {
      renderLogin();
      return;
    }

    const screen = PAGES[resolved.page];
    renderPageWithShell(resolved.module, resolved.path, page => screen(page, resolved.params, ctx));
  }

  function start() {
    state = Storage.load();
    if (!location.hash) history.replaceState(null, '', '#/');
    window.addEventListener('hashchange', route);
    route();
  }

  return { start };
})();

document.addEventListener('DOMContentLoaded', App.start);

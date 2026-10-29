/*
 * Inicialização, casca da aplicação (cabeçalho, menu, rodapé), login e página inicial.
 *
 * Fluxo: GET /auth/session -> (se logado) GET /workspace -> renderização.
 * Toda gravação passa por uma fila: uma alteração só é confirmada ao usuário depois
 * que o servidor responde OK. Em conflito de revisão (409) as gravações são bloqueadas
 * até a página ser recarregada, para não sobrescrever dados de outro usuário.
 */
const App = (function () {
  let state = null;
  let revision = 0;
  let session = null;
  let loadError = '';
  let saveChain = Promise.resolve(true);
  let conflictBlocked = false;
  let syncBanner = '';
  let pendingHash = '#/';
  let recoveryKey = null;
  const CHAVE_RECUPERACAO = 'gestaotech.frota-demo.recuperacao.v1';

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
    warehouseUsedParts: WarehouseScreens.usedParts,
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
      { label: 'Administração do Sistema', href: '#/admin/dados' },
    ],
    almoxarifado: [
      { label: 'Estoque de peças', href: '#/almoxarifado/estoque' },
      { label: 'Retiradas', href: '#/almoxarifado/retiradas' },
      { label: 'Peças externas', href: '#/almoxarifado/externas' },
      { label: 'Peças usadas', href: '#/almoxarifado/usadas' },
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

  function currentUser() {
    if (!session) return null;
    return {
      id: session.usuario.id,
      nome: session.usuario.nome,
      ativo: true,
      permissoes: session.permissoes,
    };
  }

  /*
   * Grava o estado no servidor, uma gravação por vez. Resolve true somente quando o
   * servidor confirmou. Quem chama deve mostrar sucesso apenas quando o retorno for true.
   */
  function persist() {
    const job = saveChain.then(async () => {
      if (conflictBlocked) {
        UI.toast('Os dados foram alterados por outro usuário. Recarregue a página antes de continuar.', 'error');
        return false;
      }
      const result = await Storage.save(state, revision);
      if (result.ok) {
        revision = result.revision;
        syncBanner = '';
        refreshBanner();
        return true;
      }
      if (result.status === 401) {
        session = null;
        state = null;
        UI.toast('Sua sessão expirou. Entre novamente; a alteração não foi salva.', 'error');
        route();
        return false;
      }
      if (result.status === 409) {
        conflictBlocked = true;
        syncBanner = 'Os dados foram alterados por outro usuário. As gravações estão bloqueadas: recarregue a página para ver a versão atual.';
        // Preserva as alterações locais para que o usuário não as perca sem aviso.
        try {
          window.sessionStorage.setItem(CHAVE_RECUPERACAO, JSON.stringify({ revision, state, timestamp: new Date().toISOString() }));
          recoveryKey = CHAVE_RECUPERACAO;
        } catch (erro) {
          recoveryKey = null;
        }
      } else {
        syncBanner = `Não foi possível salvar: ${result.error.message} A alteração não foi gravada.`;
      }
      refreshBanner();
      UI.toast(result.status === 409 ? 'Dados desatualizados. Recarregue a página.' : `Não foi possível salvar: ${result.error.message}`, 'error');
      return false;
    });
    saveChain = job.catch(() => false);
    return job;
  }

  const ctx = {
    get state() { return state; },
    get user() { return currentUser(); },
    save() { return persist(); },
    setState(next) {
      state = next;
      return persist();
    },
    go(hash) {
      if (location.hash === hash) route();
      else location.hash = hash;
    },
    refresh() { route(); },
    toast: UI.toast,
  };

  function baixarAlteracoesNaoSalvas() {
    let bruto = null;
    try { bruto = window.sessionStorage.getItem(CHAVE_RECUPERACAO); } catch (erro) { bruto = null; }
    if (!bruto) {
      UI.toast('Nenhuma alteração local pendente para baixar.', 'error');
      return;
    }
    const blob = new Blob([bruto], { type: 'application/json; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const data = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `alteracoes-nao-salvas-${data}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    UI.toast('Arquivo com as alterações locais baixado.');
  }

  function refreshBanner() {
    const banner = document.getElementById('sync-banner');
    if (!banner) return;
    banner.hidden = !syncBanner;
    if (conflictBlocked && recoveryKey) {
      banner.innerHTML = `${UI.esc(syncBanner)}
        <span class="banner-actions">
          <button type="button" class="btn btn-small btn-ghost" id="banner-baixar">Baixar alterações não salvas</button>
          <button type="button" class="btn btn-small btn-primary" id="banner-recarregar">Recarregar</button>
        </span>`;
      const baixar = document.getElementById('banner-baixar');
      if (baixar) baixar.addEventListener('click', baixarAlteracoesNaoSalvas);
      const recarregar = document.getElementById('banner-recarregar');
      if (recarregar) recarregar.addEventListener('click', () => location.reload());
    } else {
      banner.textContent = syncBanner;
    }
  }

  function currentPath() {
    return Router.normalizeHash(location.hash);
  }

  function brandHtml() {
    return `<a class="brand" href="#/" aria-label="Início">
              <img src="assets/logo-tarcisio.jpeg" alt="Logo Tarcísio Araújo Transportes" class="brand-logo">
              <span class="brand-text"><strong>Tarcísio Araújo Transportes</strong><small>Sistema de gestão de frota</small></span>
            </a>`;
  }

  function footerHtml() {
    return `<footer class="app-footer">
              <span>Desenvolvido por Gestão Tech</span>
              <span class="muted">Gestão Tech</span>
            </footer>`;
  }

  function syncBannerHtml() {
    return `<div id="sync-banner" class="sync-banner" role="alert" ${syncBanner ? '' : 'hidden'}>${UI.esc(syncBanner)}</div>`;
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
    if (logout) logout.addEventListener('click', logout_);
  }

  async function logout_() {
    await Api.post('/auth/logout');
    session = null;
    state = null;
    revision = 0;
    conflictBlocked = false;
    syncBanner = '';
    UI.toast('Sessão encerrada.');
    location.hash = '#/';
    route();
  }

  function renderPageWithShell(moduleId, path, render) {
    const user = currentUser();
    mount(`
      ${headerHtml(user)}
      ${syncBannerHtml()}
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
      ${syncBannerHtml()}
      <main class="home">
        <section class="hero">
          <img src="assets/logo-tarcisio.jpeg" alt="Logo Tarcísio Araújo Transportes" class="hero-logo">
          <h1>Tarcísio Araújo Transportes</h1>
          <p>Sistema de gestão de frota, almoxarifado e manutenção</p>
          <span class="badge badge-info">Sistema operacional</span>
        </section>
        <section class="module-grid" aria-label="Módulos">${cards}</section>
        ${user ? '' : '<p class="muted center">Entre para acessar os módulos. <a class="link" href="#/login">Entrar</a></p>'}
      </main>
      ${footerHtml()}`);
  }

  function renderLogin(mensagem = '') {
    mount(`
      ${headerHtml(null)}
      <main class="login-wrap">
        <form class="card login-card" id="login-form" novalidate>
          <h1>Entrar no sistema</h1>
          <div class="form-errors" id="login-errors">${mensagem ? UI.esc(mensagem) : ''}</div>
          <label class="field">Usuário<input name="login" autocomplete="username" required></label>
          <label class="field">Senha<input name="senha" type="password" autocomplete="current-password" required></label>
          <button class="btn btn-primary btn-block" type="submit" id="login-submit">Entrar</button>
          <p class="hint">Use o usuário e a senha cadastrados pelo administrador do sistema.</p>
        </form>
      </main>
      ${footerHtml()}`);

    document.getElementById('login-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const botao = document.getElementById('login-submit');
      const errosEl = document.getElementById('login-errors');
      const data = UI.readForm(form);
      botao.disabled = true;
      botao.textContent = 'Entrando...';
      const resposta = await Api.post('/auth/login', { login: data.login, senha: data.senha });
      if (!resposta.ok) {
        botao.disabled = false;
        botao.textContent = 'Entrar';
        UI.showErrors(errosEl, [resposta.error.message]);
        return;
      }
      session = { usuario: resposta.data.usuario, empresa: resposta.data.empresa, permissoes: resposta.data.permissoes };
      await carregarEstado();
      if (!state) {
        renderLoadError();
        return;
      }
      UI.toast(`Bem-vindo, ${session.usuario.nome}.`);
      const destination = pendingHash && pendingHash !== '#/login' ? pendingHash : '#/';
      pendingHash = '#/';
      location.hash = destination;
      if (location.hash === destination) route();
    });
  }

  function renderLoadError() {
    mount(`
      ${headerHtml(currentUser())}
      <main class="login-wrap">
        <section class="card login-card">
          <h1>Não foi possível carregar os dados</h1>
          <p>${UI.esc(loadError || 'Verifique sua conexão e tente novamente.')}</p>
          <button type="button" class="btn btn-primary btn-block" id="retry-load">Tentar novamente</button>
        </section>
      </main>
      ${footerHtml()}`);
    document.getElementById('retry-load').addEventListener('click', async () => {
      await carregarEstado();
      route();
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
    if (session && !state) {
      renderLoadError();
      return;
    }
    if (!session && location.hash && Router.normalizeHash(location.hash) !== '/login') {
      pendingHash = location.hash;
    }
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

  async function carregarEstado() {
    const resultado = await Storage.load();
    if (!resultado.ok) {
      if (resultado.status === 401) {
        session = null;
        state = null;
        return;
      }
      loadError = resultado.error.message;
      state = null;
      return;
    }
    state = resultado.state;
    revision = resultado.revision;
    loadError = '';
    conflictBlocked = false;
  }

  async function start() {
    window.addEventListener('hashchange', route);
    document.getElementById('app').innerHTML = '<main class="login-wrap"><p class="muted center">Carregando…</p></main>';
    const sessao = await Api.get('/auth/session');
    if (sessao.ok) {
      session = { usuario: sessao.data.usuario, empresa: sessao.data.empresa, permissoes: sessao.data.permissoes };
      await carregarEstado();
    }
    if (!location.hash) history.replaceState(null, '', '#/');
    route();
  }

  return { start };
})();

document.addEventListener('DOMContentLoaded', App.start);

/* Telas do módulo Administrador: visão geral da frota, usuários e permissões, administração do sistema.
 * Usuários são lidos e gravados pela API (/api/v1/users). Senhas nunca voltam para o navegador. */
const AdminScreens = (function () {
  const { esc, kpi, pageHeader, table, situacaoBadge, operacionalBadge, errorBox, readForm, option } = UI;

  function home(main, params, ctx) {
    const s = Vehicles.summary(ctx.state);
    const rows = ctx.state.veiculos.map(v => [
      esc(v.placa),
      esc(v.marca),
      esc(v.identificacao),
      situacaoBadge(v.situacao),
      operacionalBadge(Vehicles.operationalStatus(ctx.state, v.id)),
      `<a class="link" href="#/veiculos/${esc(v.id)}">Ver detalhes</a>`,
    ]);
    main.innerHTML = `
      ${pageHeader('Administrador', 'Situação da frota calculada a partir dos cadastros.')}
      <section class="kpi-grid">
        ${kpi('Veículos cadastrados', s.total)}
        ${kpi('Veículos ativos', s.ativos)}
        ${kpi('Veículos inativos', s.inativos)}
        ${kpi('Em manutenção', s.emManutencao, 'Com manutenção aberta')}
      </section>
      <section class="card">
        <h2>Situação da frota</h2>
        ${table(
          [{ label: 'Placa' }, { label: 'Marca / modelo' }, { label: 'Identificação' }, { label: 'Cadastro' }, { label: 'Operacional' }, { label: '' }],
          rows,
        )}
      </section>`;
  }

  function users(main, params, ctx) {
    main.innerHTML = `
      ${pageHeader('Usuários e permissões', 'Usuários da empresa. As senhas são guardadas apenas como hash no servidor.',
        '<a class="btn btn-primary" href="#/admin/usuarios/novo">Novo usuário</a>')}
      <section class="card" id="users-card"><p class="muted">Carregando usuários…</p></section>`;
    const card = main.querySelector('#users-card');
    let lista = [];

    function render() {
      const rows = lista.map(u => [
        esc(u.nome),
        esc(u.cargo),
        `<code>${esc(u.login)}</code>`,
        u.ativo ? UI.badge('Ativo', 'ok') : UI.badge('Inativo', 'muted'),
        u.permissoes.length
          ? u.permissoes.map(p => UI.badge(Access.moduleById(p).nome, 'info')).join(' ')
          : UI.badge('Sem acesso', 'muted'),
        `<div class="row-actions">
           <a class="link" href="#/admin/usuarios/${esc(u.id)}">Editar</a>
           <button type="button" class="btn btn-small btn-ghost" data-toggle-user="${esc(u.id)}">${u.ativo ? 'Desativar' : 'Ativar'}</button>
         </div>`,
      ]);
      card.innerHTML = table(
        [{ label: 'Nome' }, { label: 'Cargo' }, { label: 'Acesso' }, { label: 'Situação' }, { label: 'Módulos permitidos' }, { label: '' }],
        rows,
      );
    }

    async function carregar() {
      const resposta = await Api.get('/users');
      if (!resposta.ok) {
        card.innerHTML = errorBox([resposta.error.message]);
        return;
      }
      lista = resposta.data;
      render();
    }

    main.addEventListener('click', async event => {
      const button = event.target.closest('[data-toggle-user]');
      if (!button) return;
      const user = lista.find(u => u.id === button.dataset.toggleUser);
      if (!user) return;
      const acao = user.ativo ? 'desativar' : 'ativar';
      if (!UI.confirmAction(`Deseja ${acao} o usuário ${user.nome}?`)) return;
      const resposta = await Api.patch(`/users/${user.id}`, { ativo: !user.ativo });
      if (!resposta.ok) {
        ctx.toast(resposta.error.message, 'error');
        return;
      }
      ctx.toast(`Usuário ${user.ativo ? 'desativado' : 'ativado'} com sucesso.`);
      await carregar();
    });

    carregar();
  }

  function userForm(main, params, ctx) {
    main.innerHTML = `${pageHeader('Carregando usuário')}`;

    async function montar() {
      const resposta = await Api.get('/users');
      if (!resposta.ok) {
        main.innerHTML = `${pageHeader('Não foi possível carregar')}${errorBox([resposta.error.message])}`;
        return;
      }
      const editing = params.id ? resposta.data.find(u => u.id === params.id) : null;
      if (params.id && !editing) {
        main.innerHTML = `${pageHeader('Usuário não encontrado')}<p><a class="link" href="#/admin/usuarios">Voltar à lista</a></p>`;
        return;
      }
      const current = editing || { nome: '', cargo: '', login: '', ativo: true, permissoes: [] };
      const permissionCheckboxes = Access.MODULES.map(m => `
        <label class="check-card">
          <input type="checkbox" name="permissoes" value="${esc(m.id)}" ${current.permissoes.includes(m.id) ? 'checked' : ''}>
          <span><strong>${esc(m.nome)}</strong><small>${esc(m.descricao)}</small></span>
        </label>`).join('');

      main.innerHTML = `
        ${pageHeader(editing ? `Editar usuário ${editing.nome}` : 'Novo usuário', 'Os dados são gravados no servidor da empresa.')}
        <form class="card form-grid" id="user-form" novalidate>
          <div id="form-errors" class="full"></div>
          <label class="field">Nome do usuário<input name="nome" required value="${esc(current.nome)}"></label>
          <label class="field">Cargo ou função<input name="cargo" required value="${esc(current.cargo)}"></label>
          <label class="field">Usuário de acesso<input name="login" required autocomplete="off" value="${esc(current.login)}" ${editing ? 'readonly' : ''}>
            ${editing ? '<span class="hint">O usuário de acesso não pode ser alterado.</span>' : ''}</label>
          <label class="field">Senha<input name="senha" type="password" autocomplete="new-password" ${editing ? '' : 'required'}
            placeholder="${editing ? 'Deixe em branco para manter' : 'Mínimo de 10 caracteres'}"></label>
          <label class="check full"><input type="checkbox" name="ativo" ${current.ativo ? 'checked' : ''}> Usuário ativo</label>
          <fieldset class="full">
            <legend>Permissões de acesso aos módulos</legend>
            <div class="check-grid">${permissionCheckboxes}</div>
          </fieldset>
          <div class="form-actions full">
            <a class="btn btn-ghost" href="#/admin/usuarios">Cancelar</a>
            <button class="btn btn-primary" type="submit" id="user-submit">${editing ? 'Salvar alterações' : 'Cadastrar usuário'}</button>
          </div>
        </form>`;

      main.querySelector('#user-form').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const botao = main.querySelector('#user-submit');
        const dados = readForm(form);
        const permissoes = Array.isArray(dados.permissoes) ? dados.permissoes : [];
        const corpo = { nome: dados.nome, cargo: dados.cargo, permissoes, ativo: Boolean(dados.ativo) };
        if (dados.senha) corpo.senha = dados.senha;

        botao.disabled = true;
        const resultado = editing
          ? await Api.patch(`/users/${editing.id}`, corpo)
          : await Api.post('/users', { ...corpo, login: dados.login, senha: dados.senha || '' });
        if (!resultado.ok) {
          botao.disabled = false;
          const mensagens = (resultado.error.campos && resultado.error.campos.length) ? resultado.error.campos : [resultado.error.message];
          UI.showErrors(main.querySelector('#form-errors'), mensagens);
          return;
        }
        ctx.toast(editing ? 'Usuário atualizado.' : 'Usuário cadastrado.');
        ctx.go('#/admin/usuarios');
      });
    }

    montar();
  }

  function settings(main, params, ctx) {
    const conf = Oil.configuracoes(ctx.state);
    main.innerHTML = `
      ${pageHeader('Parâmetros da empresa', 'Regras que podem ser ajustadas sem alterar o código.')}
      <form class="card form-grid" id="settings-form" novalidate>
        <div class="form-errors full" id="form-errors"></div>
        <label class="field">Antecedência do alerta de troca de óleo (km)
          <input name="alertaTrocaOleoKm" type="number" min="0" step="1" inputmode="numeric" required value="${esc(conf.alertaTrocaOleoKm)}">
          <span class="hint">A troca entra em "Próxima da troca" quando faltam estes km ou menos. Valor padrão: 1000 km.</span>
        </label>
        <label class="field">Antecedência do alerta de troca de óleo (dias)
          <input name="alertaTrocaOleoDias" type="number" min="0" step="1" inputmode="numeric" required value="${esc(conf.alertaTrocaOleoDias)}">
          <span class="hint">Considera o intervalo em meses informado em cada troca. Valor padrão: 30 dias.</span>
        </label>
        <p class="hint full">O sistema não define um intervalo universal de troca: os intervalos em quilômetros e em meses são informados em cada registro.</p>
        <div class="form-actions full">
          <button class="btn btn-primary" type="submit">Salvar parâmetros</button>
        </div>
      </form>`;
    main.querySelector('#settings-form').addEventListener('submit', event => {
      event.preventDefault();
      const data = readForm(event.currentTarget);
      const km = Utils.parseInteger(data.alertaTrocaOleoKm);
      const dias = Utils.parseInteger(data.alertaTrocaOleoDias);
      const errors = [];
      if (!Number.isInteger(km) || km < 0) errors.push('Informe a antecedência em quilômetros como número inteiro (zero ou maior).');
      if (!Number.isInteger(dias) || dias < 0) errors.push('Informe a antecedência em dias como número inteiro (zero ou maior).');
      if (errors.length) {
        UI.showErrors(main.querySelector('#form-errors'), errors);
        return;
      }
      ctx.state.configuracoes = { alertaTrocaOleoKm: km, alertaTrocaOleoDias: dias };
      ctx.save().then(ok => {
        if (!ok) return;
        ctx.toast('Parâmetros atualizados.');
        ctx.refresh();
      });
    });
  }

  function dataPage(main, params, ctx) {
    main.innerHTML = `
      ${pageHeader('Dados e inicialização', 'Restaurar ou inicializar os dados operacionais da empresa.')}
      <section class="card">
        <h2>Restaurar dados originais</h2>
        <p>Substitui os dados operacionais desta empresa pelo conjunto inicial de dados, gravado no servidor.</p>
        <button type="button" class="btn btn-danger" id="restore-data">Restaurar dados originais</button>
      </section>
      <section class="card">
        <h2>Informações sobre este sistema</h2>
        <ul>
          <li>Os dados ficam no banco da empresa, sem dados reais de clientes.</li>
          <li>Ao gravar, o sistema confirma a alteração apenas depois da resposta do servidor.</li>
          <li>Se outro usuário alterar os dados ao mesmo tempo, a gravação é recusada e a página deve ser recarregada.</li>
        </ul>
      </section>`;
    main.querySelector('#restore-data').addEventListener('click', () => {
      if (!UI.confirmAction('Restaurar todos os dados para o conjunto original? As alterações feitas serão perdidas.')) return;
      const semente = DemoData.createSeed();
      delete semente.usuarios;
      ctx.setState(semente).then(ok => {
        if (!ok) return;
        ctx.toast('Dados originais restaurados.');
        ctx.refresh();
      });
    });
  }

  return { home, users, userForm, settings, dataPage };
})();

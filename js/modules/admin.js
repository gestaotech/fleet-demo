/* Telas do módulo Administrador: visão geral da frota, usuários e permissões, dados da demonstração. */
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
    const rows = ctx.state.usuarios.map(u => [
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
    main.innerHTML = `
      ${pageHeader('Usuários e permissões', 'Usuários fictícios de demonstração. O controle de acesso é simulado no navegador.',
        '<a class="btn btn-primary" href="#/admin/usuarios/novo">Novo usuário</a>')}
      <section class="card">
        ${table(
          [{ label: 'Nome' }, { label: 'Cargo' }, { label: 'Acesso' }, { label: 'Situação' }, { label: 'Módulos permitidos' }, { label: '' }],
          rows,
        )}
      </section>
      <p class="muted small">Senhas de demonstração ficam em texto simples no navegador. Não use senhas reais.</p>`;

    main.addEventListener('click', event => {
      const button = event.target.closest('[data-toggle-user]');
      if (!button) return;
      const user = ctx.state.usuarios.find(u => u.id === button.dataset.toggleUser);
      const acao = user.ativo ? 'desativar' : 'ativar';
      if (!UI.confirmAction(`Deseja ${acao} o usuário ${user.nome}?`)) return;
      const result = Access.setUserActive(ctx.state, user.id, !user.ativo);
      if (!result.ok) {
        ctx.toast(result.errors[0], 'error');
        return;
      }
      ctx.save();
      ctx.toast(`Usuário ${user.ativo ? 'desativado' : 'ativado'} com sucesso.`);
      ctx.refresh();
    });
  }

  function userForm(main, params, ctx) {
    const editing = params.id ? ctx.state.usuarios.find(u => u.id === params.id) : null;
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
      ${pageHeader(editing ? `Editar usuário ${editing.nome}` : 'Novo usuário', 'Dados fictícios de demonstração.')}
      <form class="card form-grid" id="user-form" novalidate>
        <div id="form-errors" class="full"></div>
        <label class="field">Nome do usuário<input name="nome" required value="${esc(current.nome)}"></label>
        <label class="field">Cargo ou função<input name="cargo" required value="${esc(current.cargo)}"></label>
        <label class="field">Usuário de acesso<input name="login" required autocomplete="off" value="${esc(current.login)}"></label>
        <label class="field">Senha de demonstração<input name="senha" type="password" autocomplete="new-password" ${editing ? '' : 'required'} placeholder="${editing ? 'Deixe em branco para manter' : 'Mínimo de 6 caracteres'}"></label>
        <label class="check full"><input type="checkbox" name="ativo" ${current.ativo ? 'checked' : ''}> Usuário ativo</label>
        <fieldset class="full">
          <legend>Permissões de acesso aos módulos</legend>
          <div class="check-grid">${permissionCheckboxes}</div>
        </fieldset>
        <div class="form-actions full">
          <a class="btn btn-ghost" href="#/admin/usuarios">Cancelar</a>
          <button class="btn btn-primary" type="submit">${editing ? 'Salvar alterações' : 'Cadastrar usuário'}</button>
        </div>
      </form>`;

    main.querySelector('#user-form').addEventListener('submit', event => {
      event.preventDefault();
      const result = Access.saveUser(ctx.state, readForm(event.currentTarget), editing ? editing.id : null);
      if (!result.ok) {
        UI.showErrors(main.querySelector('#form-errors'), result.errors);
        return;
      }
      ctx.save();
      ctx.toast(editing ? 'Usuário atualizado.' : 'Usuário cadastrado.');
      ctx.go('#/admin/usuarios');
    });
  }

  function settings(main, params, ctx) {
    const conf = Oil.configuracoes(ctx.state);
    main.innerHTML = `
      ${pageHeader('Parâmetros da demonstração', 'Regras que podem ser ajustadas sem alterar o código.')}
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
      ctx.save();
      ctx.toast('Parâmetros atualizados.');
      ctx.refresh();
    });
  }

  function dataPage(main, params, ctx) {
    main.innerHTML = `
      ${pageHeader('Dados da demonstração', 'Todos os dados são fictícios e servem apenas para apresentação.')}
      <section class="card">
        <h2>Restaurar dados originais</h2>
        <p>As alterações feitas durante a demonstração ficam salvas neste navegador. Use a opção abaixo para voltar ao conjunto inicial de dados fictícios.</p>
        <button type="button" class="btn btn-danger" id="restore-data">Restaurar dados originais</button>
      </section>
      <section class="card">
        <h2>Limitações desta demonstração</h2>
        <ul>
          <li>Dados armazenados apenas no navegador (LocalStorage), sem sincronização entre usuários.</li>
          <li>Login e permissões são simulados e não oferecem segurança de produção.</li>
          <li>Nenhum sistema externo, banco de dados ou informação real do cliente é utilizado.</li>
        </ul>
      </section>`;
    main.querySelector('#restore-data').addEventListener('click', () => {
      if (!UI.confirmAction('Restaurar todos os dados para o conjunto original? As alterações feitas serão perdidas.')) return;
      ctx.setState(Storage.restoreSeed());
      ctx.toast('Dados originais restaurados.');
      ctx.refresh();
    });
  }

  return { home, users, userForm, settings, dataPage };
})();

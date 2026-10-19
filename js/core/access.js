/*
 * Usuários e permissões de DEMONSTRAÇÃO.
 * ATENÇÃO: este controle roda no navegador. Senhas ficam em texto simples no LocalStorage.
 * Não é segurança de produção: a autenticação definitiva deve ocorrer no servidor,
 * com credenciais armazenadas de forma segura e autorização validada pelo backend.
 */
const Access = (function () {
  const MODULES = [
    { id: 'admin', nome: 'Administrador', descricao: 'Usuários, permissões e situação da frota' },
    { id: 'almoxarifado', nome: 'Almoxarifado', descricao: 'Estoque, entradas, retiradas e peças externas' },
    { id: 'veiculos', nome: 'Veículos', descricao: 'Cadastro da frota e histórico por veículo' },
    { id: 'manutencao', nome: 'Manutenção', descricao: 'Ordens de manutenção e custos' },
    { id: 'relatorios', nome: 'Relatórios', descricao: 'Consultas e relatórios consolidados' },
  ];
  const MODULE_IDS = MODULES.map(m => m.id);
  const MIN_SENHA = 6;
  const LOGIN_PATTERN = /^[a-z0-9._-]{3,20}$/i;

  function moduleById(id) {
    return MODULES.find(m => m.id === id) || null;
  }

  function canAccess(user, moduleId) {
    return Boolean(user) && user.ativo === true && Array.isArray(user.permissoes) && user.permissoes.includes(moduleId);
  }

  function isActiveAdmin(user) {
    return canAccess(user, 'admin');
  }

  function countOtherActiveAdmins(state, exceptId) {
    return state.usuarios.filter(u => u.id !== exceptId && isActiveAdmin(u)).length;
  }

  function authenticate(state, login, senha) {
    const typed = Utils.normalizeText(login).toLowerCase();
    const user = state.usuarios.find(u => u.login.toLowerCase() === typed);
    if (!user || user.senha !== senha) {
      return { ok: false, errors: ['Usuário ou senha inválidos.'] };
    }
    if (!user.ativo) {
      return { ok: false, errors: ['Este usuário está inativo. Procure o administrador.'] };
    }
    return { ok: true, value: user };
  }

  function validateUser(state, data, editingId) {
    const errors = [];
    const nome = Utils.normalizeText(data.nome);
    const cargo = Utils.normalizeText(data.cargo);
    const login = Utils.normalizeText(data.login);
    const senha = String(data.senha ?? '');
    const permissoes = (data.permissoes || []).filter(p => MODULE_IDS.includes(p));

    if (nome.length < 3) errors.push('Informe o nome do usuário (mínimo de 3 caracteres).');
    if (!cargo) errors.push('Informe o cargo ou função.');
    if (!LOGIN_PATTERN.test(login)) {
      errors.push('Usuário de acesso deve ter de 3 a 20 caracteres: letras, números, ponto, hífen ou sublinhado.');
    } else if (state.usuarios.some(u => u.id !== editingId && u.login.toLowerCase() === login.toLowerCase())) {
      errors.push('Já existe um usuário com este acesso.');
    }
    if (!editingId && !senha) errors.push('Informe a senha de demonstração.');
    if (senha && senha.length < MIN_SENHA) errors.push(`A senha deve ter pelo menos ${MIN_SENHA} caracteres.`);

    return {
      errors,
      value: { nome, cargo, login, ativo: Boolean(data.ativo), permissoes, senha: senha || null },
    };
  }

  function saveUser(state, data, id) {
    const checked = validateUser(state, data, id);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    const { value } = checked;

    if (id) {
      const user = state.usuarios.find(u => u.id === id);
      if (!user) return { ok: false, errors: ['Usuário não encontrado.'] };
      const remainsAdmin = value.ativo && value.permissoes.includes('admin');
      if (isActiveAdmin(user) && !remainsAdmin && countOtherActiveAdmins(state, id) === 0) {
        return { ok: false, errors: ['Mantenha ao menos um administrador ativo.'] };
      }
      Object.assign(user, { nome: value.nome, cargo: value.cargo, login: value.login, ativo: value.ativo, permissoes: value.permissoes });
      if (value.senha) user.senha = value.senha;
      return { ok: true, value: user };
    }

    const user = {
      id: Utils.nextId('USR', state.usuarios, 3),
      nome: value.nome,
      cargo: value.cargo,
      login: value.login,
      senha: value.senha,
      ativo: value.ativo,
      permissoes: value.permissoes,
    };
    state.usuarios.push(user);
    return { ok: true, value: user };
  }

  function setUserActive(state, id, ativo) {
    const user = state.usuarios.find(u => u.id === id);
    if (!user) return { ok: false, errors: ['Usuário não encontrado.'] };
    if (!ativo && isActiveAdmin(user) && countOtherActiveAdmins(state, id) === 0) {
      return { ok: false, errors: ['Não é possível desativar o último administrador ativo.'] };
    }
    user.ativo = ativo;
    return { ok: true, value: user };
  }

  return { MODULES, MODULE_IDS, moduleById, canAccess, authenticate, validateUser, saveUser, setUserActive };
})();

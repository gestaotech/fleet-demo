/*
 * Módulos do sistema e verificação de acesso usada pela INTERFACE (menus e rotas).
 *
 * Ocultar um menu não é segurança. A autorização real está no servidor: cada endpoint
 * valida a sessão e o módulo necessário antes de ler ou gravar qualquer dado. Esta
 * verificação apenas evita mostrar telas que o servidor recusaria.
 *
 * Autenticação, usuários e senhas são tratados exclusivamente pela API (/api/v1/auth
 * e /api/v1/users). Nada disso existe no navegador.
 */
const Access = (function () {
  const MODULES = [
    { id: 'admin', nome: 'Administrador', descricao: 'Usuários, permissões e parâmetros da empresa' },
    { id: 'almoxarifado', nome: 'Almoxarifado', descricao: 'Estoque, entradas, retiradas e peças externas' },
    { id: 'veiculos', nome: 'Veículos', descricao: 'Cadastro da frota e histórico por veículo' },
    { id: 'manutencao', nome: 'Manutenção', descricao: 'Ordens de manutenção, trocas de óleo e custos' },
    { id: 'combustivel', nome: 'Combustível', descricao: 'Abastecimentos, consumo médio e gastos' },
    { id: 'relatorios', nome: 'Relatórios', descricao: 'Consultas e relatórios consolidados' },
  ];
  const MODULE_IDS = MODULES.map(m => m.id);

  function moduleById(id) {
    return MODULES.find(m => m.id === id) || null;
  }

  /* `user.permissoes` vem da sessão validada pelo servidor (GET /auth/session). */
  function canAccess(user, moduleId) {
    return Boolean(user) && user.ativo === true && Array.isArray(user.permissoes) && user.permissoes.includes(moduleId);
  }

  return { MODULES, MODULE_IDS, moduleById, canAccess };
})();

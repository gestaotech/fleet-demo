# Demonstração de Gestão de Frota – Tarcísio Araújo Transportes

Protótipo funcional para apresentação e aprovação do cliente **Tarcísio Araújo Transportes**.
Desenvolvido por **Gestão Tech**.

> **Todos os dados são fictícios.** Placas no padrão `DEM…`, nomes de pessoas, peças e valores foram inventados
> para a demonstração. Nenhum dado real do cliente é usado, e nenhum banco de dados, API externa ou sistema
> financeiro é acessado.

Tecnologias: HTML5, CSS3 e JavaScript puro (Vanilla JS), com LocalStorage para persistência local.
Não há dependências de terceiros: não há React, Next.js, TypeScript nem pacotes npm em tempo de execução.

---

## 1. Como executar

Há duas formas, ambas sem instalação:

1. **Abrir diretamente:** dê dois cliques em `index.html`.
2. **Servidor local** (Node.js 22 ou superior):
   ```bash
   npm start
   ```
   Depois acesse `http://localhost:8080`.

### Acesso de demonstração

| Usuário | Senha | Módulos liberados |
|---|---|---|
| `admin` | `demo123` | Todos (Administrador, Almoxarifado, Veículos, Manutenção, Relatórios) |
| `almoxarifado` | `demo123` | Almoxarifado |
| `oficina` | `demo123` | Veículos e Manutenção |
| `gerencia` | `demo123` | Veículos e Relatórios |
| `juliana` | `demo123` | Usuário inativo (não consegue entrar) |

### Testes

```bash
npm test
```

Executa 55 testes automatizados com o runner nativo do Node (`node:test`). Os testes carregam os mesmos
arquivos JavaScript usados pelo navegador, dentro de um contexto isolado.

---

## 2. Estrutura do projeto

```
index.html                 Estrutura principal e ordem de carregamento dos scripts
css/styles.css             Identidade visual, layout responsivo e estilos de impressão
js/
  data.js                  Dados fictícios de demonstração (conjunto original)
  storage.js               Leitura e gravação no LocalStorage; restauração dos dados originais
  router.js                Roteamento por hash (#/...), permissões e redirecionamentos (função pura)
  app.js                   Inicialização, cabeçalho, menu, login e página inicial
  ui.js                    Auxiliares de apresentação (escape de HTML, tabelas, avisos)
  core/                    REGRAS DE NEGÓCIO (funções puras, sem DOM)
    utils.js               Datas, valores em reais, identificadores, período
    access.js              Usuários, autenticação simulada e permissões por módulo
    vehicles.js            Cadastro de veículos e situação operacional
    maintenance.js         Abertura, início, conclusão e despesas de manutenção
    warehouse.js           Estoque, entradas, retiradas e peças externas
    costs.js               Cálculo de custos por veículo, manutenção e frota
    reports.js             Montagem dos dados dos relatórios e exportação CSV
  modules/                 TELAS (apresentação de cada módulo)
    admin.js, warehouse.js, vehicles.js, maintenance.js, reports.js
assets/logo-tarcisio.jpeg  Logo do cliente
scripts/serve.js           Servidor estático local (opcional)
tests/                     Testes automatizados
```

**Separação de responsabilidades:** as telas chamam funções de `core/`, que validam, alteram o estado e
retornam `{ ok, value }` ou `{ ok: false, errors }`. As telas nunca calculam saldos ou custos diretamente.

---

## 3. Módulos e comportamento

### 3.1 Página inicial
Cinco opções de acesso: Administrador, Almoxarifado, Veículos, Manutenção de veículos e Relatórios.
Cada módulo tem menu e abas próprias, e o logotipo sempre leva de volta à página inicial.

### 3.2 Administrador
- **Visão geral:** indicadores de veículos cadastrados, ativos, inativos e em manutenção, com lista da frota e link para os detalhes.
- **Usuários e permissões:** cadastrar, editar, ativar e desativar usuários; conceder ou retirar acesso a cada módulo.
- **Dados da demonstração:** restaurar os dados fictícios originais (apaga as alterações feitas no navegador).

### 3.3 Almoxarifado
- **Estoque de peças:** cadastro com código, descrição, valor unitário, estoque mínimo e data de entrada.
  Pesquisa por código ou descrição, filtro por situação (estoque baixo ou zerado) e histórico de movimentações por peça.
- **Entradas:** aumentam o saldo e são registradas com quantidade, data, valor unitário da entrada, responsável e observação.
- **Retiradas:** peça, veículo de destino, manutenção vinculada (opcional), quantidade, data, responsável e observação.
  Valida saldo disponível, veículo ativo e manutenção aberta do mesmo veículo.
- **Peças externas:** peças usadas em veículos que não estavam no estoque. Não alteram o saldo; entram nos custos do veículo.

### 3.4 Veículos
- **Frota:** lista com pesquisa e filtros por situação cadastral e operacional.
- **Cadastro:** marca, número de identificação interno, placa, data de entrada na frota e situação (Ativo/Inativo).
- **Detalhe do veículo:** dados cadastrais, situação operacional, histórico de manutenções, peças do almoxarifado,
  peças externas, despesas e total gasto.

### 3.5 Manutenção
- **Abertura:** veículo ativo, data e hora de entrada, problema, observações e responsável. Recebe código próprio (`MNT-0001`…).
- **Acompanhamento:** situações Aberta → Em andamento → Concluída. Filtros por veículo, situação e período de entrada.
- **Itens:** retirada do almoxarifado, peça externa e despesa (mão de obra ou serviço), registradas dentro da manutenção.
- **Conclusão:** registra a data e hora de conclusão. Não altera o cadastro do veículo (Ativo/Inativo).
- **Histórico:** linha do tempo com todos os eventos da manutenção.

### 3.6 Relatórios
Menu lateral com seis relatórios, cada um com filtros, resultados e exportação CSV:
1. **Geral da frota:** totais, situação, manutenções abertas e gastos acumulados.
2. **Veículos:** relação com situação e custo total no período.
3. **Almoxarifado:** saldos, valor estimado, entradas, retiradas e estoque baixo.
4. **Retiradas:** filtros por período, veículo e peça; valor de cada retirada.
5. **Manutenções:** custos separados por peças, despesas e total.
6. **Completo:** visão consolidada por seções, com impressão pelo navegador (Imprimir).

---

## 4. Regras de negócio e cálculos

Estas regras devem ser preservadas na migração para a arquitetura definitiva.

### 4.1 Estoque
- **Saldo** = soma das entradas − soma das retiradas. Nunca é digitado nem armazenado separadamente.
- **Saldo nunca negativo:** retirada acima do saldo é recusada. Retirada igual ao saldo é permitida.
- **Quantidades** são números inteiros maiores que zero.
- **Estoque baixo:** saldo menor ou igual ao estoque mínimo da peça.
- **Valor estimado do estoque** = saldo × valor unitário de referência. É uma **estimativa**.
- Editar o cadastro de uma peça **não altera** movimentações nem valores já registrados.

### 4.2 Valores históricos
- Cada **retirada** grava o valor unitário vigente no momento. Alterar o preço depois não muda relatórios antigos.
- Cada **entrada** grava o valor unitário informado para aquela entrada.

### 4.3 Custos de manutenção (sem duplicidade)
Cada item de custo existe uma única vez e é somado a partir do registro de origem:
- **Peças do almoxarifado** = soma de (quantidade × valor unitário) das retiradas.
- **Peças externas** = soma de (quantidade × valor unitário) dos registros externos.
- **Outras despesas** = soma dos valores das despesas registradas na manutenção.
- **Custo total** = peças do almoxarifado + peças externas + outras despesas.
- **Custo de um veículo** = custos de todas as suas manutenções, mais retiradas diretas e peças externas sem manutenção.
- **Custo da frota** = soma dos custos de todos os veículos (verificado por teste).

### 4.4 Situação de veículos
- **Cadastral:** Ativo ou Inativo, informada pelo usuário.
- **Operacional:** "Em manutenção" quando há manutenção Aberta ou Em andamento; caso contrário, "Disponível". É calculada.
- As duas situações são independentes. Concluir uma manutenção não altera a situação cadastral.

### 4.5 Manutenção
- Fluxo: Aberta → Em andamento → Concluída (também é permitido Aberta → Concluída).
- Peças, peças externas e despesas só podem ser registradas enquanto a manutenção estiver aberta.
- A data de conclusão não pode ser anterior à data de entrada.
- Um veículo pode ter mais de uma manutenção aberta ao mesmo tempo.

### 4.6 Períodos
- Filtros de período comparam apenas o dia (`AAAA-MM-DD`), inclusive nas datas com hora.

### 4.7 Exportação CSV
- Separador `;`, codificação UTF-8 com BOM (abre corretamente no Excel em português).
- Números com vírgula decimal e aspas quando o texto contém `;`, aspas ou quebra de linha.

---

## 5. Persistência e restauração

- Os dados ficam no **LocalStorage** do navegador, na chave `gestaotech.frota-demo.dados.v1`.
- A sessão de login fica no **SessionStorage** (dura enquanto a aba estiver aberta).
- **Restaurar dados originais:** Administrador → Dados da demonstração.
- Se o navegador bloquear o armazenamento, os dados ficam apenas em memória até a recarga.
- Dados corrompidos ou de outra versão do esquema são substituídos pelo conjunto original.

---

## 6. Limitações conhecidas

- **Segurança:** o login e as permissões são **simulados no navegador**. Qualquer pessoa com acesso ao navegador pode
  alterar os dados ou as permissões. Não use para dados reais.
- **Senhas:** são armazenadas em texto simples no LocalStorage, somente para demonstração.
- **Sem sincronização:** cada navegador tem sua própria cópia dos dados. Não há compartilhamento entre usuários.
- **Sem auditoria:** o histórico registra movimentações, mas não identifica o usuário logado que as executou.
- **Duplo envio:** formulários de retirada bloqueiam o segundo envio na própria tela, mas não há proteção
  no armazenamento contra registros repetidos feitos de propósito em outra aba.
- **Impressão:** a impressão depende do navegador; o PDF é gerado pela função de impressão do sistema.
- **Valor do estoque:** é uma estimativa, não um valor contábil.

---

## 7. Preparação para a implementação definitiva

Para a versão oficial da Gestão Tech, a arquitetura deve prever:

- **Autenticação e autorização no servidor**, com credenciais armazenadas de forma segura (hash de senha) e
  permissões validadas a cada requisição.
- **Persistência no servidor** com transações, para que retiradas e saldos sejam atômicos.
- **Isolamento entre empresas** (multiempresa), com dados sempre filtrados pelo tenant do usuário.
- **Auditoria:** quem fez cada operação, quando e o valor anterior.
- **APIs bem definidas** para integração com outros sistemas da Gestão Tech.

### Entidades e relacionamentos

| Entidade | Campos principais | Relacionamentos |
|---|---|---|
| `usuarios` | id, nome, cargo, login, senha, ativo, permissoes[] | — |
| `veiculos` | id, marca, identificacao, placa, dataEntrada, situacao | — |
| `pecas` | id, codigo, descricao, valorUnitario, estoqueMinimo, dataEntrada | — |
| `movimentacoes` | id, tipo (Entrada/Saida), pecaId, quantidade, valorUnitario, data, veiculoId?, manutencaoId?, responsavel, observacao | peça; veículo e manutenção (saídas) |
| `manutencoes` | id, veiculoId, dataEntrada, dataConclusao, status, descricaoProblema, observacoes, responsavel, historico[] | veículo |
| `pecasExternas` | id, veiculoId, manutencaoId?, descricao, quantidade, valorUnitario, data, responsavel, motivo | veículo; manutenção |
| `despesas` | id, manutencaoId, descricao, valor, data | manutenção |

---

## 8. Pontos a aprovar pelo cliente

As regras abaixo foram definidas para a demonstração e precisam ser confirmadas:

1. Veículo **inativo** não recebe retiradas, peças externas nem novas manutenções.
2. **Estoque mínimo** por peça, usado para o alerta de estoque baixo.
3. Manutenção pode ser concluída **direto de Aberta** (sem passar por Em andamento).
4. Aceitar **quantidades inteiras** apenas (sem frações de litro, por exemplo).
5. Permitir **várias manutenções abertas** para o mesmo veículo.
6. Confirmar o **cálculo do custo total** (peças + externas + despesas) e o formato dos relatórios.
7. Exportação **CSV** como formato suficiente, ou necessidade de PDF e Excel próprios.
8. Definir se a **exclusão** de cadastros deve existir (a demonstração só permite inativar e desativar).

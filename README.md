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
| `admin` | `demo123` | Todos (Administrador, Almoxarifado, Veículos, Manutenção, Combustível, Relatórios) |
| `almoxarifado` | `demo123` | Almoxarifado |
| `oficina` | `demo123` | Veículos, Manutenção e Combustível |
| `gerencia` | `demo123` | Veículos, Combustível e Relatórios |
| `juliana` | `demo123` | Usuário inativo (não consegue entrar) |

### Testes

```bash
npm test
```

Executa 102 testes automatizados com o runner nativo do Node (`node:test`). Os testes carregam os mesmos
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
    utils.js               Datas, valores em reais, identificadores, período, pesquisa sem acento
    access.js              Usuários, autenticação simulada e permissões por módulo
    vehicles.js            Cadastro de veículos, situação operacional e quilometragem atual
    maintenance.js         Abertura, início, conclusão e despesas de manutenção
    warehouse.js           Estoque, entradas, retiradas e peças externas
    fuel.js                Abastecimentos, preço por litro, gastos e consumo médio
    oil.js                 Trocas de óleo, próximos limites e situação (vencimento)
    costs.js               Cálculo de custos por veículo, manutenção e frota (manutenção + combustível)
    reports.js             Montagem dos dados dos relatórios e exportação CSV
  modules/                 TELAS (apresentação de cada módulo)
    admin.js, warehouse.js, vehicles.js, maintenance.js, oil.js, fuel.js, reports.js
assets/logo-tarcisio.jpeg  Logo do cliente
scripts/serve.js           Servidor estático local (opcional)
tests/                     Testes automatizados
```

**Separação de responsabilidades:** as telas chamam funções de `core/`, que validam, alteram o estado e
retornam `{ ok, value }` ou `{ ok: false, errors }`. As telas nunca calculam saldos ou custos diretamente.

---

## 3. Módulos e comportamento

### 3.1 Página inicial
Seis opções de acesso: Administrador, Almoxarifado, Veículos, Manutenção de veículos, Combustível e Relatórios.
Cada módulo tem menu e abas próprias, e o logotipo sempre leva de volta à página inicial.

### 3.2 Administrador
- **Visão geral:** indicadores de veículos cadastrados, ativos, inativos e em manutenção, com lista da frota e link para os detalhes.
- **Usuários e permissões:** cadastrar, editar, ativar e desativar usuários; conceder ou retirar acesso a cada módulo.
- **Parâmetros:** antecedência dos alertas de troca de óleo, em quilômetros e em dias.
- **Dados da demonstração:** restaurar os dados fictícios originais (apaga as alterações feitas no navegador).

### 3.3 Almoxarifado
- **Estoque de peças:** cadastro com código, descrição, valor unitário, estoque mínimo e data de entrada.
  Pesquisa **em tempo real** por código ou descrição (ignora maiúsculas e acentos), com botão *Limpar pesquisa*,
  combinação com o filtro de situação (estoque baixo ou zerado), contagem do resultado, estado vazio explicativo
  e histórico de movimentações por peça.
- **Entradas:** aumentam o saldo e são registradas com quantidade, data, valor unitário da entrada, responsável e observação.
- **Retiradas:** peça, veículo de destino, manutenção vinculada (opcional), quantidade, data, responsável e observação.
  Valida saldo disponível, veículo ativo e manutenção aberta do mesmo veículo. Grava o **valor histórico** do momento.
- **Peças externas:** peças usadas em veículos que não estavam no estoque. Não alteram o saldo; entram nos custos do veículo.

### 3.4 Veículos
- **Frota:** lista com pesquisa (ignora acentos) e filtros por situação cadastral e operacional.
- **Cadastro:** marca, número de identificação interno, placa, data de entrada na frota e situação (Ativo/Inativo).
- **Detalhe do veículo (histórico integrado):** dados cadastrais, **quilometragem atual** (com a origem do dado),
  situação operacional, manutenções abertas, custos separados (peças do almoxarifado, peças externas, outras despesas,
  trocas de óleo, total de manutenção), abastecimentos com **consumo médio**, trocas de óleo com próximos limites e
  situação (vencida / próxima / em dia / pendente), e o **total geral** (manutenção + combustível).

### 3.5 Manutenção
- **Abertura:** veículo ativo, data e hora de entrada, **quilometragem de entrada**, problema, observações e responsável.
  Recebe código próprio (`MNT-0001`…).
- **Acompanhamento:** situações Aberta → Em andamento → Concluída. Filtros por veículo, situação e período de entrada.
- **Itens:** retirada do almoxarifado, peça externa e despesa, registrados uma única vez e apenas referenciados.
- **Conclusão:** registra a data e hora. Não altera o cadastro do veículo e **não marca o veículo como disponível
  enquanto houver outra manutenção aberta** (a situação é sempre calculada).
- **Trocas de óleo:** lista própria, com intervalos, próximos limites, situação e custo.

### 3.6 Combustível
- **Abastecimentos:** veículo, data e hora, quilometragem, litros, valor total, preço por litro, posto, responsável,
  observação e marcação de **tanque cheio**.
- **Derivação do preço:** informando o valor total, o preço por litro é calculado (total ÷ litros); informando apenas
  o preço por litro, o valor total é calculado (litros × preço). Se os dois forem informados, o sistema confere a
  consistência e recusa divergências acima da tolerância.
- **Quilometragem:** não pode ser menor que a do abastecimento anterior do mesmo veículo; a mensagem orienta a corrigir
  o registro anterior.
- **Filtros e totais:** período, veículo, litros, gastos e preço médio; edição/correção conforme permissões; histórico preservado.
- **Consumo médio:** calculado por veículo (ver seção 4.6).

### 3.7 Relatórios
Menu lateral com **oito relatórios**, cada um com filtros, resultados, exportação CSV e impressão:
1. **Geral da frota:** totais, situação, manutenções abertas, trocas de óleo, abastecimentos e gastos (inclui total geral).
2. **Veículos:** relação com situação, **quilometragem atual**, consumo médio e custos separados (manutenção, combustível, total).
3. **Almoxarifado:** saldos, valor estimado, entradas, retiradas e estoque baixo.
4. **Retiradas:** filtros por período, veículo e peça; valor de cada retirada.
5. **Manutenções:** custos separados por peças, despesas, trocas de óleo e total.
6. **Combustível:** gastos, litros, número de abastecimentos e consumo médio por veículo.
7. **Trocas de óleo:** últimas trocas, próximos limites (km e data) e alertas por veículo.
8. **Completo:** visão consolidada por seções, sem duplicar o custo das trocas de óleo, com total geral.

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

### 4.3 Custos (sem duplicidade)
Cada item de custo existe uma única vez e é somado a partir do registro de origem:
- **Peças do almoxarifado** = soma de (quantidade × valor unitário) das retiradas.
- **Peças externas** = soma de (quantidade × valor unitário) dos registros externos.
- **Outras despesas** = soma dos valores das despesas registradas na manutenção.
- **Trocas de óleo** = soma de (quantidade × valor unitário) **apenas das trocas com custo próprio**. Quando o óleo
  vem do almoxarifado, a troca aponta para a retirada e o valor já está em "peças do almoxarifado" — não é somado
  de novo.
- **Custo de manutenção** = peças do almoxarifado + peças externas + outras despesas + trocas de óleo com custo próprio.
- **Combustível** é **separado** da manutenção (não entra no total de manutenção).
- **Custo de um veículo** = custos de todas as suas manutenções, mais retiradas diretas e peças externas sem manutenção;
  o **total geral** do veículo = manutenção + combustível.
- **Custo da frota** = soma dos custos de todos os veículos (verificado por teste).
- **Total geral do relatório completo** = total de manutenção + combustível (o combustível entra uma única vez).

### 4.4 Situação de veículos
- **Cadastral:** Ativo ou Inativo, informada pelo usuário.
- **Operacional:** "Em manutenção" quando há manutenção Aberta ou Em andamento; caso contrário, "Disponível". É calculada.
- As duas situações são independentes. Concluir uma manutenção não altera a situação cadastral e **não libera o veículo
  enquanto houver outra manutenção aberta**.
- **Quilometragem atual:** derivada do **maior** valor registrado em abastecimentos, trocas de óleo e manutenções.
  Não existe hodômetro próprio do veículo; o valor pode ficar desatualizado.

### 4.5 Manutenção
- Fluxo: Aberta → Em andamento → Concluída (também é permitido Aberta → Concluída).
- Peças, peças externas e despesas só podem ser registradas enquanto a manutenção estiver aberta.
- A data de conclusão não pode ser anterior à data de entrada.
- Um veículo pode ter mais de uma manutenção aberta ao mesmo tempo.
- A **quilometragem de entrada** é opcional e, quando informada, passa a valer para a quilometragem atual do veículo.

### 4.6 Combustível e consumo médio
- **Preço por litro** = valor total ÷ litros (arredondado a 3 casas). **Valor total** = litros × preço por litro.
  Litros devem ser maiores que zero. Se valor e preço forem informados juntos, a diferença permitida é de R$ 0,10.
- **Quilometragem** não pode diminuir em relação ao abastecimento anterior do veículo (por data e hora).
- **Consumo médio (método de tanque cheio):** entre dois abastecimentos marcados como *tanque cheio*, soma-se a
  distância percorrida e os litros abastecidos no intervalo (incluindo abastecimentos parciais no meio). O resultado
  é distância ÷ litros, ponderado entre os segmentos.
- **Não há cálculo quando:** falta quilometragem, a quilometragem diminui sem correção válida, a distância é menor
  ou igual a zero, há menos de dois tanques cheios, ou os litros não representam um ciclo válido. Nesses casos a tela
  mostra **"Dados insuficientes para calcular o consumo"** — nunca um número inventado.

### 4.7 Troca de óleo e vencimento
- **Não existe intervalo universal de troca.** O intervalo em quilômetros e em meses é informado em cada troca.
- **Próxima por quilometragem** = quilometragem da troca + intervalo em km.
- **Próxima por data** = data da troca + intervalo em meses (com ajuste de fim de mês).
- **Situações:** *Em dia*, *Próxima da troca* (dentro da antecedência configurada, em km **ou** em dias),
  *Vencida por quilometragem*, *Vencida por tempo*, *Vencida por ambos* e *Pendente de dados*.
- O vencimento ocorre **no primeiro limite atingido**. Sem quilometragem, sem intervalos ou sem km atual, a situação é
  **"Pendente de dados"** — nunca "Em dia".
- **Antecedência** do alerta é configurável em Administrador → Parâmetros (padrão: 1000 km e 30 dias).
- Uma nova troca **preserva** todo o histórico anterior; o custo da troca entra no consolidado uma única vez.

### 4.8 Períodos
- Filtros de período comparam apenas o dia (`AAAA-MM-DD`), inclusive nas datas com hora.

### 4.9 Exportação CSV e impressão
- Separador `;`, codificação UTF-8 com BOM (abre corretamente no Excel em português).
- Números com vírgula decimal e aspas quando o texto contém `;`, aspas ou quebra de linha.
- Contagens e quantidades saem como inteiros; valores monetários com duas casas.
- Todos os relatórios têm **Exportar CSV** e **Imprimir** (a impressão usa o diálogo do navegador e pode gerar PDF).

---

## 5. Persistência e restauração

- Os dados ficam no **LocalStorage** do navegador, na chave `gestaotech.frota-demo.dados.v1`.
- A sessão de login fica no **SessionStorage** (dura enquanto a aba estiver aberta).
- **Versão do esquema:** `schemaVersion = 2`. Ao abrir dados antigos (versão 1), o sistema executa uma **migração**
  que adiciona `abastecimentos`, `trocasOleo`, `configuracoes` e a `quilometragem` das manutenções, e libera o módulo
  Combustível apenas para administradores ativos. A migração é gravada de volta, **sem apagar registros existentes**.
- **Validação na leitura:** o conteúdo recuperado é conferido antes de ser usado. Dados ausentes, corrompidos ou de
  versão desconhecida fazem o sistema voltar ao **conjunto original**, sem quebrar a tela.
- **Restaurar dados originais:** Administrador → Dados da demonstração.
- Se o navegador bloquear o armazenamento, os dados ficam apenas em memória até a recarga.

---

## 6. Limitações conhecidas

- **Segurança:** o login e as permissões são **simulados no navegador**. Qualquer pessoa com acesso ao navegador pode
  alterar os dados ou as permissões. Não use para dados reais.
- **Senhas:** são armazenadas em texto simples no LocalStorage, somente para demonstração.
- **Permissões no navegador não são segurança de produção:** a autorização definitiva deve ocorrer no servidor.
- **Sem sincronização:** cada navegador tem sua própria cópia dos dados. Não há compartilhamento entre usuários.
- **Sem auditoria:** o histórico registra movimentações, mas não identifica o usuário logado que as executou.
- **Quilometragem:** é derivada dos registros; se ninguém informar km novo, o valor fica desatualizado.
- **Consumo:** depende de abastecimentos marcados como tanque cheio e de quilometragens coerentes.
- **Intervalos de óleo:** são informados por troca; a demonstração não traz tabela de intervalos por modelo.
- **Duplo envio:** formulários bloqueiam o segundo envio na própria tela, mas não há proteção no armazenamento contra
  registros repetidos feitos de propósito em outra aba.
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
| `manutencoes` | id, veiculoId, dataEntrada, quilometragem?, dataConclusao, status, descricaoProblema, observacoes, responsavel, historico[] | veículo |
| `pecasExternas` | id, veiculoId, manutencaoId?, descricao, quantidade, valorUnitario, data, responsavel, motivo | veículo; manutenção |
| `despesas` | id, manutencaoId, descricao, valor, data | manutenção |
| `abastecimentos` | id, veiculoId, dataHora, quilometragem, litros, valorTotal, precoLitro, posto, responsavel, observacao, tanqueCheio | veículo |
| `trocasOleo` | id, veiculoId, data, quilometragem, especificacao, quantidade, valorUnitario, responsavel, observacao, intervaloKm?, intervaloMeses?, manutencaoId?, pecaId?, movimentacaoId? | veículo; manutenção; peça e movimentação (quando usa estoque) |
| `configuracoes` | alertaTrocaOleoKm, alertaTrocaOleoDias | — |

---

## 8. Pontos a aprovar pelo cliente

As regras abaixo foram definidas para a demonstração e precisam ser confirmadas:

1. Veículo **inativo** não recebe retiradas, peças externas, abastecimentos, trocas de óleo nem novas manutenções.
2. **Estoque mínimo** por peça, usado para o alerta de estoque baixo.
3. Manutenção pode ser concluída **direto de Aberta** (sem passar por Em andamento).
4. Aceitar **quantidades inteiras** no almoxarifado (sem frações). Trocas de óleo com custo próprio aceitam litros fracionados.
5. Permitir **várias manutenções abertas** para o mesmo veículo.
6. Confirmar o cálculo do custo total de manutenção (peças + externas + despesas + trocas de óleo próprias), o
   combustível separado e o formato dos relatórios.
7. Exportação **CSV** como formato suficiente, ou necessidade de PDF e Excel próprios.
8. Definir se a **exclusão** de cadastros deve existir (a demonstração só permite inativar e desativar).
9. **Método de tanque cheio** como base do consumo médio e comportamento esperado quando faltam dados.
10. Confirmar os **intervalos de troca de óleo** por veículo/modelo e a antecedência dos alertas (padrão 1000 km e 30 dias).
11. Confirmar a tolerância de **R$ 0,10** entre valor total e preço por litro no abastecimento.
12. Confirmar se a **quilometragem de entrada** da manutenção é obrigatória no uso real.

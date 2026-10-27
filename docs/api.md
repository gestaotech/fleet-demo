# Contrato da API `/api/v1`

Todas as respostas são JSON com `Cache-Control: no-store`.

- Sucesso: `{ "data": ... }`.
- Erro: `{ "error": { "code": "CODIGO", "message": "mensagem segura para exibir", ... } }`.
  Campos extras podem aparecer: `campos` (validação), `revisaoAtual` (conflito), `erros` (estado inválido), `allow` (405).
- Nenhuma resposta contém stack, SQL, host do banco, senha, hash ou token.

## Autenticação e CSRF

- Sessão: cookie `gt_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, validade `SESSION_TTL_HOURS`).
- CSRF: cookie `gt_csrf` (legível pela interface). Toda requisição que altera dados (`POST`, `PUT`, `PATCH`, `DELETE`)
  deve enviar o cabeçalho `X-CSRF-Token` com o mesmo valor.
- Origem: requisições de outra origem (`Origin` diferente do host ou `Sec-Fetch-Site: cross-site`) são recusadas com `403 ORIGEM_INVALIDA`.

## Erros comuns

| HTTP | `code` | Quando |
|---|---|---|
| 400 | `DADOS_INVALIDOS`, `JSON_INVALIDO`, `IDENTIFICADOR_INVALIDO` | corpo ou parâmetro malformado |
| 401 | `NAO_AUTENTICADO` | sem sessão, sessão expirada, revogada ou usuário/vínculo inativo |
| 401 | `CREDENCIAIS_INVALIDAS` | login (mensagem idêntica para todos os casos de falha) |
| 403 | `CSRF_INVALIDO`, `ORIGEM_INVALIDA` | proteção de requisição |
| 403 | `SEM_PERMISSAO` | módulo não liberado para a ação |
| 404 | `AREA_NAO_INICIALIZADA`, `USUARIO_NAO_ENCONTRADO`, `NAO_ENCONTRADO` | recurso inexistente ou de outra empresa |
| 405 | `METODO_NAO_PERMITIDO` | método fora da lista da rota (cabeçalho `Allow`) |
| 409 | `REVISAO_DESATUALIZADA`, `LOGIN_EXISTENTE` | conflito de concorrência ou de cadastro |
| 413 | `CORPO_GRANDE_DEMAIS` | corpo acima do limite da rota |
| 415 | `TIPO_NAO_SUPORTADO` | corpo que não é JSON |
| 422 | `ESTADO_INVALIDO`, `DADOS_INVALIDOS`, `ULTIMO_ADMINISTRADOR`, `NAO_PODE_ALTERAR_PROPRIO_ACESSO` | regra de negócio |
| 429 | `MUITAS_TENTATIVAS` | limite de login atingido |
| 500 | `ERRO_INTERNO`, `BANCO_ERRO` | falha inesperada (sem detalhes) |
| 503 | `BANCO_INDISPONIVEL`, `BANCO_NAO_CONFIGURADO` | banco inacessível |

## `GET /api/v1/health`

Sem autenticação. Verifica a função e o banco.

```json
{ "ok": true, "service": "fleet-demo-api", "database": "connected" }
```

`database` pode ser `connected`, `unavailable` ou `not_configured` (HTTP 503 nos dois últimos).

## `POST /api/v1/auth/login`

Corpo: `{ "login": "admin", "senha": "..." }` (login de 3 a 20 caracteres, sem diferença de maiúsculas).

- `200`: `{ "data": { "usuario": {id, login, nome, cargo}, "empresa": {id, nome}, "permissoes": [...], "expiraEm": "..." } }`
  e os cookies `gt_session` e `gt_csrf`.
- `401 CREDENCIAIS_INVALIDAS`, `429 MUITAS_TENTATIVAS`, `503 BANCO_INDISPONIVEL`.

Limites: 5 tentativas por login e 30 por IP em 15 minutos; bloqueio de 15 minutos.

## `POST /api/v1/auth/logout`

Requer CSRF. Revoga a sessão no banco e remove os cookies. Sem sessão válida também responde `200`.

## `GET /api/v1/auth/session`

Requer sessão. Retorna `usuario`, `empresa`, `permissoes` e `expiraEm`. Emite `gt_csrf` se ausente.

## `GET /api/v1/workspace`

Requer sessão e ao menos um módulo liberado. Retorna o estado operacional da empresa da sessão:

```json
{ "data": { "revision": 7, "state": { "veiculos": [...], "pecas": [...], "configuracoes": {...}, ... } } }
```

O estado nunca contém `usuarios`, senhas ou hashes.

## `PUT /api/v1/workspace`

Requer sessão e CSRF. Corpo:

```json
{ "baseRevision": 7, "state": { ... estado completo ... } }
```

Regras, na ordem em que são verificadas:

1. `baseRevision` deve ser a revisão atual. Caso contrário: `409 REVISAO_DESATUALIZADA` com `revisaoAtual`. Nada é gravado.
2. Formato: campos conhecidos, coleções como listas, sem credenciais. Falha: `422 ESTADO_INVALIDO`.
3. Permissão por coleção alterada (ver tabela). Falha: `403 SEM_PERMISSAO` (nada é gravado).
4. Invariantes: identificadores únicos, referências existentes, quantidades positivas, estoque nunca negativo. Falha: `422 ESTADO_INVALIDO`.
5. Gravação com incremento de `revision` e registro de auditoria `ESTADO_ATUALIZADO` na mesma instrução SQL.

Tamanho máximo do corpo: 1,5 MB.

| Coleção | Módulo necessário |
|---|---|
| `veiculos` | `veiculos` |
| `pecas`, `movimentacoes`, `pecasExternas` | `almoxarifado` |
| `manutencoes`, `despesas`, `trocasOleo` | `manutencao` |
| `abastecimentos` | `combustivel` |
| `configuracoes` | `admin` |

Resposta: `200 { "data": { "revision": 8 } }`.

## `GET /api/v1/users`

Requer módulo `admin`. Lista os usuários da empresa:

```json
{ "data": [ { "id": "...", "login": "admin", "nome": "...", "cargo": "...", "ativo": true, "permissoes": ["admin", ...], "ultimoAcesso": "..." } ] }
```

## `POST /api/v1/users`

Requer módulo `admin` e CSRF. Corpo:

```json
{ "login": "operador.rel", "nome": "Operador", "cargo": "Consulta", "senha": "min-10-caracteres", "permissoes": ["relatorios"], "ativo": true }
```

- `201`: usuário criado (sem senha). `409 LOGIN_EXISTENTE` se o login já existe.
- `422 DADOS_INVALIDOS` com `campos` (lista de mensagens).

## `PATCH /api/v1/users/:id`

Requer módulo `admin` e CSRF. Campos opcionais: `nome`, `cargo`, `permissoes`, `ativo`, `senha`.

- `200`: dados atualizados (sem senha). O login não pode ser alterado.
- `404 USUARIO_NAO_ENCONTRADO`: usuário inexistente ou de outra empresa.
- `422 NAO_PODE_ALTERAR_PROPRIO_ACESSO`: tentativa de alterar as próprias permissões ou ativação.
- `422 ULTIMO_ADMINISTRADOR`: a empresa ficaria sem administrador ativo.
- Desativar o usuário ou trocar a senha revoga as sessões dele.

## Política de senha

Entre 10 e 200 caracteres. Armazenada como `scrypt$N$r$p$salt$hash`.

# Spec Delta: automation-ui

## Purpose

Define os requisitos e critérios de aceitação para a interface visual do FlowPulse (`apps/web`) cobrindo a listagem, cadastro e detalhes de automações, gestão de credenciais com exibição única segura, instruções guiadas de teste de integração, dinâmica do botão de ativação de monitoramento e conformidade rigorosa com `@docs/design.md` e WCAG 2.1 AA.

---

## ADDED Requirements

### Requirement: Listagem e navegação de Automações
A interface web SHALL disponibilizar a rota `/automations` dentro do layout protegido `apps/web/src/app/(protected)/`:
1. Exibir tabela com as automações cadastradas, apresentando:
   - Nome e descrição sucinta;
   - Badges de estado operacional (`DRAFT`, `ACTIVE`, `INACTIVE`);
   - Badges de criticidade (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`);
   - Badges de status de integração (`PENDING`, `VALIDATED`, `FAILED`);
   - Duração esperada (em segundos);
   - Link para os detalhes da automação.
2. Disponibilizar botão "Nova Automação" para navegação até `/automations/new`. Usuários com papel `ANALYST` SHALL NÃO visualizar o botão de criação ou SHALL visualizá-lo desabilitado com tooltip indicativo.
3. Tratamento de estados vazios (empty state), carregamento (loading skeleton) e erro de consulta da API REST com mensagens no padrão de design.

#### Scenario: Visualização da lista de automações por analista
- **GIVEN** um usuário autenticado com perfil `ANALYST`
- **WHEN** acessa `/automations`
- **THEN** visualiza as automações cadastradas com todos os indicadores de status, mas não possui acesso para criar ou editar automações

---

### Requirement: Formulário de cadastro de Automação
A interface web SHALL disponibilizar a rota `/automations/new`:
1. Formulário contendo:
   - `name`: campo de texto obrigatório;
   - `description`: área de texto opcional;
   - `criticality`: campo de seleção com opções `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`;
   - `expected_duration_seconds`: campo numérico inteiro positivo obrigatório.
2. Validação client-side antes da submissão com mensagens de erro associadas aos respectivos campos e atributos `aria-describedby` para acessibilidade.
3. Submissão para `POST /api/v1/automations` utilizando token de sessão do Clerk via cabeçalho `Authorization: Bearer <token>`.
4. Ao completar com sucesso, redireciona o usuário para a página de detalhes da automação criada `/automations/[id]`.

#### Scenario: Administrador cadastra automação via interface
- **GIVEN** um usuário `ADMIN` preenchendo o formulário em `/automations/new`
- **WHEN** submete dados válidos
- **THEN** a automação é criada no backend e o navegador é redirecionado para a página de detalhes com status `DRAFT` e integração `PENDING`

---

### Requirement: Painel de detalhes, gestão de credenciais e exibição única de segredo
A rota `/automations/[id]` SHALL exibir o painel completo da automação:
1. **Dados Operacionais:** exibição de nome, descrição, criticidade, duração esperada e status atual.
2. **Seção de Credenciais de Integração:**
   - Botão "Gerar Chave de Integração" (exclusivo para `ADMIN`).
   - Ao acionar, exibe aviso prévio em destaque: *"Esta credencial será exibida uma única vez. Guarde-a em um local seguro, pois ela não poderá ser recuperada posteriormente."*
   - Após confirmação e chamada a `POST /api/v1/automations/:id/api-keys`, exibe modal/card com o segredo completo retornado (`fp_live_...`) e botão com ícone para copiar para a área de transferência.
   - **Garantia de Volatilidade de Segredos:** o segredo completo SHALL ser armazenado estritamente em estado volátil de memória React do componente. É terminantemente proibido salvar a chave em `localStorage`, `sessionStorage`, `cookies` ou registrar em logs do navegador (`console.log`).
   - Após o fechamento do modal ou descarte da tela, o segredo completo deixa de estar disponível na interface, restando apenas a listagem do prefixo seguro (e.g. `fp_live_e4d9...`) e a data de criação.
   - Botão "Revogar" para chaves ativas (exclusivo para `ADMIN`), com diálogo de confirmação.

#### Scenario: Visualização e descarte de credencial gerada
- **GIVEN** um administrador na tela de detalhes da automação
- **WHEN** gera uma nova chave de API
- **THEN** visualiza o segredo completo no modal com opção de cópia segura, e ao fechar o modal, a chave completa desaparece da interface e não permanece em nenhum armazenamento do navegador

---

### Requirement: Guia interativo de teste de integração e ativação condicional
A página de detalhes `/automations/[id]` SHALL guiar o administrador para a conclusão do Fluxo 1:
1. **Instrução e Snippet de Teste cURL:**
   - Exibe bloco de código contendo o comando cURL formatado para enviar uma execução de teste para `/api/v1/executions` com `is_test: true`, orientando a substituição pelo token gerado.
2. **Indicador de Status de Integração:**
   - Exibe o status atual da integração combinando texto legível, cor semântica e ícone (WCAG 2.1 AA):
     - `PENDING`: amarelo/âmbar + ícone de relógio + texto "Pendente de Teste";
     - `VALIDATED`: verde + ícone de check + texto "Integração Validada";
     - `FAILED`: vermelho + ícone de alerta + texto "Falha na Integração".
3. **Controle de Ativação do Monitoramento:**
   - O botão "Ativar Monitoramento" SHALL permanecer desabilitado enquanto `integration_status != VALIDATED`, com tooltip ou texto auxiliar informando que um evento de teste real precisa ser recebido com sucesso.
   - Quando `integration_status === VALIDATED`, o botão "Ativar Monitoramento" torna-se ativo e clicável.
   - Ao clicar, chama `POST /api/v1/automations/:id/activate`, transita o status para `ACTIVE` e exibe notificação de sucesso.
4. **Tabela de Execuções Recentes:**
   - Lista as últimas execuções recebidas pela automação, indicando status (`SUCCESS`, `FAILED`, `TIMEOUT`, `RUNNING`), duração em ms, se foi evento de teste (`is_test`) e timestamp.

#### Scenario: Botão de ativação bloqueado para automação com integração pendente
- **GIVEN** uma automação com status de integração `PENDING`
- **WHEN** o usuário visualiza a tela de detalhes
- **THEN** o botão "Ativar Monitoramento" é renderizado desabilitado com indicação visual de que a integração requer validação prévia

#### Scenario: Ativação habilitada após validação de teste
- **GIVEN** que um evento de teste real foi ingerido e o backend retornou `integration_status: VALIDATED`
- **WHEN** a página é atualizada ou consulta o estado atualizado
- **THEN** o botão "Ativar Monitoramento" fica habilitado e, ao ser acionado, ativa com sucesso a automação

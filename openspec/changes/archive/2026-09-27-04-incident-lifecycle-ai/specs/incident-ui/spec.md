# incident-ui Specification

## Purpose

Define os requisitos de interface com o usuário (UI/UX) para o gerenciamento de incidentes no frontend Next.js 15 (`apps/web`), abrangendo a listagem com filtros, a página de detalhe com ações contextuais de transição, o modal acessível de resolução, o painel estruturado de diagnóstico assistido por IA com rotulagem consultiva explícita e a conformidade estrita com o padrão WCAG 2.1 AA.

## ADDED Requirements

### Requirement: Interface de listagem de incidentes com filtros e badges
O frontend Next.js 15 SHALL disponibilizar a rota `/incidents` (sob o layout protegido `(protected)`):
1. **Navegação:** Adicionar item "Incidentes" no cabeçalho/menu de navegação principal da aplicação;
2. **Tabela de Ocorrências:** Exibir tabela contendo:
   - Severidade: badge visual com texto em caixa alta, cor temática e ícone SVG distintivo;
   - Status: badge visual com texto, cor e ícone representativo (`OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`);
   - Automação: nome da automação monitorada associada;
   - Aberto em: data/hora no formato local legível com indicação de tempo relativo;
   - Responsável: nome do usuário atribuído ou texto "Não atribuído" para incidentes em aberto;
   - Ação: link para a visualização detalhada (`/incidents/[id]`).
3. **Filtros e Paginação:**
   - Filtros seletores por `Status` e `Severidade`;
   - Controles de paginação ou rolagem controlada;
4. **Empty State:** Caso não existam incidentes cadastrados ou correspondentes aos filtros aplicados, exibir mensagem informativa amigável com orientação visual neutra.

#### Scenario: Visualização da fila de incidentes com filtros
- **GIVEN** uma lista de incidentes com diferentes status
- **WHEN** o operador acessa `/incidents` e seleciona o filtro `Status: OPEN`
- **THEN** a tabela exibe exclusivamente os incidentes em aberto, indicando visualmente ausência de responsável e severidade com tripla codificação (texto + cor + ícone)

---

### Requirement: Visão detalhada de incidente e ações contextuais por estado
O frontend SHALL disponibilizar a rota `/incidents/[id]` contendo:
1. **Painel de Dados:** Identificador do incidente, criticidade da automação, severidade do incidente, execução causadora com mensagem de erro exibida em bloco de código monoespaçado devidamente sanitizado e timestamps operacionais;
2. **Ações Contextuais de Ciclo de Vida:**
   - Se `status === OPEN`: Botão primário **Assumir Incidente** visível para `ADMIN` e `ANALYST`;
   - Se `status === ACKNOWLEDGED`: Botão **Iniciar Investigação** visível para o responsável atribuído ou qualquer `ADMIN`;
   - Se `status === INVESTIGATING`: Botão secundário **Analisar com IA** e botão primário **Resolver Incidente** visíveis para o responsável atribuído ou qualquer `ADMIN`;
   - Se `status === RESOLVED`: Exibir as notas de resolução (`resolution_notes`) e o timestamp de conclusão em seção de leitura imutável, sem botões de transição ativos.
3. **Controle de Interação e Estados de Espera:**
   - Botões de ação SHALL apresentar spinner de loading durante a requisição;
   - SHALL haver bloqueio de múltiplos cliques simultâneos;
   - Em caso de resposta de sucesso, a página SHALL atualizar os dados exibidos e a linha do tempo;
   - Em caso de erro RFC 7807 (ex: 409 Concorrência ou 403 Permissão), exibir alerta contextual claro com o detalhe do erro.

#### Scenario: Analista assume incidente aberto a partir da página de detalhes
- **GIVEN** a página de detalhe de um incidente com status `OPEN`
- **WHEN** o analista clica no botão "Assumir Incidente"
- **THEN** o botão exibe estado de loading, a requisição `POST /api/v1/incidents/:id/acknowledge` é enviada, a tela é atualizada para o status `ACKNOWLEDGED` e o botão passa a ser "Iniciar Investigação"

---

### Requirement: Modal acessível de resolução com validação de notas
Ao clicar no botão "Resolver Incidente" (em status `INVESTIGATING`), a interface SHALL abrir um modal acessível de confirmação e preenchimento:
1. O modal SHALL conter campo `Textarea` com rótulo acessível associado (`<label htmlFor="resolution-notes">Notas de Resolução *</label>`);
2. Validação client-side:
   - Exigir preenchimento não vazio com no mínimo 10 caracteres;
   - Exibir contador de caracteres em tempo real;
   - Manter o botão "Confirmar Resolução" desabilitado enquanto o critério mínimo não for atendido;
3. Acessibilidade modal:
   - Armadilhar o foco do teclado no interior do modal enquanto aberto (`focus trap`);
   - Permitir fechar o modal com tecla `Escape` ou acionamento do botão cancelar;
   - Retornar o foco para o botão de disparo ao fechar;
4. Submissão:
   - Enviar payload `{ "resolution_notes": string }` para `POST /api/v1/incidents/:id/resolve`;
   - Após sucesso, fechar o modal, atualizar o status visual para `RESOLVED` e exibir as notas salvas no histórico.

#### Scenario: Operador preenche notas de resolução e finaliza incidente
- **GIVEN** o modal de resolução aberto para um incidente em status `INVESTIGATING`
- **WHEN** o operador digita uma explicação com mais de 10 caracteres e clica em "Confirmar Resolução"
- **THEN** a requisição é concluída com sucesso, o modal é fechado e a tela exibe o incidente como `RESOLVED` com as notas gravadas

---

### Requirement: Painel de análise assistida por IA com identificador consultivo
A página de detalhe do incidente SHALL incluir uma seção dedicada para visualização do diagnóstico assistido por inteligência artificial:
1. **Identificação e Caráter Consultivo:**
   - Título da seção claramente rotulado como: `Análise assistida por IA (Consultiva)`;
   - Aviso informativo em destaque: *"Diagnóstico gerado por IA para apoio ao operador. As hipóteses devem ser validadas antes de ações em sistemas de produção."*;
   - Proibição terminante de referir-se à análise como "causa definitiva" ou "solução garantida";
2. **Estrutura de Exibição dos Dados:**
   - **Resumo:** parágrafo executivo do problema diagnosticado;
   - **Causas Prováveis:** lista de itens destacando o título da hipótese e a justificativa associada;
   - **Evidências:** lista em tópicos das pistas extraídas dos logs e contexto;
   - **Próximos Passos:** lista sequencial com recomendações de verificação para o analista;
   - **Grau de Confiança:** indicador percentual ou barra visual com a confiança calculada (0% a 100%);
   - **Metadados:** modelo de IA utilizado (ex: `anthropic/claude-haiku-4.5`) e data/hora da análise;
3. **Tratamento de Indisponibilidade:**
   - Se a requisição de IA falhar com HTTP 503 (timeout ou indisponibilidade do OpenRouter), exibir alerta informativo não obstrutivo sugerindo que o operador continue a investigação manual, sem corromper ou bloquear a interface.

#### Scenario: Renderização de análise de IA com rotulagem consultiva
- **GIVEN** um incidente com análise de IA concluída
- **WHEN** o analista visualiza a seção de análise de IA
- **THEN** o painel exibe o aviso de caráter consultivo, o resumo, causas prováveis, evidências e próximos passos, com grau de confiança e modelo utilizado

---

### Requirement: Linha do tempo visual de eventos e conformidade WCAG 2.1 AA
A interface de incidentes SHALL garantir plena acessibilidade e rastreabilidade:
1. **Linha do Tempo (`IncidentEvent`):**
   - Renderizar visualmente a sequência cronológica dos eventos de histórico com marcadores verticais, datas formatadas e nome do operador responsável;
2. **Acessibilidade WCAG 2.1 AA:**
   - Todo status ou severidade SHALL combinar texto legível, paleta de cores de alto contraste (mínimo 4.5:1) e ícone geométrico ou semântico distintivo;
   - Indicadores visíveis de foco (`focus-visible:ring-2`) em todos os elementos clicáveis e campos de formulário;
   - Suporte integral a navegação por teclado (Tab, Shift+Tab, Enter, Space, Escape);
   - Uso de atributos ARIA (`aria-live="polite"` para notificações de sucesso ou erro e atualizações assíncronas de status).

#### Scenario: Navegação por teclado na página do incidente
- **GIVEN** um operador utilizando apenas teclado
- **WHEN** ele navega pela tela de detalhes do incidente usando a tecla Tab
- **THEN** todos os botões e campos recebem anel de foco visível na ordem correta e podem ser acionados via Enter ou Barra de Espaço

# Design System - FlowPulse

## 1. Objetivo

O design system do FlowPulse foi definido para uma aplicação de operação técnica em que o usuário precisa entender rapidamente o que está normal, o que precisa de atenção e qual é o próximo passo.

A interface deve passar sensação de controle e clareza. O foco não é criar uma tela visualmente chamativa, mas reduzir ruído e ajudar na tomada de decisão.

---

## 2. Princípios

### Clareza antes de densidade

É melhor mostrar menos informações com boa hierarquia do que transformar o dashboard em uma parede de métricas.

### Severidade precisa ser óbvia

Incidentes críticos devem ser percebidos rapidamente, mas o produto não deve deixar toda a interface vermelha.

### Cor não pode ser a única informação

Todo status deve combinar cor com texto e, quando fizer sentido, ícone.

### Ação próxima do contexto

Ações como assumir, investigar e resolver devem estar no detalhe do incidente e não escondidas em menus distantes.

### Consistência

Os mesmos estados, termos, ícones e padrões de interação devem ser utilizados em todas as telas.

---

## 3. Identidade Visual

### Nome

**FlowPulse**

### Conceito

O nome combina fluxo de execução com a ideia de pulso/saúde. A identidade visual deve refletir monitoramento contínuo, sem utilizar uma estética excessivamente "hacker".

### Personalidade

- técnica;
- confiável;
- objetiva;
- moderna;
- discreta.

---

## 4. Cores

O produto utilizará tema escuro como padrão no protótipo inicial, mantendo contraste suficiente para leitura.

### Cores principais

| Token | Uso | Valor |
|---|---|---|
| `--color-bg` | fundo principal | `#0B0F17` |
| `--color-surface` | cards e sidebar | `#111827` |
| `--color-surface-2` | superfícies elevadas | `#172033` |
| `--color-border` | bordas | `#263248` |
| `--color-text` | texto principal | `#F3F4F6` |
| `--color-text-muted` | texto secundário | `#9CA3AF` |
| `--color-primary` | ação principal | `#7C6CF2` |
| `--color-primary-hover` | hover primário | `#8F82F5` |

### Estados

| Estado | Valor | Uso |
|---|---|---|
| Success | `#22C55E` | execução saudável/resolvido |
| Warning | `#F59E0B` | atenção |
| High | `#F97316` | alta severidade |
| Critical | `#EF4444` | falha crítica |
| Info | `#38BDF8` | informação |

### Acessibilidade

- contraste mínimo de 4.5:1 para textos comuns;
- não usar somente verde/vermelho para comunicar estado;
- badges devem apresentar texto;
- gráficos devem utilizar legenda e padrões distinguíveis.

---

## 5. Tipografia

Família principal:

```text
Inter, system-ui, sans-serif
```

Fallback para código e logs:

```text
JetBrains Mono, ui-monospace, monospace
```

### Escala

| Token | Tamanho | Uso |
|---|---:|---|
| Display | 32px / 40px | títulos especiais |
| H1 | 28px / 36px | título de página |
| H2 | 22px / 30px | seção |
| H3 | 18px / 26px | card/seção |
| Body | 14px / 22px | conteúdo padrão |
| Small | 12px / 18px | metadados |
| Mono | 13px / 20px | logs e IDs |

Peso:

- Regular 400;
- Medium 500;
- Semibold 600;
- Bold 700 somente quando necessário.

---

## 6. Grid e Espaçamento

Base de espaçamento: **4px**.

Escala:

```text
4, 8, 12, 16, 24, 32, 40, 48, 64
```

### Layout desktop

- sidebar: 240px;
- conteúdo com largura fluida;
- padding lateral: 24-32px;
- cards em grid responsivo;
- largura máxima opcional de 1600px.

### Breakpoints

- mobile: `< 640px`;
- tablet: `640-1023px`;
- desktop: `>= 1024px`.

Em mobile, sidebar vira drawer.

---

## 7. Componentes

### Button

Variantes:

- Primary;
- Secondary;
- Ghost;
- Destructive.

Estados:

- default;
- hover;
- focus;
- disabled;
- loading.

### Status Badge

Exemplos:

- `Aberto`;
- `Reconhecido`;
- `Em investigação`;
- `Resolvido`;
- `Crítico`;
- `Alto`;
- `Médio`;
- `Baixo`.

Sempre utilizar texto + cor.

### Metric Card

Estrutura:

- label;
- valor;
- comparação opcional;
- informação auxiliar;
- ícone opcional.

Evitar cards com informação repetida.

### Table

Utilizada para:

- automações;
- execuções;
- incidentes.

Deve suportar:

- ordenação;
- filtros;
- paginação;
- estado vazio;
- loading;
- erro.

### Timeline

Utilizada no detalhe do incidente.

Eventos possíveis:

- incidente criado;
- responsável atribuído;
- status alterado;
- análise de IA concluída;
- incidente resolvido.

### Code / Log Block

- fonte monoespaçada;
- quebra controlada;
- botão copiar;
- área rolável para conteúdo longo;
- dados sensíveis mascarados quando aplicável.

### AI Analysis Card

A análise de IA será visualmente diferente de uma informação confirmada pelo sistema.

Estrutura:

- identificação "Análise assistida por IA";
- resumo;
- hipóteses;
- evidências;
- próximos passos;
- confiança;
- aviso de que a análise é consultiva.

---

## 8. Navegação

Menu principal:

```text
Dashboard
Automações
Execuções
Incidentes
Configurações
```

`Configurações` aparece conforme permissão.

O logo/nome do FlowPulse permanece no topo da sidebar.

---

## 9. Telas Principais

### Login

Objetivo: entrada no sistema.

Elementos:

- logo/nome;
- frase curta;
- botão/fluxo do provedor de identidade;
- estado de erro.

### Dashboard

Objetivo: entender a saúde geral rapidamente.

Elementos:

- execuções no período;
- taxa de sucesso;
- incidentes abertos;
- críticos;
- MTTA;
- MTTR;
- gráfico de sucesso/falha;
- incidentes recentes;
- automações com mais ocorrências.

### Automações

Objetivo: visualizar e administrar processos monitorados.

Colunas:

- nome;
- origem;
- criticidade;
- status;
- última execução;
- taxa de sucesso;
- responsável.

### Nova Automação / Integração

Fluxo em etapas:

1. dados básicos;
2. criticidade e duração;
3. gerar credencial;
4. testar integração;
5. ativar.

O usuário deve visualizar claramente em qual etapa está.

### Incidentes

Objetivo: trabalhar a fila de problemas.

Filtros:

- status;
- severidade;
- responsável;
- automação;
- período.

### Detalhe do Incidente

Blocos:

1. cabeçalho com título, status e severidade;
2. dados da execução;
3. erro/log;
4. ações;
5. análise de IA;
6. timeline;
7. resolução.

A ação principal muda conforme o estado atual.

---

## 10. Fluxo Visual - Incidente

```mermaid
flowchart LR
    A[Execução com falha] --> B[Incidente aberto]
    B --> C[Analista assume]
    C --> D[Investigação]
    D --> E[Análise por IA]
    E --> F[Resolução registrada]
    F --> G[Incidente resolvido]
```

---

## 11. Estados de Interface

Toda tela que consulta dados deverá tratar:

- loading;
- sucesso;
- vazio;
- erro;
- sem permissão.

Exemplo de estado vazio em Incidentes:

> Nenhum incidente encontrado para os filtros selecionados.

Não utilizar apenas uma tabela vazia sem explicação.

---

## 12. Feedback

### Sucesso

Toast curto para ações como:

- automação criada;
- integração ativada;
- incidente assumido;
- incidente resolvido.

### Erro

A mensagem deve explicar:

1. o que aconteceu;
2. se a ação foi concluída;
3. o que o usuário pode fazer.

Evitar mensagens genéricas como "Algo deu errado" quando houver informação útil.

---

## 13. Acessibilidade

Requisitos:

- navegação completa por teclado;
- foco visível;
- labels associados aos campos;
- `aria-label` quando necessário;
- sem dependência exclusiva de cor;
- contraste mínimo compatível com WCAG 2.1 AA;
- áreas clicáveis adequadas;
- mensagens de erro anunciáveis por tecnologia assistiva;
- gráficos com alternativa textual/legenda.

---

## 14. Responsividade

### Desktop

Experiência completa com sidebar fixa e múltiplas colunas.

### Tablet

Sidebar recolhível. Cards reorganizados em duas colunas.

### Mobile

- menu em drawer;
- cards em coluna única;
- tabelas podem utilizar cards/resumo ou rolagem horizontal controlada;
- ações principais permanecem acessíveis;
- detalhes de log não devem quebrar o layout.

---

## 15. Design Tokens

Exemplo inicial:

```css
:root {
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  --color-bg: #0B0F17;
  --color-surface: #111827;
  --color-border: #263248;
  --color-text: #F3F4F6;
  --color-text-muted: #9CA3AF;
  --color-primary: #7C6CF2;

  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-high: #F97316;
  --color-critical: #EF4444;
}
```

---

## 16. Diretrizes para o Stitch

Os protótipos devem ser gerados utilizando `prd.md`, `spec.md` e este design system como contexto.

Telas mínimas:

1. Login;
2. Dashboard;
3. Automações;
4. Cadastro/integração de automação;
5. Execuções;
6. Incidentes;
7. Detalhe do incidente;
8. análise de IA dentro do incidente.

Após a geração:

- avaliar Preview;
- gerar pelo menos uma variação;
- gerar protótipo navegável;
- testar Interact;
- validar os dois fluxos principais;
- registrar no repositório o link/evidências do projeto no Stitch.

---

## 17. Critérios para Validação do Design

O protótipo será considerado adequado se:

- o usuário identificar um incidente crítico sem precisar navegar por várias telas;
- o fluxo de integração de uma automação possuir começo e término claros;
- o fluxo de incidente possuir começo e término claros;
- status e severidade não dependerem apenas de cor;
- o layout funcionar em desktop e mobile;
- análise de IA estiver claramente identificada como sugestão;
- ações principais estiverem próximas do contexto onde são necessárias.

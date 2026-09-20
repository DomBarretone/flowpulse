# FlowPulse

FlowPulse é um projeto aplicado voltado ao acompanhamento de automações e pipelines.

A proposta é centralizar execuções, identificar ocorrências relevantes e permitir que um incidente seja acompanhado desde a detecção até a resolução.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/problem.md`](docs/problem.md) | definição e validação do problema |
| [`docs/prd.md`](docs/prd.md) | requisitos e escopo do produto |
| [`docs/spec.md`](docs/spec.md) | especificação técnica e fluxos |
| [`docs/architecture.md`](docs/architecture.md) | decisões de arquitetura |
| [`docs/design.md`](docs/design.md) | design system e diretrizes de interface |
| [`docs/refinement-review.md`](docs/refinement-review.md) | revisão dos documentos de refinamento |

## Fluxos principais do MVP

### 1. Integração de uma automação

```text
Cadastrar automação
        ↓
Gerar credencial
        ↓
Enviar evento de teste
        ↓
Validar integração
        ↓
Ativar monitoramento
```

### 2. Tratamento de incidente

```text
Receber execução
        ↓
Detectar problema
        ↓
Criar incidente
        ↓
Assumir / investigar
        ↓
Analisar com IA
        ↓
Registrar resolução
        ↓
Encerrar incidente
```

## Tecnologia de fronteira

O MVP prevê uma análise assistida por IA integrada ao fluxo real do incidente. A análise usa os dados da execução para gerar resumo, hipóteses, evidências e próximos passos.

A IA é consultiva e não executa correções automaticamente.

## Próximos passos

- criar os protótipos no Stitch;
- validar os fluxos;
- iniciar implementação;
- adicionar testes automatizados;
- containerizar os serviços;
- provisionar o ambiente por IaC.

## Roteiro de Discovery

Referência utilizada:

https://github.com/valuedriven/devai/blob/main/.fluxo/roteiro_discovery.md

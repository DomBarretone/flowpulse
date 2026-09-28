import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  AiAnalysisOutputDto,
  IncidentAnalysisContext,
  OpenRouterResponseResult,
} from './dto/ai-analysis-output.dto';

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);

  private readonly promptVersion = 'incident-analysis-v1';

  private readonly systemPrompt = `Você é o assistente de diagnóstico operacional do FlowPulse (versão: ${this.promptVersion}).
Sua análise de causa-raiz é ESTRITAMENTE CONSULTIVA para apoiar o operador humano.
Regras inegociáveis:
1. Baseie-se estritamente nas evidências e dados de execução fornecidos no contexto. NUNCA invente logs ou mensagens.
2. Diferencie claramente hipóteses de evidências comprovadas.
3. Não afirme causa como certeza absoluta se não houver prova cabal nos dados.
4. NUNCA execute, nem afirme ter executado, ações corretivas, comandos ou mutações no sistema monitorado.
5. NUNCA altere nem tente alterar o status de nenhum incidente.
6. NUNCA inclua senhas, tokens, hashes ou dados sensíveis em sua resposta.
7. Não inclua raciocínio oculto (sem chain-of-thought privado).
8. Retorne estritamente um objeto JSON válido aderente ao schema solicitado.`;

  async analyzeIncident(context: IncidentAnalysisContext): Promise<OpenRouterResponseResult> {
    const apiKey = process.env.OPENROUTER_API_KEY || '';
    const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
    const appUrl = process.env.OPENROUTER_APP_URL || 'http://localhost:3000';
    const appName = process.env.OPENROUTER_APP_NAME || 'FlowPulse';
    const timeoutMs = parseInt(process.env.OPENROUTER_TIMEOUT_MS || '15000', 10);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const requestPayload = {
      model,
      messages: [
        {
          role: 'system',
          content: this.systemPrompt,
        },
        {
          role: 'user',
          content: JSON.stringify({
            prompt_version: this.promptVersion,
            context: {
              automation: {
                name: context.automation.name,
                criticality: context.automation.criticality,
                expected_duration_seconds: context.automation.expected_duration_seconds,
              },
              incident: {
                severity: context.incident.severity,
                status: context.incident.status,
                opened_at: context.incident.opened_at,
              },
              execution: {
                status: context.execution.status,
                started_at: context.execution.started_at,
                finished_at: context.execution.finished_at,
                duration_ms: context.execution.duration_ms,
                error_message: context.execution.error_message,
              },
            },
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'incident_root_cause_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              likely_causes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    cause: { type: 'string' },
                    rationale: { type: 'string' },
                  },
                  required: ['cause', 'rationale'],
                  additionalProperties: false,
                },
              },
              evidence: {
                type: 'array',
                items: { type: 'string' },
              },
              next_steps: {
                type: 'array',
                items: { type: 'string' },
              },
              confidence: {
                type: 'number',
                minimum: 0.0,
                maximum: 1.0,
              },
            },
            required: ['summary', 'likely_causes', 'evidence', 'next_steps', 'confidence'],
            additionalProperties: false,
          },
        },
      },
      provider: {
        require_parameters: true,
      },
    };

    const startTime = Date.now();

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': appUrl,
          'X-Title': appName,
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        this.logger.error(`OpenRouter API returned HTTP ${response.status} ${response.statusText}`);
        throw new ServiceUnavailableException(
          'Serviço de inteligência artificial temporariamente indisponível.',
        );
      }

      const responseBody = (await response.json()) as {
        id?: string;
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const rawContent = responseBody.choices?.[0]?.message?.content;
      if (!rawContent || typeof rawContent !== 'string') {
        this.logger.error('OpenRouter returned empty choices or message content');
        throw new ServiceUnavailableException('Resposta inválida recebida do serviço de IA.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        this.logger.error('Failed to parse OpenRouter response content as JSON');
        throw new ServiceUnavailableException('Resposta malformada recebida do provedor de IA.');
      }

      const validatedOutput = this.validateStructuredOutput(parsed);

      return {
        output: validatedOutput,
        model,
        provider_request_id: responseBody.id,
        latency_ms: latencyMs,
      };
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'))
      ) {
        this.logger.warn(`OpenRouter request timed out after ${timeoutMs}ms`);
        throw new ServiceUnavailableException(
          'Tempo limite excedido ao comunicar com o serviço de IA.',
        );
      }

      this.logger.error('Unexpected error communicating with OpenRouter');
      throw new ServiceUnavailableException(
        'Serviço de inteligência artificial temporariamente indisponível.',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private validateStructuredOutput(data: unknown): AiAnalysisOutputDto {
    if (!data || typeof data !== 'object') {
      throw new ServiceUnavailableException('Estrutura de resposta inválida da IA.');
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) {
      throw new ServiceUnavailableException(
        'Campo "summary" ausente ou inválido no diagnóstico da IA.',
      );
    }

    if (!Array.isArray(obj.likely_causes)) {
      throw new ServiceUnavailableException(
        'Campo "likely_causes" deve ser uma lista de causas prováveis.',
      );
    }

    for (const item of obj.likely_causes) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof (item as Record<string, unknown>).cause !== 'string' ||
        typeof (item as Record<string, unknown>).rationale !== 'string'
      ) {
        throw new ServiceUnavailableException(
          'Item em "likely_causes" não obedece ao schema esperado ({ cause, rationale }).',
        );
      }
    }

    if (!Array.isArray(obj.evidence) || !obj.evidence.every((e) => typeof e === 'string')) {
      throw new ServiceUnavailableException('Campo "evidence" deve ser uma lista de strings.');
    }

    if (!Array.isArray(obj.next_steps) || !obj.next_steps.every((s) => typeof s === 'string')) {
      throw new ServiceUnavailableException(
        'Campo "next_steps" deve ser uma lista de recomendações.',
      );
    }

    if (
      typeof obj.confidence !== 'number' ||
      isNaN(obj.confidence) ||
      obj.confidence < 0.0 ||
      obj.confidence > 1.0
    ) {
      throw new ServiceUnavailableException(
        'Campo "confidence" deve ser um valor numérico entre 0.0 e 1.0.',
      );
    }

    return {
      summary: obj.summary.trim(),
      likely_causes: obj.likely_causes.map((c) => ({
        cause: String((c as Record<string, unknown>).cause),
        rationale: String((c as Record<string, unknown>).rationale),
      })),
      evidence: obj.evidence as string[],
      next_steps: obj.next_steps as string[],
      confidence: obj.confidence,
    };
  }
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class SanitizerService {
  private readonly jwtPattern = /\beyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\b/g;

  private readonly bearerPattern = /Bearer\s+[a-zA-Z0-9_\-\.]+/gi;

  private readonly fpLiveKeyPattern = /\bfp_live_[a-zA-Z0-9_]+\b/g;

  private readonly providerKeyPattern =
    /\b(?:sk|pk)_(?:live|test)_[a-zA-Z0-9_\-]+\b|\b(?:sk|pk)_[a-zA-Z0-9_\-]{8,}\b/g;

  private readonly emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  private readonly sensitiveUrlParamsPattern =
    /(?<=[?&](?:password|token|key|secret|api[_-]?key|auth)=)[^\s&]+/gi;

  private readonly credentialAssignmentPattern =
    /(?<=(?:password|secret|token|api[_-]?key|auth)\s*[:=]\s*['"]?)[^\s,'"&]+(?=['"]?)/gi;

  /**
   * Sanitiza deterministicamente mensagens de erro e textos livres,
   * redigindo tokens, credenciais, emails e chaves com [REDACTED].
   */
  sanitize(text: string | null | undefined): string {
    if (!text) {
      return '';
    }

    let sanitized = text;

    // 1. Redigir Bearer tokens -> Bearer [REDACTED]
    sanitized = sanitized.replace(this.bearerPattern, 'Bearer [REDACTED]');

    // 2. Redigir JWTs avulsos
    sanitized = sanitized.replace(this.jwtPattern, '[REDACTED]');

    // 3. Redigir FlowPulse API keys (fp_live_*)
    sanitized = sanitized.replace(this.fpLiveKeyPattern, '[REDACTED]');

    // 4. Redigir chaves de provedor (sk_*, pk_*)
    sanitized = sanitized.replace(this.providerKeyPattern, '[REDACTED]');

    // 5. Redigir emails
    sanitized = sanitized.replace(this.emailPattern, '[REDACTED]');

    // 6. Redigir query params sensíveis em URLs
    sanitized = sanitized.replace(this.sensitiveUrlParamsPattern, '[REDACTED]');

    // 7. Redigir valores em atribuições sensíveis (password=, secret=, etc.)
    sanitized = sanitized.replace(this.credentialAssignmentPattern, '[REDACTED]');

    return sanitized;
  }
}

import { Criticality, IncidentSeverity } from '@prisma/client';

/**
 * Derivação puramente determinística da severidade inicial do incidente
 * baseada na criticidade configurada na automação.
 */
export function calculateIncidentSeverity(criticality: Criticality): IncidentSeverity {
  switch (criticality) {
    case Criticality.CRITICAL:
    case Criticality.HIGH:
      return IncidentSeverity.CRITICAL;
    case Criticality.MEDIUM:
      return IncidentSeverity.HIGH;
    case Criticality.LOW:
      return IncidentSeverity.MEDIUM;
    default:
      return IncidentSeverity.MEDIUM;
  }
}

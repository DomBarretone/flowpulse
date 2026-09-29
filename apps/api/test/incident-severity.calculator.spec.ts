import { Criticality, IncidentSeverity } from '@prisma/client';
import { calculateIncidentSeverity } from '../src/incidents/incident-severity.calculator';

describe('calculateIncidentSeverity', () => {
  it('should map CRITICAL automation to CRITICAL incident severity', () => {
    expect(calculateIncidentSeverity(Criticality.CRITICAL)).toBe(IncidentSeverity.CRITICAL);
  });

  it('should map HIGH automation to CRITICAL incident severity', () => {
    expect(calculateIncidentSeverity(Criticality.HIGH)).toBe(IncidentSeverity.CRITICAL);
  });

  it('should map MEDIUM automation to HIGH incident severity', () => {
    expect(calculateIncidentSeverity(Criticality.MEDIUM)).toBe(IncidentSeverity.HIGH);
  });

  it('should map LOW automation to MEDIUM incident severity', () => {
    expect(calculateIncidentSeverity(Criticality.LOW)).toBe(IncidentSeverity.MEDIUM);
  });
});

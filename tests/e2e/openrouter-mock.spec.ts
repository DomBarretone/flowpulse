import { test, expect } from '@playwright/test';
import { startOpenRouterMock, stopOpenRouterMock } from './helpers/openrouter-mock';
import * as http from 'http';

test.describe('OpenRouterMock Helper (Deterministic E2E Double)', () => {
  let server: http.Server;
  const testPort = 3099;

  test.afterEach(async () => {
    if (server) {
      await stopOpenRouterMock(server);
    }
  });

  test('responds 200 to health check', async () => {
    server = await startOpenRouterMock({ port: testPort });
    const response = await fetch(`http://localhost:${testPort}/health`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ status: 'ok', mock: 'openrouter' });
  });

  test('returns schema-compliant chat completion payload on POST /chat/completions', async () => {
    server = await startOpenRouterMock({ port: testPort });
    const response = await fetch(`http://localhost:${testPort}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'anthropic/claude-haiku-4.5', messages: [] }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toMatch(/^mock-openrouter-req-/);
    expect(data.choices).toHaveLength(1);

    const content = JSON.parse(data.choices[0].message.content);
    expect(typeof content.summary).toBe('string');
    expect(Array.isArray(content.likely_causes)).toBe(true);
    expect(content.likely_causes[0]).toHaveProperty('cause');
    expect(content.likely_causes[0]).toHaveProperty('rationale');
    expect(Array.isArray(content.evidence)).toBe(true);
    expect(Array.isArray(content.next_steps)).toBe(true);
    expect(typeof content.confidence).toBe('number');
    expect(content.confidence).toBeGreaterThanOrEqual(0);
    expect(content.confidence).toBeLessThanOrEqual(1);
  });
});

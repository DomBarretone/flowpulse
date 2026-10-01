/**
 * @jest-environment node
 */
import { GET } from './route';

describe('GET /health', () => {
  it('returns HTTP 200 with status ok', async () => {
    const response = GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ status: 'ok' });
  });
});

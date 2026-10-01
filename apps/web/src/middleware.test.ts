/**
 * @jest-environment node
 */
import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';
import middleware from './middleware';

describe('middleware', () => {
  it('bypasses Clerk and returns NextResponse.next() for /health', async () => {
    const req = new NextRequest('http://localhost:3000/health');
    const event = {} as NextFetchEvent;

    const res = await middleware(req, event);
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.headers.get('x-middleware-next')).toBe('1');
    }
  });
});

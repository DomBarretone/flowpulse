import {
  RequestIdMiddleware,
  REQUEST_ID_HEADER,
} from '../src/common/middleware/request-id.middleware';
import { Request, Response } from 'express';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('should generate a new UUID v4 when x-request-id header is absent', () => {
    const req = {
      headers: {},
    } as unknown as Request;

    const setHeaderMock = jest.fn();
    const res = {
      setHeader: setHeaderMock,
    } as unknown as Response;

    const nextMock = jest.fn();

    middleware.use(req, res, nextMock);

    const generatedId = req.headers[REQUEST_ID_HEADER] as string;
    expect(generatedId).toBeDefined();
    expect(typeof generatedId).toBe('string');
    // UUID v4 format verification
    expect(generatedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(setHeaderMock).toHaveBeenCalledWith(REQUEST_ID_HEADER, generatedId);
    expect(nextMock).toHaveBeenCalled();
  });

  it('should preserve and propagate existing x-request-id header', () => {
    const customId = 'custom-request-id-123';
    const req = {
      headers: {
        [REQUEST_ID_HEADER]: customId,
      },
    } as unknown as Request;

    const setHeaderMock = jest.fn();
    const res = {
      setHeader: setHeaderMock,
    } as unknown as Response;

    const nextMock = jest.fn();

    middleware.use(req, res, nextMock);

    expect(req.headers[REQUEST_ID_HEADER]).toBe(customId);
    expect(setHeaderMock).toHaveBeenCalledWith(REQUEST_ID_HEADER, customId);
    expect(nextMock).toHaveBeenCalled();
  });
});

import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextStore {
  requestId: string;
  traceId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

import * as http from 'http';

export interface OpenRouterMockOptions {
  port?: number;
  statusCode?: number;
  customPayload?: Record<string, unknown>;
}

export function createMockAnalysisPayload() {
  return {
    id: 'mock-openrouter-req-' + Date.now(),
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: 'Falha de comunicação detectada durante a execução da automação.',
            likely_causes: [
              {
                cause: 'Indisponibilidade temporária de serviço externo',
                rationale:
                  'Os logs indicam falha ao contactar a dependência após múltiplas tentativas.',
              },
            ],
            evidence: [
              'Log de erro com código de conexão recusada ou timeout',
              'Duração da execução excedeu os limites esperados',
            ],
            next_steps: [
              'Verificar a disponibilidade da API de terceiros',
              'Validar credenciais de acesso e conectividade de rede',
              'Ajustar política de retentativas da automação',
            ],
            confidence: 0.94,
          }),
        },
      },
    ],
  };
}

export function startOpenRouterMock(options: OpenRouterMockOptions = {}): Promise<http.Server> {
  const port = options.port ?? 3002;
  const statusCode = options.statusCode ?? 200;
  const payload = options.customPayload ?? createMockAnalysisPayload();

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', mock: 'openrouter' }));
        return;
      }

      if (
        req.method === 'POST' &&
        (req.url?.includes('/chat/completions') || req.url === '/chat/completions')
      ) {
        let _body = '';
        req.on('data', (chunk) => {
          _body += chunk;
        });
        req.on('end', () => {
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(payload));
        });
        return;
      }

      // Default 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found in OpenRouter mock' }));
    });

    server.listen(port, () => {
      resolve(server);
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

export function stopOpenRouterMock(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

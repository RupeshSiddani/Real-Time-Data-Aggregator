import express, { Application } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { tokenRoutes, aggregatorService } from './routes/token.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { WebSocketHandler } from './websocket/socketHandler';
import { logger } from './utils/logger';

class Server {
  private app: Application;
  private server: http.Server;
  private wsHandler: WebSocketHandler;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wsHandler = new WebSocketHandler(this.server, aggregatorService);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    // Serve static files
    this.app.use(express.static('public'));
    
    // CORS
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    }));

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        query: req.query,
        ip: req.ip,
      });
      next();
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api', tokenRoutes);

    // Root route
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Meme Coin Aggregator API',
        version: '1.0.0',
        endpoints: {
          tokens: '/api/tokens',
          search: '/api/tokens/search?q={query}',
          tokenByAddress: '/api/tokens/:address',
          health: '/api/health',
        },
        websocket: {
          url: 'ws://localhost:3000',
          events: {
            connection: 'Connect to receive initial data',
            initial_data: 'Receive initial token list',
            token_update: 'Receive real-time updates',
            heartbeat: 'Connection health check',
          },
        },
      });
    });
  }

  private setupErrorHandlers(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public start(): void {
    const port = config.server.port;

    this.server.listen(port, () => {
      logger.info(`Server started on port ${port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
      logger.info(`HTTP: http://localhost:${port}`);
      logger.info(`WebSocket: ws://localhost:${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private async shutdown(): Promise<void> {
    logger.info('Shutting down gracefully...');

    this.wsHandler.stop();
    await aggregatorService.disconnect();

    this.server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  }
}

// Start server
const server = new Server();
server.start();
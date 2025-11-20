import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { AggregatorService } from '../services/aggregator.service';
import { TokenData, WebSocketMessage } from '../types/token.types';
import { logger } from '../utils/logger';
import { config } from '../config';
import { TokenMerger } from '../utils/tokenMerger';

export class WebSocketHandler {
  private io: SocketIOServer;
  private aggregatorService: AggregatorService;
  private updateInterval: NodeJS.Timeout | null = null;
  private previousTokens: TokenData[] = [];

  constructor(server: HTTPServer, aggregatorService: AggregatorService) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.aggregatorService = aggregatorService;
    this.setupSocketHandlers();
    this.startPeriodicUpdates();

    logger.info('WebSocket server initialized');
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info('Client connected', { socketId: socket.id });

      // Send initial data
      this.sendInitialData(socket);

      // Handle subscription
      socket.on('subscribe', (filters) => {
        logger.debug('Client subscribed with filters', { socketId: socket.id, filters });
        socket.data.filters = filters;
      });

      // Handle unsubscribe
      socket.on('unsubscribe', () => {
        logger.debug('Client unsubscribed', { socketId: socket.id });
        socket.data.filters = null;
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info('Client disconnected', { socketId: socket.id });
      });

      // Send heartbeat
      const heartbeatInterval = setInterval(() => {
        socket.emit('heartbeat', { timestamp: Date.now() });
      }, 30000);

      socket.on('disconnect', () => {
        clearInterval(heartbeatInterval);
      });
    });
  }

  private async sendInitialData(socket: Socket): Promise<void> {
    try {
      const tokens = this.aggregatorService.getLastTokens();
      
      if (tokens.length === 0) {
        // If no cached tokens, fetch them
        const result = await this.aggregatorService.fetchTokens({ limit: 30 });
        this.previousTokens = result.data;
      } else {
        this.previousTokens = tokens;
      }

      const message: WebSocketMessage = {
        type: 'initial_data',
        data: this.previousTokens,
        timestamp: Date.now(),
      };

      socket.emit('initial_data', message);
      logger.debug('Sent initial data to client', { socketId: socket.id, count: this.previousTokens.length });
    } catch (error: any) {
      logger.error('Error sending initial data', { error: error.message });
      
      const errorMessage: WebSocketMessage = {
        type: 'error',
        data: { message: 'Failed to fetch initial data' },
        timestamp: Date.now(),
      };
      
      socket.emit('error', errorMessage);
    }
  }

  private startPeriodicUpdates(): void {
    const interval = config.websocket.updateInterval;

    this.updateInterval = setInterval(async () => {
      await this.checkAndBroadcastUpdates();
    }, interval);

    logger.info(`Started periodic updates every ${interval}ms`);
  }

  private async checkAndBroadcastUpdates(): Promise<void> {
    try {
      logger.debug('Checking for token updates');

      const newTokens = await this.aggregatorService.refreshCache();

      if (this.previousTokens.length === 0) {
        this.previousTokens = newTokens;
        return;
      }

      // Detect significant changes
      const changes = TokenMerger.detectChanges(
        this.previousTokens,
        newTokens,
        config.websocket.priceChangeThreshold
      );

      if (changes.length > 0) {
        logger.info(`Broadcasting ${changes.length} token updates`);

        const message: WebSocketMessage = {
          type: 'update',
          data: changes,
          timestamp: Date.now(),
        };

        this.io.emit('token_update', message);
      }

      this.previousTokens = newTokens;
    } catch (error: any) {
      logger.error('Error checking for updates', { error: error.message });
    }
  }

  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.io.close();
    logger.info('WebSocket server stopped');
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

export default WebSocketHandler;
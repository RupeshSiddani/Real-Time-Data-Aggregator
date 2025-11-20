import { Request, Response } from 'express';
import { AggregatorService } from '../services/aggregator.service';
import { FilterOptions } from '../types/token.types';
import { logger } from '../utils/logger';

export class TokenController {
  private aggregatorService: AggregatorService;

  constructor(aggregatorService: AggregatorService) {
    this.aggregatorService = aggregatorService;
  }

  async getTokens(req: Request, res: Response): Promise<void> {
    try {
      const options: FilterOptions = {
        timeframe: req.query.timeframe as any,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
        minVolume: req.query.minVolume ? parseFloat(req.query.minVolume as string) : undefined,
        minLiquidity: req.query.minLiquidity ? parseFloat(req.query.minLiquidity as string) : undefined,
        protocol: req.query.protocol as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        cursor: req.query.cursor as string,
      };

      logger.info('Fetching tokens with options', { options });

      const result = await this.aggregatorService.fetchTokens(options);

      res.json({
        success: true,
        data: result.data,
        nextCursor: result.nextCursor,
        total: result.total,
        hasMore: result.hasMore,
      });
    } catch (error: any) {
      logger.error('Error fetching tokens', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tokens',
        message: error.message,
      });
    }
  }

  async getTokenByAddress(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;

      if (!address) {
        res.status(400).json({
          success: false,
          error: 'Token address is required',
        });
        return;
      }

      logger.info('Fetching token by address', { address });

      const token = await this.aggregatorService.getTokenByAddress(address);

      if (!token) {
        res.status(404).json({
          success: false,
          error: 'Token not found',
        });
        return;
      }

      res.json({
        success: true,
        data: token,
      });
    } catch (error: any) {
      logger.error('Error fetching token', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch token',
        message: error.message,
      });
    }
  }

  async searchTokens(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;

      if (!query) {
        res.status(400).json({
          success: false,
          error: 'Search query is required',
        });
        return;
      }

      logger.info('Searching tokens', { query });

      const options: FilterOptions = {
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };

      const result = await this.aggregatorService.fetchTokens(options);

      // Filter by search query
      const filtered = result.data.filter(token =>
        token.token_name.toLowerCase().includes(query.toLowerCase()) ||
        token.token_ticker.toLowerCase().includes(query.toLowerCase()) ||
        token.token_address.toLowerCase().includes(query.toLowerCase())
      );

      res.json({
        success: true,
        data: filtered,
        total: filtered.length,
      });
    } catch (error: any) {
      logger.error('Error searching tokens', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to search tokens',
        message: error.message,
      });
    }
  }

  async healthCheck(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }
}

export default TokenController;
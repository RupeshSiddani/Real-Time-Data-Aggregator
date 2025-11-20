import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { RateLimiter } from '../utils/rateLimiter';
import { RetryHandler } from '../utils/retryLogic';
import { TokenData, DexScreenerToken } from '../types/token.types';

export class DexScreenerService {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;
  private retryHandler: RetryHandler;

  constructor() {
    this.client = axios.create({
      baseURL: config.apis.dexscreener.baseUrl,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      },
    });

    this.rateLimiter = new RateLimiter({
      maxRequests: config.apis.dexscreener.rateLimit,
      windowMs: 60000,
      identifier: 'dexscreener',
    });

    this.retryHandler = new RetryHandler({
      maxRetries: 3,
      baseDelay: 1000,
    });
  }

  async searchTokens(query: string = 'SOL'): Promise<TokenData[]> {
    await this.rateLimiter.waitForSlot();

    try {
      const tokens = await this.retryHandler.execute(async () => {
        logger.debug('Fetching tokens from DexScreener', { query });
        
        const response = await this.client.get(`/search?q=${query}`);
        
        if (!response.data || !response.data.pairs) {
          logger.warn('No pairs found in DexScreener response');
          return [];
        }

        return this.transformTokens(response.data.pairs);
      }, 'DexScreener search');

      logger.info(`Fetched ${tokens.length} tokens from DexScreener`);
      return tokens;
    } catch (error: any) {
      logger.error('DexScreener search failed', { error: error.message, query });
      return [];
    }
  }

  async getTokenByAddress(address: string): Promise<TokenData | null> {
    await this.rateLimiter.waitForSlot();

    try {
      const token = await this.retryHandler.execute(async () => {
        logger.debug('Fetching token from DexScreener', { address });
        
        const response = await this.client.get(`/tokens/${address}`);
        
        if (!response.data || !response.data.pairs || response.data.pairs.length === 0) {
          return null;
        }

        const transformed = this.transformTokens(response.data.pairs);
        return transformed[0] || null;
      }, 'DexScreener getToken');

      return token;
    } catch (error: any) {
      logger.error('DexScreener getToken failed', { error: error.message, address });
      return null;
    }
  }

  private transformTokens(pairs: DexScreenerToken[]): TokenData[] {
    return pairs
      .filter(pair => pair.baseToken && pair.quoteToken)
      .map(pair => this.transformToken(pair))
      .filter((token): token is TokenData => token !== null);
  }

  private transformToken(pair: DexScreenerToken): TokenData | null {
    try {
      const priceNative = parseFloat(pair.priceNative || '0');
      const priceUsd = pair.priceUsd ? parseFloat(pair.priceUsd) : undefined;
      const volume24h = pair.volume?.h24 || 0;
      const liquidityUsd = pair.liquidity?.usd || 0;
      const liquidityBase = pair.liquidity?.base || 0;
      const txnCount = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
      const priceChange1h = pair.priceChange?.h1 || 0;
      const priceChange24h = pair.priceChange?.h24 || 0;

      return {
        token_address: pair.baseToken.address,
        token_name: pair.baseToken.name,
        token_ticker: pair.baseToken.symbol,
        price_sol: priceNative,
        price_usd: priceUsd,
        market_cap_sol: pair.fdv ? pair.fdv / (priceUsd || 1) : 0,
        market_cap_usd: pair.marketCap || pair.fdv,
        volume_sol: volume24h / (priceUsd || 1),
        volume_usd: volume24h,
        liquidity_sol: liquidityBase,
        liquidity_usd: liquidityUsd,
        transaction_count: txnCount,
        price_1hr_change: priceChange1h,
        price_24hr_change: priceChange24h,
        protocol: pair.dexId,
        dex_id: pair.dexId,
        last_updated: Date.now(),
        data_sources: ['dexscreener'],
      };
    } catch (error: any) {
      logger.error('Failed to transform DexScreener token', { error: error.message });
      return null;
    }
  }
}

export default DexScreenerService;
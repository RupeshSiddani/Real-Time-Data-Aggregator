import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { RetryHandler } from '../utils/retryLogic';
import { TokenData } from '../types/token.types';

interface JupiterListToken {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI: string;
  tags: string[];
}

export class JupiterService {
  private client: AxiosInstance;
  private retryHandler: RetryHandler;
  
  private tokenCache: JupiterListToken[] | null = null;
  private lastCacheTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // FALLBACK: If API fails, use this verified list so the app works.
  private readonly FALLBACK_TOKENS: JupiterListToken[] = [
    { address: 'So11111111111111111111111111111111111111112', chainId: 101, decimals: 9, name: 'Wrapped SOL', symbol: 'SOL', logoURI: '', tags: ['verified'] },
    { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', chainId: 101, decimals: 6, name: 'USDC', symbol: 'USDC', logoURI: '', tags: ['verified'] },
    { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', chainId: 101, decimals: 5, name: 'Bonk', symbol: 'BONK', logoURI: '', tags: ['verified'] },
    { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', chainId: 101, decimals: 6, name: 'dogwifhat', symbol: 'WIF', logoURI: '', tags: ['verified'] },
    { address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', chainId: 101, decimals: 9, name: 'Popcat', symbol: 'POPCAT', logoURI: '', tags: ['verified'] }
  ];

  constructor() {
    // 1. UPDATED: Use 'lite-api' (Free Tier) instead of 'api' (Paid)
    this.client = axios.create({
      baseURL: 'https://lite-api.jup.ag/tokens/v2/search?query=SOL', 
      timeout: 5000, // Short timeout so we fallback quickly if it fails
      headers: { 'Accept': 'application/json' },
    });

    this.retryHandler = new RetryHandler({
      maxRetries: 2, // Reduce retries to speed up fallback
      baseDelay: 1000,
    });
  }

  private async ensureCache(): Promise<JupiterListToken[]> {
    const now = Date.now();
    if (this.tokenCache && (now - this.lastCacheTime < this.CACHE_DURATION)) {
      return this.tokenCache;
    }

    try {
      logger.debug('Refreshing Jupiter Token List cache...');
      
      // 2. UPDATED: Try the tagged/verified endpoint on the Lite API
      const response = await this.client.get<JupiterListToken[]>('/tagged/verified');
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid format from Jupiter API');
      }

      this.tokenCache = response.data;
      this.lastCacheTime = now;
      logger.info(`Updated Jupiter cache with ${this.tokenCache.length} tokens`);
      return this.tokenCache;

    } catch (error: any) {
      // 3. CRITICAL FIX: Do not crash. Log warning and use Fallback.
      logger.warn(`Jupiter API failed (${error.message}). Using internal fallback list.`);
      
      if (!this.tokenCache) {
        this.tokenCache = this.FALLBACK_TOKENS;
      }
      return this.tokenCache;
    }
  }

  async searchTokens(query: string = 'SOL'): Promise<TokenData[]> {
    try {
      const allTokens = await this.retryHandler.execute(() => this.ensureCache(), 'Jupiter fetch list');
      
      const lowerQuery = query.toLowerCase();
      const filtered = allTokens.filter(t => 
        t.symbol.toLowerCase().includes(lowerQuery) ||
        t.name.toLowerCase().includes(lowerQuery) ||
        t.address === query
      ).slice(0, 50);

      return this.transformTokens(filtered);
    } catch (error: any) {
      // Even if everything fails, return empty array instead of crashing
      logger.error('Jupiter search failed completely', { error: error.message });
      return [];
    }
  }

  async getTokenByAddress(address: string): Promise<TokenData | null> {
    try {
      const allTokens = await this.retryHandler.execute(() => this.ensureCache(), 'Jupiter fetch list');
      const found = allTokens.find(t => t.address === address);
      if (!found) return null;
      return this.transformToken(found);
    } catch (error) {
      return null;
    }
  }

  private transformTokens(tokens: JupiterListToken[]): TokenData[] {
    return tokens.map(token => this.transformToken(token)).filter((t): t is TokenData => t !== null);
  }

  private transformToken(token: JupiterListToken): TokenData | null {
    try {
      return {
        token_address: token.address,
        token_name: token.name,
        token_ticker: token.symbol,
        price_sol: 0, 
        market_cap_sol: 0,
        volume_sol: 0,
        liquidity_sol: 0,
        transaction_count: 0,
        price_1hr_change: 0,
        protocol: 'Jupiter',
        last_updated: Date.now(),
        data_sources: ['jupiter'],
      };
    } catch (error) {
      return null;
    }
  }
}

export default JupiterService;
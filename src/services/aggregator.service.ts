import { TokenData, FilterOptions, PaginationResult } from '../types/token.types';
import { logger } from '../utils/logger';
import { TokenMerger } from '../utils/tokenMerger';
import CacheService from './cache.service';
import DexScreenerService from './dexscreener.service';
import JupiterService from './jupiter.service';

export class AggregatorService {
  private cacheService: CacheService;
  private dexScreenerService: DexScreenerService;
  private jupiterService: JupiterService;
  private lastTokensCache: TokenData[] = [];

  constructor() {
    this.cacheService = new CacheService();
    this.dexScreenerService = new DexScreenerService();
    this.jupiterService = new JupiterService();
  }

  async initialize(): Promise<void> {
    await this.cacheService.connect();
    logger.info('AggregatorService initialized');
  }

  async fetchTokens(options: FilterOptions = {}): Promise<PaginationResult<TokenData>> {
    const cacheKey = this.generateCacheKey(options);
    
    // Try cache first
    const cached = await this.cacheService.get<PaginationResult<TokenData>>(cacheKey);
    if (cached) {
      logger.debug('Cache hit for tokens', { cacheKey });
      return cached;
    }

    logger.debug('Cache miss, fetching from APIs', { cacheKey });

    // Fetch from all sources in parallel
    const [dexScreenerTokens, jupiterTokens] = await Promise.all([
      this.dexScreenerService.searchTokens('SOL'),
      this.jupiterService.searchTokens('SOL'),
    ]);

    // Merge tokens from all sources
    const allTokens = [...dexScreenerTokens, ...jupiterTokens];
    let mergedTokens = TokenMerger.mergeTokens(allTokens);

    // Store for change detection
    this.lastTokensCache = mergedTokens;

    // Apply filters
    mergedTokens = this.applyFilters(mergedTokens, options);

    // Apply sorting
    mergedTokens = this.applySorting(mergedTokens, options);

    // Apply pagination
    const result = this.applyPagination(mergedTokens, options);

    // Cache the result
    await this.cacheService.set(cacheKey, result);

    return result;
  }

  async getTokenByAddress(address: string): Promise<TokenData | null> {
    const cacheKey = `token:${address}`;
    
    // Try cache first
    const cached = await this.cacheService.get<TokenData>(cacheKey);
    if (cached) {
      logger.debug('Cache hit for token', { address });
      return cached;
    }

    logger.debug('Cache miss, fetching token from APIs', { address });

    // Try all sources
    const [dexScreenerToken, jupiterToken] = await Promise.all([
      this.dexScreenerService.getTokenByAddress(address),
      this.jupiterService.getTokenByAddress(address),
    ]);

    const tokens = [dexScreenerToken, jupiterToken].filter(t => t !== null) as TokenData[];

    if (tokens.length === 0) {
      return null;
    }

    const merged = tokens.length === 1 ? tokens[0] : TokenMerger.mergeTokens(tokens)[0];

    // Cache the result
    await this.cacheService.set(cacheKey, merged);

    return merged;
  }

  async refreshCache(): Promise<TokenData[]> {
    logger.info('Refreshing token cache');

    const [dexScreenerTokens, jupiterTokens] = await Promise.all([
      this.dexScreenerService.searchTokens('SOL'),
      this.jupiterService.searchTokens('SOL'),
    ]);

    const allTokens = [...dexScreenerTokens, ...jupiterTokens];
    const mergedTokens = TokenMerger.mergeTokens(allTokens);

    this.lastTokensCache = mergedTokens;

    // Invalidate all cached queries
    await this.cacheService.deletePattern('tokens:*');

    logger.info(`Cache refreshed with ${mergedTokens.length} tokens`);

    return mergedTokens;
  }

  getLastTokens(): TokenData[] {
    return this.lastTokensCache;
  }

  detectChanges(priceChangeThreshold: number = 5): TokenData[] {
    return TokenMerger.detectChanges(
      this.lastTokensCache,
      this.lastTokensCache,
      priceChangeThreshold
    );
  }

  private applyFilters(tokens: TokenData[], options: FilterOptions): TokenData[] {
    let filtered = [...tokens];

    // Filter by timeframe (based on price change data availability)
    if (options.timeframe) {
      switch (options.timeframe) {
        case '1h':
          filtered = filtered.filter(t => t.price_1hr_change !== undefined);
          break;
        case '24h':
          filtered = filtered.filter(t => t.price_24hr_change !== undefined);
          break;
        case '7d':
          filtered = filtered.filter(t => t.price_7d_change !== undefined);
          break;
      }
    }

    // Filter by minimum volume
    if (options.minVolume !== undefined) {
      filtered = filtered.filter(t => t.volume_sol >= options.minVolume!);
    }

    // Filter by minimum liquidity
    if (options.minLiquidity !== undefined) {
      filtered = filtered.filter(t => t.liquidity_sol >= options.minLiquidity!);
    }

    // Filter by protocol
    if (options.protocol) {
      filtered = filtered.filter(t => 
        t.protocol.toLowerCase().includes(options.protocol!.toLowerCase())
      );
    }

    return filtered;
  }

  private applySorting(tokens: TokenData[], options: FilterOptions): TokenData[] {
    const sortBy = options.sortBy || 'volume';
    const sortOrder = options.sortOrder || 'desc';

    const sorted = [...tokens].sort((a, b) => {
      let aValue = 0;
      let bValue = 0;

      switch (sortBy) {
        case 'volume':
          aValue = a.volume_sol;
          bValue = b.volume_sol;
          break;
        case 'price_change':
          aValue = a.price_1hr_change;
          bValue = b.price_1hr_change;
          break;
        case 'market_cap':
          aValue = a.market_cap_sol;
          bValue = b.market_cap_sol;
          break;
        case 'liquidity':
          aValue = a.liquidity_sol;
          bValue = b.liquidity_sol;
          break;
        case 'transaction_count':
          aValue = a.transaction_count;
          bValue = b.transaction_count;
          break;
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  }

  private applyPagination(
    tokens: TokenData[],
    options: FilterOptions
  ): PaginationResult<TokenData> {
    const limit = options.limit || 20;
    let startIndex = 0;

    // Decode cursor if provided
    if (options.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(options.cursor, 'base64').toString());
        startIndex = decoded.offset || 0;
      } catch (error) {
        logger.warn('Invalid cursor provided', { cursor: options.cursor });
      }
    }

    const endIndex = startIndex + limit;
    const data = tokens.slice(startIndex, endIndex);
    const hasMore = endIndex < tokens.length;

    let nextCursor: string | undefined;
    if (hasMore) {
      const cursorData = { offset: endIndex };
      nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    return {
      data,
      nextCursor,
      total: tokens.length,
      hasMore,
    };
  }

  private generateCacheKey(options: FilterOptions): string {
    const parts = ['tokens'];
    
    if (options.timeframe) parts.push(options.timeframe);
    if (options.sortBy) parts.push(options.sortBy);
    if (options.sortOrder) parts.push(options.sortOrder);
    if (options.minVolume) parts.push(`vol${options.minVolume}`);
    if (options.minLiquidity) parts.push(`liq${options.minLiquidity}`);
    if (options.protocol) parts.push(options.protocol);
    if (options.cursor) parts.push(options.cursor);

    return parts.join(':');
  }

  async disconnect(): Promise<void> {
    await this.cacheService.disconnect();
  }
}

export default AggregatorService;
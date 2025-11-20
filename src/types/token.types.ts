export interface TokenData {
  token_address: string;
  token_name: string;
  token_ticker: string;
  price_sol: number;
  price_usd?: number;
  market_cap_sol: number;
  market_cap_usd?: number;
  volume_sol: number;
  volume_usd?: number;
  liquidity_sol: number;
  liquidity_usd?: number;
  transaction_count: number;
  price_1hr_change: number;
  price_24hr_change?: number;
  price_7d_change?: number;
  protocol: string;
  dex_id?: string;
  last_updated: number;
  data_sources: string[];
}

export interface DexScreenerToken {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    h24: {
      buys: number;
      sells: number;
    };
  };
  volume: {
    h24: number;
  };
  priceChange: {
    h1: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
}

export interface JupiterToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  daily_volume?: number;
}

export interface FilterOptions {
  timeframe?: '1h' | '24h' | '7d' | 'all';
  sortBy?: 'volume' | 'price_change' | 'market_cap' | 'liquidity' | 'transaction_count';
  sortOrder?: 'asc' | 'desc';
  minVolume?: number;
  minLiquidity?: number;
  protocol?: string;
  limit?: number;
  cursor?: string;
}

export interface PaginationResult<T> {
  data: T[];
  nextCursor?: string;
  total: number;
  hasMore: boolean;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CacheConfig {
  ttl: number;
  prefix: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface TokenUpdate {
  token_address: string;
  type: 'price_change' | 'volume_spike' | 'new_token';
  old_value?: number;
  new_value: number;
  change_percent?: number;
  timestamp: number;
}

export interface WebSocketMessage {
  type: 'initial_data' | 'update' | 'error' | 'heartbeat';
  data?: any;
  timestamp: number;
}
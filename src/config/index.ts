import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '30', 10),
    prefix: process.env.CACHE_PREFIX || 'meme-coin:',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300', 10),
  },
  apis: {
    dexscreener: {
      baseUrl: process.env.DEXSCREENER_BASE_URL || 'https://api.dexscreener.com/latest/dex',
      rateLimit: 300,
    },
    jupiter: {
      baseUrl: process.env.JUPITER_BASE_URL || 'https://api.jup.ag/price/v2',
    },
    gecko: {
      apiKey: process.env.GECKO_API_KEY || '',
    },
  },
  websocket: {
    updateInterval: parseInt(process.env.WS_UPDATE_INTERVAL || '30000', 10),
    priceChangeThreshold: parseFloat(process.env.WS_PRICE_CHANGE_THRESHOLD || '5'),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
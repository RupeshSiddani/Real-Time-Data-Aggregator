# Meme Coin Aggregator API

Real-time cryptocurrency data aggregation service that fetches, merges, and streams meme coin data from multiple DEX sources.

# Features

- **Real-time Data Aggregation**: Fetches data from DexScreener and Jupiter APIs
- **Intelligent Caching**: Redis-based caching with configurable TTL (default 30s)
- **WebSocket Support**: Live price updates pushed to connected clients
- **Rate Limiting**: Exponential backoff to handle API rate limits
- **Token Merging**: Intelligently merges duplicate tokens from multiple sources
- **Filtering & Sorting**: Support for timeframes, volume, liquidity filters
- **Cursor-based Pagination**: Efficient pagination for large datasets

##  Architecture
```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ├─── HTTP Requests ──────┐
       │                        │
       └─── WebSocket ──────────┤
                                │
                        ┌───────▼────────┐
                        │  Express.js    │
                        │    Server      │
                        └───────┬────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
            ┌───────▼────────┐      ┌──────▼──────┐
            │   Aggregator   │      │  WebSocket  │
            │    Service     │      │   Handler   │
            └───────┬────────┘      └─────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌───────▼────┐ ┌───▼─────┐ ┌──▼──────┐
│DexScreener │ │ Jupiter │ │  Redis  │
│    API     │ │   API   │ │  Cache  │
└────────────┘ └─────────┘ └─────────┘
```

##  Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **WebSocket**: Socket.io
- **Cache**: Redis (ioredis client)
- **HTTP Client**: Axios
- **Testing**: Jest, Supertest
- **Task Scheduling**: setInterval for periodic updates

##  Prerequisites

- Node.js 18+ 
- Redis 6+
- npm or yarn

##  Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd meme-coin-aggregator
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
PORT=3000
NODE_ENV=development

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

CACHE_TTL=30
CACHE_PREFIX=meme-coin:

RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=300

DEXSCREENER_BASE_URL=https://api.dexscreener.com/latest/dex
JUPITER_BASE_URL=https://api.jup.ag/price/v2

WS_UPDATE_INTERVAL=30000
WS_PRICE_CHANGE_THRESHOLD=5

LOG_LEVEL=info
```

4. Start Redis:
```bash
# Mac
brew services start redis

# Linux
sudo systemctl start redis

# Windows
# Download and run Redis from: https://github.com/microsoftarchive/redis/releases
```

5. Build the project:
```bash
npm run build
```

6. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

##  API Documentation

### Base URL
```
http://localhost:3000/api
```

### Endpoints

#### 1. Get Tokens
```http
GET /api/tokens
```

**Query Parameters:**
- `timeframe` (optional): `1h` | `24h` | `7d` | `all`
- `sortBy` (optional): `volume` | `price_change` | `market_cap` | `liquidity` | `transaction_count`
- `sortOrder` (optional): `asc` | `desc`
- `minVolume` (optional): Minimum volume filter
- `minLiquidity` (optional): Minimum liquidity filter
- `protocol` (optional): Filter by protocol name
- `limit` (optional): Number of results per page (default: 20)
- `cursor` (optional): Pagination cursor

**Example:**
```bash
curl "http://localhost:3000/api/tokens?timeframe=24h&sortBy=volume&limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "token_address": "...",
      "token_name": "PIPE CTO",
      "token_ticker": "PIPE",
      "price_sol": 4.4141e-7,
      "market_cap_sol": 441.41,
      "volume_sol": 1322.43,
      "liquidity_sol": 149.36,
      "transaction_count": 2205,
      "price_1hr_change": 120.61,
      "protocol": "Raydium CLMM",
      "last_updated": 1234567890,
      "data_sources": ["dexscreener"]
    }
  ],
  "nextCursor": "eyJvZmZzZXQiOjIwfQ==",
  "total": 156,
  "hasMore": true
}
```

#### 2. Search Tokens
```http
GET /api/tokens/search?q={query}
```

**Example:**
```bash
curl "http://localhost:3000/api/tokens/search?q=PIPE"
```

#### 3. Get Token by Address
```http
GET /api/tokens/:address
```

**Example:**
```bash
curl "http://localhost:3000/api/tokens/576P1t7XsRL4ZVj38LV2eYWxXRPguBADA8BxcNz1xo8y"
```

#### 4. Health Check
```http
GET /api/health
```

### WebSocket Events

Connect to: `ws://localhost:3000`

**Events:**
- `connection`: Automatically receive `initial_data`
- `initial_data`: Initial token list on connection
- `token_update`: Real-time token updates
- `heartbeat`: Connection health check every 30s

**Example Client:**
```javascript
const socket = io('http://localhost:3000');

socket.on('initial_data', (data) => {
  console.log('Initial tokens:', data);
});

socket.on('token_update', (data) => {
  console.log('Token updates:', data);
});
```

##  Testing

Run all tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run tests in watch mode:
```bash
npm run test:watch
```

##  Design Decisions

### 1. Caching Strategy
- **Why Redis?** Fast, in-memory data store with TTL support
- **TTL of 30s** balances data freshness with API rate limits
- **Cache Key Structure**: `meme-coin:tokens:{filters}` for easy invalidation

### 2. Rate Limiting
- **Token Bucket Algorithm**: Prevents API bans
- **Exponential Backoff**: 1s → 2s → 4s → 8s delays
- **Per-Source Limiting**: Each API has separate rate limit tracking

### 3. Token Merging
- **By Address**: Same token on multiple DEXs merged by `token_address`
- **Volume Aggregation**: Volumes summed across all DEXs
- **Latest Price**: Most recent price data used
- **Weighted Averages**: Price changes weighted by volume

### 4. WebSocket vs REST
- **Initial Load**: REST API with pagination
- **Updates**: WebSocket push (reduces server load)
- **Threshold**: Only push changes >5% to reduce noise

### 5. Cursor Pagination
- **Why?** Better for real-time data (no skipped/duplicate items)
- **Implementation**: Base64-encoded cursor with offset
- **Alternative**: Offset pagination (simpler but less reliable)

##  Performance Metrics

- **API Response Time**: <200ms (cached), <1000ms (fresh)
- **WebSocket Latency**: <100ms for updates
- **Cache Hit Rate**: >80% after warm-up
- **Concurrent Users**: Supports 50+ WebSocket connections

## Deployment

### Deploy to Render.com (Free)

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect GitHub repo
4. Set build command: `npm install && npm run build`
5. Set start command: `npm start`
6. Add environment variables from `.env`
7. Deploy

### Redis Cloud (Free Tier)

1. Sign up at https://redis.com/try-free/
2. Create new database
3. Get connection details
4. Update `.env` with Redis credentials

##  Links

- **GitHub**: ["https://github.com/RupeshSiddani/Real-Time-Data-Aggregator"]
- **Live API**: ["https://real-time-data-aggregator.onrender.com/"]
- **Demo Video**: ["https://youtu.be/dcqYwPVhMv0"]
- **Postman Collection**: See `postman/collection.json`

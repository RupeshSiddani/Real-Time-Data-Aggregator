import { TokenMerger } from '../../src/utils/tokenMerger';
import { TokenData } from '../../src/types/token.types';

describe('TokenMerger', () => {
  test('should merge duplicate tokens', () => {
    const token1: TokenData = {
      token_address: 'ABC123',
      token_name: 'Test Token',
      token_ticker: 'TEST',
      price_sol: 1.0,
      market_cap_sol: 1000,
      volume_sol: 500,
      liquidity_sol: 200,
      transaction_count: 100,
      price_1hr_change: 5,
      protocol: 'Raydium',
      last_updated: Date.now(),
      data_sources: ['dexscreener'],
    };

    const token2: TokenData = {
      token_address: 'ABC123',
      token_name: 'Test Token',
      token_ticker: 'TEST',
      price_sol: 1.1,
      market_cap_sol: 1100,
      volume_sol: 300,
      liquidity_sol: 150,
      transaction_count: 50,
      price_1hr_change: 6,
      protocol: 'Jupiter',
      last_updated: Date.now() + 1000,
      data_sources: ['jupiter'],
    };

    const merged = TokenMerger.mergeTokens([token1, token2]);

    expect(merged).toHaveLength(1);
    expect(merged[0].token_address).toBe('ABC123');
    expect(merged[0].volume_sol).toBe(800); // 500 + 300
    expect(merged[0].liquidity_sol).toBe(350); // 200 + 150
    expect(merged[0].data_sources).toEqual(['jupiter', 'dexscreener']);
  });

  test('should not merge different tokens', () => {
    const token1: TokenData = {
      token_address: 'ABC123',
      token_name: 'Test Token 1',
      token_ticker: 'TEST1',
      price_sol: 1.0,
      market_cap_sol: 1000,
      volume_sol: 500,
      liquidity_sol: 200,
      transaction_count: 100,
      price_1hr_change: 5,
      protocol: 'Raydium',
      last_updated: Date.now(),
      data_sources: ['dexscreener'],
    };

    const token2: TokenData = {
      token_address: 'XYZ789',
      token_name: 'Test Token 2',
      token_ticker: 'TEST2',
      price_sol: 2.0,
      market_cap_sol: 2000,
      volume_sol: 600,
      liquidity_sol: 300,
      transaction_count: 150,
      price_1hr_change: 10,
      protocol: 'Jupiter',
      last_updated: Date.now(),
      data_sources: ['jupiter'],
    };

    const merged = TokenMerger.mergeTokens([token1, token2]);

    expect(merged).toHaveLength(2);
  });

  test('should detect price changes', () => {
    const oldToken: TokenData = {
      token_address: 'ABC123',
      token_name: 'Test Token',
      token_ticker: 'TEST',
      price_sol: 1.0,
      market_cap_sol: 1000,
      volume_sol: 500,
      liquidity_sol: 200,
      transaction_count: 100,
      price_1hr_change: 5,
      protocol: 'Raydium',
      last_updated: Date.now(),
      data_sources: ['dexscreener'],
    };

    const newToken: TokenData = {
      ...oldToken,
      price_sol: 1.1, // 10% increase
      last_updated: Date.now() + 1000,
    };

    const changes = TokenMerger.detectChanges([oldToken], [newToken], 5);

    expect(changes).toHaveLength(1);
    expect(changes[0].token_address).toBe('ABC123');
  });

  test('should not detect small price changes', () => {
    const oldToken: TokenData = {
      token_address: 'ABC123',
      token_name: 'Test Token',
      token_ticker: 'TEST',
      price_sol: 1.0,
      market_cap_sol: 1000,
      volume_sol: 500,
      liquidity_sol: 200,
      transaction_count: 100,
      price_1hr_change: 5,
      protocol: 'Raydium',
      last_updated: Date.now(),
      data_sources: ['dexscreener'],
    };

    const newToken: TokenData = {
      ...oldToken,
      price_sol: 1.02, // 2% increase
      last_updated: Date.now() + 1000,
    };

    const changes = TokenMerger.detectChanges([oldToken], [newToken], 5);

    expect(changes).toHaveLength(0);
  });
});
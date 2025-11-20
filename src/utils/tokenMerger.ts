import { TokenData } from '../types/token.types';
import { logger } from './logger';

export class TokenMerger {
  static mergeTokens(tokens: TokenData[]): TokenData[] {
    const grouped = new Map<string, TokenData[]>();

    for (const token of tokens) {
      const address = token.token_address.toLowerCase();
      if (!grouped.has(address)) {
        grouped.set(address, []);
      }
      grouped.get(address)!.push(token);
    }

    const merged: TokenData[] = [];

    for (const [address, tokenGroup] of grouped.entries()) {
      if (tokenGroup.length === 1) {
        merged.push(tokenGroup[0]);
      } else {
        merged.push(this.mergeTokenGroup(tokenGroup));
      }
    }

    logger.debug(`Merged ${tokens.length} tokens into ${merged.length} unique tokens`);
    return merged;
  }

  private static mergeTokenGroup(tokens: TokenData[]): TokenData {
    tokens.sort((a, b) => b.last_updated - a.last_updated);

    const base = tokens[0];
    const dataSources = [...new Set(tokens.flatMap(t => t.data_sources))];

    return {
      token_address: base.token_address,
      token_name: base.token_name,
      token_ticker: base.token_ticker,
      
      price_sol: base.price_sol,
      price_usd: base.price_usd,

      market_cap_sol: Math.max(...tokens.map(t => t.market_cap_sol || 0)),
      market_cap_usd: Math.max(...tokens.map(t => t.market_cap_usd || 0)),

      volume_sol: tokens.reduce((sum, t) => sum + (t.volume_sol || 0), 0),
      volume_usd: tokens.reduce((sum, t) => sum + (t.volume_usd || 0), 0),

      liquidity_sol: tokens.reduce((sum, t) => sum + (t.liquidity_sol || 0), 0),
      liquidity_usd: tokens.reduce((sum, t) => sum + (t.liquidity_usd || 0), 0),

      transaction_count: tokens.reduce((sum, t) => sum + (t.transaction_count || 0), 0),

      price_1hr_change: this.weightedAverage(
        tokens.map(t => ({ value: t.price_1hr_change, weight: t.volume_sol }))
      ),
      price_24hr_change: this.weightedAverage(
        tokens.map(t => ({ value: t.price_24hr_change || 0, weight: t.volume_sol }))
      ),
      price_7d_change: this.weightedAverage(
        tokens.map(t => ({ value: t.price_7d_change || 0, weight: t.volume_sol }))
      ),

      protocol: tokens.map(t => t.protocol).join(', '),
      dex_id: base.dex_id,

      last_updated: base.last_updated,
      data_sources: dataSources,
    };
  }

  private static weightedAverage(values: Array<{ value: number; weight: number }>): number {
    const totalWeight = values.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = values.reduce((sum, v) => sum + v.value * v.weight, 0);
    return weightedSum / totalWeight;
  }

  static detectChanges(
    oldTokens: TokenData[],
    newTokens: TokenData[],
    priceChangeThreshold: number = 5
  ): TokenData[] {
    const oldMap = new Map(oldTokens.map(t => [t.token_address, t]));
    const changes: TokenData[] = [];

    for (const newToken of newTokens) {
      const oldToken = oldMap.get(newToken.token_address);

      if (!oldToken) {
        changes.push(newToken);
        continue;
      }

      const priceChangePercent = Math.abs(
        ((newToken.price_sol - oldToken.price_sol) / oldToken.price_sol) * 100
      );

      if (priceChangePercent >= priceChangeThreshold) {
        changes.push(newToken);
        continue;
      }

      const volumeChangePercent = 
        ((newToken.volume_sol - oldToken.volume_sol) / oldToken.volume_sol) * 100;

      if (volumeChangePercent >= 50) {
        changes.push(newToken);
      }
    }

    return changes;
  }
}

export default TokenMerger;
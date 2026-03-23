/**
 * Polymarket Trading Execution
 * Handles order placement and execution on Polymarket
 * 
 * NOTE: Real trading requires:
 * - Polymarket API key with trading permissions
 * - Solana wallet for transaction signing
 * - Integration with Polymarket's CLOB API and smart contracts
 * 
 * Current implementation runs in SIMULATION mode by default.
 * Set TRADING_MODE=production to enable (requires credentials).
 */

import { config } from './config';
import { logError, logInfo, ErrorCode, retryWithBackoff } from './errors';
import { ok, err } from './result';
import type { Result } from './types';
import { logTrade, updateTradeStatus } from '@/store/trade-log';

const POLYMARKET_API_BASE = 'https://clob.polymarket.com';

// Order types
export interface OrderRequest {
  marketId: string;
  clobTokenId: string;
  side: 'buy' | 'sell';
  amount: number; // In dollars
  orderType: 'market' | 'limit' | 'fillOrKill';
  limitPrice?: number; // Required for limit orders
  maxSlippage?: number; // 0-1, default 0.02
  signalId?: string; // Optional signal ID that triggered this trade
}

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  executedPrice?: number;
  executedAmount?: number;
  fee?: number;
  txSignature?: string;
  error?: string;
}

export interface PriceQuote {
  bid: number;  // Best buy price
  ask: number;  // Best sell price
  mid: number;  // (bid + ask) / 2
  spread: number; // ask - bid
}

/**
 * Get best price quote for a market
 */
export async function getPriceQuote(clobTokenId: string): Promise<Result<PriceQuote>> {
  try {
    const response = await fetch(`${POLYMARKET_API_BASE}/price?token_id=${clobTokenId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return err(`Failed to get price quote: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return ok({
      bid: data.bid || 0.5,
      ask: data.ask || 0.5,
      mid: data.mid || 0.5,
      spread: (data.ask || 0.5) - (data.bid || 0.5),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError('TRADING_GET_QUOTE', new Error(errorMessage), { clobTokenId });
    return err(`Failed to get price quote: ${errorMessage}`);
  }
}

/**
 * Place an order on Polymarket
 * Note: This is a placeholder - actual implementation requires:
 * - Proper authentication (API key + signature)
 * - Wallet connection for transaction signing
 * - Order book interaction
 */
export async function placeOrder(request: OrderRequest): Promise<Result<OrderResponse>> {
  // Validate request
  if (!request.clobTokenId) {
    return err('Missing clobTokenId - cannot place order');
  }

  if (!config.polymarketApiKey && !config.solana.enabled) {
    return err('No trading credentials configured');
  }

  const maxSlippage = request.maxSlippage ?? 0.02;

  try {
    // First, get current price quote
    const quoteResult = await getPriceQuote(request.clobTokenId);
    
    if (!quoteResult.ok) {
      return err(`Failed to get price quote: ${quoteResult.error}`);
    }

    const quote = quoteResult.data;
    let executionPrice: number;

    switch (request.orderType) {
      case 'market':
        // Execute at market (with slippage protection)
        if (request.side === 'buy') {
          executionPrice = quote.ask * (1 + maxSlippage);
        } else {
          executionPrice = quote.bid * (1 - maxSlippage);
        }
        break;

      case 'limit':
        if (!request.limitPrice) {
          return err('Limit orders require limitPrice');
        }
        executionPrice = request.limitPrice;
        break;

      case 'fillOrKill':
        // Must execute immediately at specified price or better
        if (request.side === 'buy') {
          if (quote.ask > (request.limitPrice || 1)) {
            return err('FillOrKill: ask price exceeds limit');
          }
          executionPrice = quote.ask;
        } else {
          if (quote.bid < (request.limitPrice || 0)) {
            return err('FillOrKill: bid price below limit');
          }
          executionPrice = quote.bid;
        }
        break;

      default:
        return err(`Unknown order type: ${request.orderType}`);
    }

    // Calculate actual amount of tokens
    const tokenAmount = request.amount / executionPrice;

    // Check trading mode - simulation vs production
    const isSimulation = config.trading.mode === 'simulation';

    // Validate trade size
    if (request.amount < config.trading.minTradeSize) {
      return err(`Trade size below minimum: ${config.trading.minTradeSize}`);
    }
    if (request.amount > config.trading.maxTradeSize) {
      return err(`Trade size above maximum: ${config.trading.maxTradeSize}`);
    }

    // Log the trade attempt
    const tradeLog = logTrade({
      signalId: request.signalId,
      marketId: request.marketId,
      direction: request.side,
      amountUSD: request.amount,
      amountTokens: tokenAmount,
      price: executionPrice,
      orderType: request.orderType,
      status: isSimulation ? 'filled' : 'pending',
    });

    if (isSimulation) {
      // Simulation mode - return success immediately
      logInfo('TRADING_SIMULATION', 
        `Trade simulated: ${request.side} ${request.amount} ${request.clobTokenId} at ${executionPrice}`
      );

      // Update trade as filled
      updateTradeStatus(tradeLog.id, {
        status: 'filled',
        filledAt: new Date().toISOString(),
        txSignature: `sim_${Date.now()}`,
      });

      return ok({
        success: true,
        orderId: tradeLog.id,
        executedPrice: executionPrice,
        executedAmount: tokenAmount,
        fee: request.amount * 0.02, // 2% Polymarket fee
        txSignature: `sim_${Date.now()}`,
      });
    }

    // Production mode - try to execute real trade with Polymarket API
    if (config.polymarketApiKey && config.solana.enabled) {
      try {
        // Attempt real order placement via Polymarket CLOB API
        const orderResult = await executeRealOrder({
          clobTokenId: request.clobTokenId,
          side: request.side,
          amount: request.amount,
          price: executionPrice,
          orderType: request.orderType,
        });

        if (orderResult.ok) {
          // Update trade as filled with real order ID
          updateTradeStatus(tradeLog.id, {
            status: 'filled',
            filledAt: new Date().toISOString(),
            orderId: orderResult.data.orderId,
            txSignature: orderResult.data.txSignature,
          });

          logInfo('TRADING_PRODUCTION_SUCCESS',
            `Real trade executed: ${request.side} ${request.amount} ${request.clobTokenId} at ${executionPrice}`
          );

          return ok({
            success: true,
            orderId: orderResult.data.orderId,
            executedPrice: executionPrice,
            executedAmount: tokenAmount,
            fee: request.amount * 0.02,
            txSignature: orderResult.data.txSignature,
          });
        } else {
          // Real order failed - update trade status
          updateTradeStatus(tradeLog.id, {
            status: 'failed',
            error: orderResult.error,
          });

          logError('TRADING_PRODUCTION_FAILED',
            new Error(orderResult.error),
            { request, quote, executionPrice }
          );

          return err(`Real order failed: ${orderResult.error}`);
        }
      } catch (orderError) {
        const errorMsg = orderError instanceof Error ? orderError.message : String(orderError);
        updateTradeStatus(tradeLog.id, {
          status: 'failed',
          error: errorMsg,
        });

        logError('TRADING_PRODUCTION_ERROR',
          new Error(errorMsg),
          { request }
        );

        return err(`Real order error: ${errorMsg}`);
      }
    }

    // No API key or wallet - return error
    logError('TRADING_PRODUCTION_NOT_CONFIGURED',
      new Error('Production trading requires POLYMARKET_API_KEY and SOLANA_ENABLED=true'),
      { hasApiKey: !!config.polymarketApiKey, hasWallet: config.solana.enabled }
    );

    return err('Production trading not configured - set POLYMARKET_API_KEY and SOLANA_ENABLED=true');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError('TRADING_PLACE_ORDER', new Error(errorMessage), { request });
    return err(`Failed to place order: ${errorMessage}`);
  }
}

/**
 * Execute a real order on Polymarket using their API
 * Requires API key and Solana wallet
 */
async function executeRealOrder(params: {
  clobTokenId: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  orderType: 'market' | 'limit' | 'fillOrKill';
}): Promise<Result<{ orderId: string; txSignature: string }>> {
  const { clobTokenId, side, amount, price, orderType } = params;

  try {
    // Polymarket order placement endpoint
    const endpoint = `${POLYMARKET_API_BASE}/orders`;

    const orderData = {
      token_id: clobTokenId,
      side,
      amount: amount.toString(), // Amount in dollars
      price: price.toString(),
      order_type: orderType,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.polymarketApiKey}`,
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return err(`Order failed: HTTP ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Polymarket returns order details on success
    return ok({
      orderId: result.order_id || result.id || `order_${Date.now()}`,
      txSignature: result.tx_signature || result.txHash || '',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return err(`Order request failed: ${errorMessage}`);
  }
}

/**
 * Cancel an existing order
 */
export async function cancelOrder(orderId: string): Promise<Result<{ success: boolean }>> {
  if (!config.polymarketApiKey) {
    return err('No API key configured for order cancellation');
  }

  try {
    // Placeholder for actual implementation
    logError('TRADING_CANCEL_NOT_IMPLEMENTED',
      new Error('Order cancellation not implemented'),
      { orderId }
    );

    return ok({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return err(`Failed to cancel order: ${errorMessage}`);
  }
}

/**
 * Get order status
 */
export async function getOrderStatus(orderId: string): Promise<Result<{
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  filledAmount?: number;
  avgFillPrice?: number;
}>> {
  try {
    // Placeholder - would call Polymarket API
    return ok({
      status: 'pending' as const,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return err(`Failed to get order status: ${errorMessage}`);
  }
}

/**
 * Execute a trade from a signal
 * This is the main entry point for automated trading
 */
export async function executeSignalTrade(params: {
  marketId: string;
  clobTokenId: string;
  direction: 'yes' | 'no';
  sizeUSD: number;
  currentPrice: number;
  signalId?: string;
}): Promise<Result<OrderResponse>> {
  const { marketId, clobTokenId, direction, sizeUSD, currentPrice, signalId } = params;

  // Check if we have a valid size
  if (sizeUSD <= 0) {
    return err('Invalid trade size: must be greater than 0');
  }

  // Check minimum size (Polymarket minimum is typically $1)
  if (sizeUSD < 1) {
    return err(`Trade size too small: minimum $1, got $${sizeUSD}`);
  }

  logError('TRADING_EXECUTE', 
    new Error('Executing trade from signal'),
    { marketId, direction, sizeUSD, currentPrice, signalId }
  );

  // Place the order
  const result = await placeOrder({
    marketId,
    clobTokenId,
    side: direction === 'yes' ? 'buy' : 'sell',
    amount: sizeUSD,
    orderType: 'market',
    maxSlippage: config.trading.maxSlippage,
    signalId,
  });

  if (!result.ok) {
    return err(`Trade execution failed: ${result.error}`);
  }

  // Log the trade
  logError('TRADING_SUCCESS',
    new Error('Trade executed'),
    { 
      marketId, 
      direction, 
      sizeUSD, 
      executedPrice: result.data.executedPrice,
      orderId: result.data.orderId 
    }
  );

  return result;
}

/**
 * Calculate position size based on Kelly criterion and risk parameters
 */
export function calculatePositionSize(params: {
  portfolioValue: number;
  kellyFraction: number;
  maxPositionSize: number; // As fraction (e.g., 0.05 = 5%)
  ev: number;
  probability: number;
  marketPrice: number;
}): number {
  const { portfolioValue, kellyFraction, maxPositionSize, ev, probability, marketPrice } = params;

  // Use Kelly fraction (capped)
  const effectiveKelly = Math.min(kellyFraction, 0.25);
  
  // Calculate base position size
  let positionSize = portfolioValue * effectiveKelly;
  
  // Adjust for confidence (EV magnitude)
  const confidenceMultiplier = Math.min(Math.abs(ev) / 0.2, 1); // Cap at 1x for EV > 20%
  positionSize *= (0.5 + 0.5 * confidenceMultiplier); // 0.5x to 1x

  // Cap at maximum position size
  const maxSizeUSD = portfolioValue * maxPositionSize;
  positionSize = Math.min(positionSize, maxSizeUSD);

  // Round to nearest dollar (Polymarket works in dollars)
  return Math.floor(positionSize);
}

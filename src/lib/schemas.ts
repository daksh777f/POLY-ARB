/**
 * Zod Validation Schemas for API Routes
 * Provides runtime validation for external inputs
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Common Schemas
// ─────────────────────────────────────────────────────────────────────────────

/** ISO Date string */
export const isoDateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid ISO date string' }
);

/** Positive number */
export const positiveNumber = z.number().positive();

/** Percentage (0-1) */
export const probability = z.number().min(0).max(1);

/** Percentage (0-100) */
export const percentage = z.number().min(0).max(100);

// ─────────────────────────────────────────────────────────────────────────────
// Market Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const MarketSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  probability: probability,
  volume: z.number().min(0),
  liquidity: z.number().min(0),
  endDate: isoDateString,
  url: z.string().url(),
  category: z.string().optional(),
  lastUpdated: isoDateString,
  volume24hr: z.number().optional(),
  spread: z.number().optional(),
  clobTokenId: z.string().optional(),
  eventId: z.string().optional(),
  eventTitle: z.string().optional(),
  tags: z.array(z.string()).optional(),
  oneDayPriceChange: z.number().optional(),
  syncedAt: isoDateString.optional(),
});

export const MarketCreateSchema = MarketSchema.omit({ id: true });

export const MarketUpdateSchema = MarketSchema.partial();

// ─────────────────────────────────────────────────────────────────────────────
// Signal Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const SignalDirectionSchema = z.enum(['yes', 'no']);

export const ConfidenceSchema = z.enum(['low', 'medium', 'high']);

export const SignalSchema = z.object({
  id: z.string().min(1),
  marketId: z.string().min(1),
  marketQuestion: z.string().min(1),
  darwinEstimate: probability,
  marketPrice: probability,
  ev: z.number(),
  direction: SignalDirectionSchema,
  reasoning: z.string().min(1),
  newsEvents: z.array(z.string()),
  confidence: ConfidenceSchema,
  createdAt: isoDateString,
  expiresAt: isoDateString,
  evNet: z.number().optional(),
  costs: z.string().optional(),
  features: z.string().optional(),
  tradeable: z.boolean().optional(),
  pHatLb: z.number().optional(),
  commitTxSignature: z.string().optional(),
  commitHash: z.string().optional(),
  revealTxSignature: z.string().optional(),
  commitSlot: z.number().optional(),
  marketPriceAtCommit: z.number().optional(),
  actualOutcome: z.boolean().optional(),
  calibrationResolvedAt: isoDateString.optional(),
});

export const SignalCreateSchema = SignalSchema.omit({ 
  id: true, 
  createdAt: true,
  commitTxSignature: true,
  commitHash: true,
  revealTxSignature: true,
  commitSlot: true,
  marketPriceAtCommit: true,
  actualOutcome: true,
  calibrationResolvedAt: true,
}).extend({
  id: z.string().optional(),
  createdAt: isoDateString.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Signal Resolution Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const ResolveSignalInputSchema = z.object({
  signalId: z.string().min(1),
  marketId: z.string().min(1),
  predictedProbability: probability,
  actualOutcome: z.union([z.literal(0), z.literal(1)]),
});

export const BatchResolutionInputSchema = z.object({
  batch: z.array(z.string()).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Trade Execution Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const OrderSideSchema = z.enum(['buy', 'sell']);

export const OrderTypeSchema = z.enum(['market', 'limit', 'fillOrKill']);

export const TradeRequestSchema = z.object({
  marketId: z.string().min(1),
  side: OrderSideSchema,
  amount: positiveNumber,
  orderType: OrderTypeSchema.default('market'),
  limitPrice: probability.optional(), // Required for limit orders
  maxSlippage: z.number().min(0).max(1).default(0.02), // 2% default
});

export const TradeResponseSchema = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  executedPrice: probability.optional(),
  executedAmount: positiveNumber.optional(),
  fee: z.number().optional(),
  txSignature: z.string().optional(),
  error: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const PositionSchema = z.object({
  id: z.string().min(1),
  signalId: z.string().min(1),
  marketId: z.string().min(1),
  marketQuestion: z.string().min(1),
  direction: SignalDirectionSchema,
  sizePercent: z.number().min(0).max(1), // 0-1 as fraction of portfolio
  entryPrice: probability,
  currentPrice: probability.optional(),
  unrealizedPnL: z.number().optional(),
  realizedPnL: z.number().optional(),
  status: z.enum(['open', 'closed', 'settled']),
  openedAt: isoDateString,
  closedAt: isoDateString.optional(),
  txSignature: z.string().optional(),
});

export const PortfolioSchema = z.object({
  id: z.string().min(1),
  totalCapital: positiveNumber,
  availableCapital: positiveNumber,
  deployedCapital: z.number().min(0),
  totalPnL: z.number(),
  totalPnLPercent: z.number(),
  currentDrawdown: z.number().min(0),
  maxDrawdown: z.number().min(0),
  positions: z.array(PositionSchema),
  updatedAt: isoDateString,
});

// ─────────────────────────────────────────────────────────────────────────────
// Compliance Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const UserComplianceSchema = z.object({
  userId: z.string().min(1),
  termsAcceptedAt: isoDateString.optional(),
  riskDisclaimerAcceptedAt: isoDateString.optional(),
  algorithmicTradingWarningAcceptedAt: isoDateString.optional(),
  noFinancialAdviceAcknowledgedAt: isoDateString.optional(),
  maxPositionSizePercent: z.number().min(0).max(1).default(0.005),
  maxDrawdownPercent: z.number().min(0).max(1).default(0.05),
  geoLocation: z.string().optional(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

// ─────────────────────────────────────────────────────────────────────────────
// Health Check Schemas
// ─────────────────────────────────────────────────────────────────────────────

// Health check response - using record with string values
const healthCheckStatusSchema = z.object({
  status: z.enum(['pass', 'fail', 'warn']),
  message: z.string().optional(),
  latencyMs: z.number().optional(),
});

export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: isoDateString,
  checks: z.record(z.string(), healthCheckStatusSchema),
});

// ─────────────────────────────────────────────────────────────────────────────
// Audit Log Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const AuditEventTypeSchema = z.enum([
  'signal_created', 
  'signal_resolved', 
  'signal_expired', 
  'risk_check', 
  'calibration_update',
  'trade_executed',
  'trade_failed',
  'position_opened',
  'position_closed',
]);

export const AuditLogEntrySchema = z.object({
  id: z.string().min(1),
  signalId: z.string().optional(),
  marketId: z.string().optional(),
  eventType: AuditEventTypeSchema,
  estimatedProbability: probability.optional(),
  actualOutcome: z.number().min(0).max(1).optional(),
  brierComponent: z.number().optional(),
  notes: z.string().optional(),
  riskFlags: z.array(z.string()).optional(),
  resolvedAt: isoDateString.optional(),
  createdAt: isoDateString,
});

// ─────────────────────────────────────────────────────────────────────────────
// API Response Wrappers
// ─────────────────────────────────────────────────────────────────────────────

export const ApiSuccessResponse = <T>(data: T) => ({ ok: true, data });

export const ApiErrorResponse = (error: string, code?: string) => ({ 
  ok: false, 
  error,
  code 
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate data against a schema and return typed result
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context = 'unknown'
): { ok: true; data: T } | { ok: false; error: string; issues: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { ok: true, data: result.data };
  }
  
  const issues = result.error.issues;
  const errorMessage = issues
    .map(i => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  
  console.warn(`[VALIDATION] ${context}: ${errorMessage}`);
  
  return { ok: false, error: errorMessage, issues };
}

/**
 * Validate and throw on error (for internal use)
 */
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context = 'unknown'
): T {
  const result = validate(schema, data, context);
  
  if (!result.ok) {
    throw new Error(`Validation failed for ${context}: ${result.error}`);
  }
  
  return result.data;
}

/**
 * Centralized Error Handling & Logging Utilities
 * Provides structured error handling across the application
 */

import { config } from './config';

// Error codes for better categorization
export enum ErrorCode {
  // Database errors
  DB_CONNECTION_FAILED = 'DB_001',
  DB_QUERY_FAILED = 'DB_002',
  DB_INSERT_FAILED = 'DB_003',
  
  // External API errors
  EXTERNAL_API_FAILED = 'EXT_001',
  POLYMARKET_API_FAILED = 'EXT_002',
  VALYU_API_FAILED = 'EXT_003',
  TWITTER_API_FAILED = 'EXT_004',
  SOLANA_RPC_FAILED = 'EXT_005',
  
  // Validation errors
  VALIDATION_FAILED = 'VAL_001',
  INVALID_INPUT = 'VAL_002',
  SCHEMA_MISMATCH = 'VAL_003',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_001',
  TOO_MANY_REQUESTS = 'RATE_002',
  
  // Trading errors
  TRADE_EXECUTION_FAILED = 'TRADE_001',
  INSUFFICIENT_LIQUIDITY = 'TRADE_002',
  INSUFFICIENT_BALANCE = 'TRADE_003',
  SLIPPAGE_EXCEEDED = 'TRADE_004',
  
  // General errors
  UNKNOWN_ERROR = 'GEN_001',
  NOT_IMPLEMENTED = 'GEN_002',
  NOT_FOUND = 'GEN_003',
  UNAUTHORIZED = 'GEN_004',
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  originalError?: Error;
  timestamp: string;
  stack?: string;
}

/**
 * Create a structured application error
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  originalError?: Error
): AppError {
  const error: AppError = {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
  };
  
  if (originalError) {
    error.originalError = originalError;
    if (config.nodeEnv === 'development') {
      error.stack = originalError.stack;
    }
  }
  
  return error;
}

/**
 * Log error with context
 */
export function logError(
  context: string,
  error: AppError | Error,
  additionalContext?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const errorObj = error instanceof Error 
    ? { message: error.message, stack: error.stack }
    : error;
    
  const logEntry = {
    timestamp,
    context,
    error: errorObj,
    additionalContext,
    environment: config.nodeEnv,
  };
  
  // Console output with formatting
  console.error(`[ERROR] ${timestamp} [${context}]`);
  console.error(JSON.stringify(logEntry, null, 2));
  
  // In production, you would send to a logging service (DataDog, Sentry, etc.)
  if (config.nodeEnv === 'production') {
    // TODO: Send to error tracking service
  }
}

/**
 * Log info message
 */
export function logInfo(
  context: string,
  message: string,
  additionalContext?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  
  const logEntry = {
    timestamp,
    context,
    message,
    additionalContext,
    environment: config.nodeEnv,
  };
  
  // Console output with formatting
  console.log(`[INFO] ${timestamp} [${context}]: ${message}`);
  
  // In production, you would send to a logging service
  if (config.nodeEnv === 'production') {
    // TODO: Send to logging service
  }
}

/**
 * Log warning message
 */
export function logWarning(
  context: string,
  message: string,
  additionalContext?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  
  const logEntry = {
    timestamp,
    context,
    message,
    additionalContext,
    environment: config.nodeEnv,
  };
  
  // Console output with formatting
  console.warn(`[WARN] ${timestamp} [${context}]: ${message}`);
}

/**
 * Wrap async function with error handling
 */
export async function withErrorHandling<T>(
  context: string,
  fn: () => Promise<T>,
  errorCode: ErrorCode = ErrorCode.UNKNOWN_ERROR
): Promise<{ ok: true; data: T } | { ok: false; error: AppError }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const appError = createError(
      errorCode,
      `${context}: ${error.message}`,
      undefined,
      error
    );
    logError(context, appError);
    return { ok: false, error: appError };
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 5000,
    onRetry,
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < maxAttempts) {
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt - 1),
          maxDelayMs
        );
        
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        
        console.warn(`[RETRY] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Global error handler for uncaught exceptions
 */
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    console.error('[FATAL] Uncaught Exception:', error);
    logError('GLOBAL_UNCAUGHT', createError(
      ErrorCode.UNKNOWN_ERROR,
      `Uncaught exception: ${error.message}`,
      undefined,
      error
    ));
    // In production, you might want to gracefully shutdown
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  });
  
  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    console.error('[FATAL] Unhandled Promise Rejection:', error);
    logError('GLOBAL_UNHANDLED', createError(
      ErrorCode.UNKNOWN_ERROR,
      `Unhandled rejection: ${error.message}`,
      undefined,
      error
    ));
  });
}

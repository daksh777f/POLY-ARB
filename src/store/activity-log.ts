/**
 * Activity Log Store - In-memory with database backup
 * Uses ring buffer for in-memory with async DB persistence
 */

import { nanoid } from 'nanoid';
import type { ActivityEntry, ActivitySource, ActivityLevel } from '@/lib/types';

const MAX_ENTRIES = 200;
const entries: ActivityEntry[] = [];

// Database backup (fire-and-forget, non-blocking)
async function backupToDatabase(entry: ActivityEntry): Promise<void> {
  try {
    const { db, schema } = await import('@/db');
    db.insert(schema.activityLog).values({
      id: entry.id,
      source: entry.source as 'orchestrator' | 'scanner' | 'trading' | 'system',
      level: entry.level,
      message: entry.message,
      details: entry.details ? JSON.stringify(entry.details) : null,
      createdAt: entry.timestamp,
    }).run();
  } catch {
    // Silently fail - DB backup is non-critical
  }
}

export function logActivity(
  source: ActivitySource,
  level: ActivityLevel,
  message: string,
  details?: Record<string, unknown>,
): void {
  const entry: ActivityEntry = {
    id: `act_${nanoid(12)}`,
    timestamp: new Date().toISOString(),
    source,
    level,
    message,
    details,
  };

  entries.push(entry);

  // Ring buffer: drop oldest when over limit
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  // Async backup to database (non-blocking)
  backupToDatabase(entry);

  // Console output for dev visibility
  const prefix = `[${source}]`;
  if (level === 'error') {
    console.error(prefix, message);
  } else if (level === 'warn') {
    console.warn(prefix, message);
  } else {
    console.log(prefix, message);
  }
}

export function getActivityLog(limit = 50): ActivityEntry[] {
  const start = Math.max(0, entries.length - limit);
  return entries.slice(start).reverse(); // newest first
}

export function getActivityCount(): number {
  return entries.length;
}

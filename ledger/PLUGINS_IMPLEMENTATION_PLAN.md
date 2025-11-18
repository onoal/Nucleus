# Plugins Implementatie Plan - 4 Plugins

## 📋 Overzicht

Dit document beschrijft het gedetailleerde implementatieplan voor 4 plugins:
1. **Audit Log Plugin** - Compliance tracking
2. **Rate Limiting Plugin** - Abuse prevention
3. **Encryption Plugin** - Data privacy
4. **Analytics Plugin** - Usage tracking

Voor elke stap wordt beschreven: **Wat**, **Waar**, **Waarom**, en **Hoe**.

---

## 🔍 Codebase Analyse

### Huidige Plugin Structuur

**Locatie**: `ledger/framework/src/core/types.ts`

**Plugin Interface**:
```typescript
export interface OnoalLedgerPlugin {
  id: string;
  version: string;
  hooks?: {
    beforeAppend?: (entry, ledger) => Promise<void>;
    afterAppend?: (entry, ledger) => Promise<void>;
    beforeQuery?: (filters, ledger) => Promise<void | {...}>;
    afterQuery?: (result, filters, ledger) => Promise<{...}>;
    beforeGet?: (id, ledger) => Promise<void | LedgerEntry>;
    afterGet?: (entry, ledger) => Promise<LedgerEntry | null>;
    beforeVerifyChain?: (startId, limit, ledger) => Promise<void>;
    afterVerifyChain?: (result, ledger) => Promise<ChainVerificationResult>;
  };
}
```

**Plugin Registratie**: `ledger.use(plugin)` in `ledger.ts:1223`

**Hook Execution**: Hooks worden uitgevoerd in `ledger.ts` bij:
- `append()` - regel 518-559 (beforeAppend), 650-680 (afterAppend)
- `query()` - regel ~800+ (beforeQuery, afterQuery)
- `get()` - regel ~900+ (beforeGet, afterGet)
- `verifyChain()` - regel ~1000+ (beforeVerifyChain, afterVerifyChain)

**Plugins Package**: `ledger/plugins/src/` met basis structuur

---

## 📦 Plugin 1: Audit Log Plugin

### Doel
Log alle ledger operaties voor compliance en debugging.

### Stap 1.1: Create Plugin Structure

**Wat**: Maak de basis plugin structuur en types.

**Waar**: `ledger/plugins/src/audit/index.ts`

**Waarom**: 
- Centrale locatie voor audit plugin code
- Type-safe interface voor audit configuratie
- Scheiding van concerns

**Hoe**:
```typescript
import type { OnoalLedgerPlugin } from "@onoal/ledger-framework";

export interface AuditLogPluginOptions {
  logLevel?: "all" | "errors" | "operations";
  storage?: "database" | "file" | "external";
  retention?: string; // "90d", "1y", etc.
  excludeFields?: string[]; // Fields to exclude from logs
  includeMetadata?: boolean;
}

export function auditLogPlugin(
  options: AuditLogPluginOptions = {}
): OnoalLedgerPlugin {
  return {
    id: "audit-log",
    version: "1.0.0",
    hooks: {
      // Will be implemented in next steps
    },
  };
}
```

---

### Stap 1.2: Create Audit Log Storage Schema

**Wat**: Database schema voor audit logs.

**Waar**: `ledger/plugins/src/audit/schema.ts`

**Waarom**:
- Gestructureerde opslag van audit logs
- Query mogelijkheden op audit data
- Performance met indexes

**Hoe**:
```typescript
import { pgTable, text, bigint, jsonb, pgEnum } from "drizzle-orm/pg-core";

export const auditLogLevelEnum = pgEnum("audit_log_level", [
  "operation",
  "error",
  "security",
]);

export const auditLogsPg = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  level: auditLogLevelEnum("level").notNull(),
  operation: text("operation").notNull(), // "append", "query", "get", "verify"
  entryId: text("entry_id"),
  issuerOid: text("issuer_oid"),
  subjectOid: text("subject_oid"),
  requestId: text("request_id"), // For request tracing
  userId: text("user_id"), // From request context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"), // Additional context
  duration: bigint("duration_ms", { mode: "number" }),
  success: text("success").notNull(), // "true" | "false"
  error: text("error"), // Error message if failed
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => ({
  timestampIdx: pgIndex("idx_audit_timestamp").on(table.timestamp),
  operationIdx: pgIndex("idx_audit_operation").on(table.operation),
  issuerOidIdx: pgIndex("idx_audit_issuer_oid").on(table.issuerOid),
  levelIdx: pgIndex("idx_audit_level").on(table.level),
}));
```

---

### Stap 1.3: Implement Audit Log Service

**Wat**: Service voor het schrijven van audit logs.

**Waar**: `ledger/plugins/src/audit/service.ts`

**Waarom**:
- Centralized logging logic
- Verschillende storage backends (database, file, external)
- Error handling en retry logic

**Hoe**:
```typescript
import type { LedgerDatabase } from "@onoal/ledger-framework";
import type { AuditLogPluginOptions } from "./index.js";

export class AuditLogService {
  constructor(
    private db: LedgerDatabase,
    private options: AuditLogPluginOptions
  ) {}

  async log(entry: {
    level: "operation" | "error" | "security";
    operation: string;
    entryId?: string;
    issuerOid?: string;
    subjectOid?: string;
    requestId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    duration?: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    // Check log level filter
    if (this.options.logLevel === "errors" && entry.level !== "error") {
      return;
    }

    const auditLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level: entry.level,
      operation: entry.operation,
      entryId: entry.entryId,
      issuerOid: entry.issuerOid,
      subjectOid: entry.subjectOid,
      requestId: entry.requestId,
      userId: entry.userId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      metadata: this.options.includeMetadata ? entry.metadata : undefined,
      duration: entry.duration,
      success: entry.success ? "true" : "false",
      error: entry.error,
      createdAt: Date.now(),
    };

    // Store based on storage option
    if (this.options.storage === "database") {
      await this.storeInDatabase(auditLog);
    } else if (this.options.storage === "file") {
      await this.storeInFile(auditLog);
    } else if (this.options.storage === "external") {
      await this.storeExternally(auditLog);
    }
  }

  private async storeInDatabase(log: any): Promise<void> {
    // Insert into audit_logs table
    // Use database adapter
  }

  private async storeInFile(log: any): Promise<void> {
    // Write to file system
    // JSONL format for easy parsing
  }

  private async storeExternally(log: any): Promise<void> {
    // Send to external service (webhook, API, etc.)
  }
}
```

---

### Stap 1.4: Implement Plugin Hooks

**Wat**: Implementeer alle plugin hooks voor audit logging.

**Waar**: `ledger/plugins/src/audit/index.ts` (update)

**Waarom**:
- Hook into alle ledger operaties
- Capture context (request, user, timing)
- Log errors en successes

**Hoe**:
```typescript
export function auditLogPlugin(
  options: AuditLogPluginOptions = {}
): OnoalLedgerPlugin {
  const service = new AuditLogService(db, options); // db from ledger context
  
  return {
    id: "audit-log",
    version: "1.0.0",
    hooks: {
      beforeAppend: async (entry, ledger) => {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        
        // Store in plugin context for afterAppend
        (ledger as any)._auditContext = {
          requestId,
          startTime,
          operation: "append",
        };
      },
      
      afterAppend: async (entryWithProof, ledger) => {
        const context = (ledger as any)._auditContext;
        const duration = Date.now() - (context?.startTime || Date.now());
        
        await service.log({
          level: "operation",
          operation: "append",
          entryId: entryWithProof.id,
          issuerOid: entryWithProof.payload.issuer_oid,
          subjectOid: entryWithProof.payload.subject_oid,
          requestId: context?.requestId,
          duration,
          success: true,
        });
      },
      
      beforeQuery: async (filters, ledger) => {
        const startTime = Date.now();
        (ledger as any)._auditQueryContext = { startTime };
      },
      
      afterQuery: async (result, filters, ledger) => {
        const context = (ledger as any)._auditQueryContext;
        const duration = Date.now() - (context?.startTime || Date.now());
        
        await service.log({
          level: "operation",
          operation: "query",
          issuerOid: filters.issuer_oid,
          subjectOid: filters.subject_oid,
          metadata: { filters, resultCount: result.entries.length },
          duration,
          success: true,
        });
        
        return result;
      },
      
      // Similar for beforeGet, afterGet, beforeVerifyChain, afterVerifyChain
    },
  };
}
```

---

### Stap 1.5: Add Error Handling

**Wat**: Error logging en exception handling.

**Waar**: `ledger/plugins/src/audit/service.ts` (update)

**Waarom**:
- Log errors zonder de operatie te blokkeren
- Retry logic voor failed logs
- Graceful degradation

**Hoe**:
```typescript
async log(entry: {...}): Promise<void> {
  try {
    // ... existing log logic
  } catch (error) {
    // Don't throw - audit logging should never break operations
    console.error("Audit log failed:", error);
    
    // Optionally: retry or queue for later
    if (this.options.retryOnFailure) {
      await this.retryLog(entry);
    }
  }
}
```

---

### Stap 1.6: Add Retention Policy

**Wat**: Automatische cleanup van oude audit logs.

**Waar**: `ledger/plugins/src/audit/retention.ts`

**Waarom**:
- Compliance met data retention policies
- Database size management
- Performance optimalisatie

**Hoe**:
```typescript
export class RetentionPolicy {
  constructor(
    private db: LedgerDatabase,
    private retention: string // "90d", "1y"
  ) {}

  async cleanup(): Promise<number> {
    const retentionMs = this.parseRetention(this.retention);
    const cutoffDate = Date.now() - retentionMs;
    
    // Delete old logs
    const deleted = await this.db.execute(sql`
      DELETE FROM audit_logs
      WHERE timestamp < ${cutoffDate}
    `);
    
    return deleted.rowCount || 0;
  }

  private parseRetention(retention: string): number {
    // Parse "90d" -> 90 days in ms
    // Parse "1y" -> 1 year in ms
  }
}
```

---

## 🚦 Plugin 2: Rate Limiting Plugin

### Doel
Voorkom abuse door rate limiting op ledger operaties.

### Stap 2.1: Create Plugin Structure

**Wat**: Basis plugin structuur voor rate limiting.

**Waar**: `ledger/plugins/src/rate-limit/index.ts`

**Waarom**:
- Type-safe configuratie
- Centrale plugin interface

**Hoe**:
```typescript
import type { OnoalLedgerPlugin } from "@onoal/ledger-framework";

export interface RateLimitPluginOptions {
  limits: {
    append?: { requests: number; window: string }; // "100/1m"
    query?: { requests: number; window: string };
    verify?: { requests: number; window: string };
  };
  storage?: "memory" | "redis";
  keyGenerator?: (context: any) => string; // Custom key generation
  onLimitExceeded?: (key: string, limit: number) => void; // Callback
}

export function rateLimitPlugin(
  options: RateLimitPluginOptions
): OnoalLedgerPlugin {
  return {
    id: "rate-limit",
    version: "1.0.0",
    hooks: {
      // Will be implemented
    },
  };
}
```

---

### Stap 2.2: Implement Rate Limiter Service

**Wat**: Rate limiting logic met sliding window of token bucket.

**Waar**: `ledger/plugins/src/rate-limit/service.ts`

**Waarom**:
- Centralized rate limiting logic
- Support voor verschillende algoritmes
- Storage abstraction (memory, redis)

**Hoe**:
```typescript
export class RateLimiter {
  constructor(
    private storage: "memory" | "redis",
    private redisClient?: any
  ) {}

  async checkLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    if (this.storage === "memory") {
      return this.checkMemoryLimit(key, limit, windowMs);
    } else {
      return this.checkRedisLimit(key, limit, windowMs);
    }
  }

  private async checkMemoryLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    // In-memory sliding window
    const now = Date.now();
    const window = this.getOrCreateWindow(key, windowMs);
    
    // Remove old entries
    window.requests = window.requests.filter(
      (ts) => ts > now - windowMs
    );
    
    const allowed = window.requests.length < limit;
    if (allowed) {
      window.requests.push(now);
    }
    
    return {
      allowed,
      remaining: Math.max(0, limit - window.requests.length),
      resetAt: now + windowMs,
    };
  }

  private async checkRedisLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    // Redis-based rate limiting
    // Use Redis INCR with EXPIRE
  }
}
```

---

### Stap 2.3: Implement Plugin Hooks

**Wat**: Rate limiting checks in beforeAppend, beforeQuery hooks.

**Waar**: `ledger/plugins/src/rate-limit/index.ts` (update)

**Waarom**:
- Block operaties die rate limit overschrijden
- Different limits per operatie type
- Custom key generation (per user, IP, etc.)

**Hoe**:
```typescript
export function rateLimitPlugin(
  options: RateLimitPluginOptions
): OnoalLedgerPlugin {
  const limiter = new RateLimiter(options.storage || "memory");
  
  return {
    id: "rate-limit",
    version: "1.0.0",
    hooks: {
      beforeAppend: async (entry, ledger) => {
        const limit = options.limits.append;
        if (!limit) return;
        
        // Generate key (user, IP, etc.)
        const key = options.keyGenerator
          ? options.keyGenerator({ entry, ledger })
          : `append:${entry.issuer_oid}`;
        
        // Parse window (e.g., "1m" -> 60000ms)
        const windowMs = parseWindow(limit.window);
        
        // Check limit
        const result = await limiter.checkLimit(key, limit.requests, windowMs);
        
        if (!result.allowed) {
          if (options.onLimitExceeded) {
            options.onLimitExceeded(key, limit.requests);
          }
          throw new Error(
            `Rate limit exceeded: ${limit.requests} requests per ${limit.window}`
          );
        }
      },
      
      beforeQuery: async (filters, ledger) => {
        const limit = options.limits.query;
        if (!limit) return;
        
        const key = options.keyGenerator
          ? options.keyGenerator({ filters, ledger })
          : `query:${filters.issuer_oid || "anonymous"}`;
        
        const windowMs = parseWindow(limit.window);
        const result = await limiter.checkLimit(key, limit.requests, windowMs);
        
        if (!result.allowed) {
          throw new Error(
            `Rate limit exceeded: ${limit.requests} requests per ${limit.window}`
          );
        }
      },
      
      // Similar for beforeVerifyChain
    },
  };
}
```

---

### Stap 2.4: Add Redis Support

**Wat**: Redis adapter voor distributed rate limiting.

**Waar**: `ledger/plugins/src/rate-limit/redis.ts`

**Waarom**:
- Distributed rate limiting (multi-instance)
- Persistent storage
- Better performance at scale

**Hoe**:
```typescript
import type { RedisClientType } from "redis";

export class RedisRateLimiter {
  constructor(private redis: RedisClientType) {}

  async checkLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const redisKey = `rate_limit:${key}`;
    const now = Date.now();
    
    // Use Redis INCR with EXPIRE
    const count = await this.redis.incr(redisKey);
    
    if (count === 1) {
      // First request, set expiration
      await this.redis.expire(redisKey, Math.ceil(windowMs / 1000));
    }
    
    const allowed = count <= limit;
    const ttl = await this.redis.ttl(redisKey);
    
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      resetAt: now + (ttl * 1000),
    };
  }
}
```

---

## 🔐 Plugin 3: Encryption Plugin

### Doel
Encrypt sensitive fields in payloads voor data privacy.

### Stap 3.1: Create Plugin Structure

**Wat**: Basis plugin structuur voor encryption.

**Waar**: `ledger/plugins/src/encryption/index.ts`

**Waarom**:
- Type-safe configuratie
- Field-level encryption support

**Hoe**:
```typescript
import type { OnoalLedgerPlugin } from "@onoal/ledger-framework";

export interface EncryptionPluginOptions {
  algorithm?: "AES-256-GCM" | "AES-256-CBC";
  keyDerivation?: "PBKDF2" | "scrypt";
  encryptFields?: string[]; // Fields to encrypt
  keyRotation?: boolean;
  encryptionKey?: string | Uint8Array; // Or from env
}

export function encryptionPlugin(
  options: EncryptionPluginOptions
): OnoalLedgerPlugin {
  return {
    id: "encryption",
    version: "1.0.0",
    hooks: {
      // Will be implemented
    },
  };
}
```

---

### Stap 3.2: Implement Encryption Service

**Wat**: Encryption/decryption service met field-level support.

**Waar**: `ledger/plugins/src/encryption/service.ts`

**Waarom**:
- Centralized encryption logic
- Support voor verschillende algoritmes
- Key management

**Hoe**:
```typescript
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "crypto";

export class EncryptionService {
  private key: Buffer;
  
  constructor(
    private algorithm: string = "aes-256-gcm",
    private encryptionKey: string | Uint8Array
  ) {
    // Derive key from encryptionKey
    this.key = this.deriveKey(encryptionKey);
  }

  encryptField(value: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(value, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag();
    
    // Return: iv:authTag:encrypted
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  decryptField(encryptedValue: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedValue.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  }

  encryptPayload(
    payload: Record<string, unknown>,
    fieldsToEncrypt: string[]
  ): Record<string, unknown> {
    const encrypted = { ...payload };
    
    for (const field of fieldsToEncrypt) {
      if (field in encrypted && typeof encrypted[field] === "string") {
        encrypted[field] = this.encryptField(encrypted[field] as string);
      }
    }
    
    return encrypted;
  }

  decryptPayload(
    payload: Record<string, unknown>,
    fieldsToEncrypt: string[]
  ): Record<string, unknown> {
    const decrypted = { ...payload };
    
    for (const field of fieldsToEncrypt) {
      if (field in decrypted && typeof decrypted[field] === "string") {
        const value = decrypted[field] as string;
        if (this.isEncrypted(value)) {
          decrypted[field] = this.decryptField(value);
        }
      }
    }
    
    return decrypted;
  }

  private isEncrypted(value: string): boolean {
    // Check format: iv:authTag:encrypted
    return value.split(":").length === 3;
  }

  private deriveKey(key: string | Uint8Array): Buffer {
    // Use PBKDF2 or scrypt
  }
}
```

---

### Stap 3.3: Implement Plugin Hooks

**Wat**: Encrypt bij append, decrypt bij get/query.

**Waar**: `ledger/plugins/src/encryption/index.ts` (update)

**Waarom**:
- Transparent encryption/decryption
- Field-level control
- No changes needed in application code

**Hoe**:
```typescript
export function encryptionPlugin(
  options: EncryptionPluginOptions
): OnoalLedgerPlugin {
  const encryptionService = new EncryptionService(
    options.algorithm || "aes-256-gcm",
    options.encryptionKey || process.env.LEDGER_ENCRYPTION_KEY!
  );
  
  const fieldsToEncrypt = options.encryptFields || [];
  
  return {
    id: "encryption",
    version: "1.0.0",
    hooks: {
      beforeAppend: async (entry, ledger) => {
        // Encrypt specified fields in payload
        if (fieldsToEncrypt.length > 0 && entry.payload) {
          entry.payload = encryptionService.encryptPayload(
            entry.payload as Record<string, unknown>,
            fieldsToEncrypt
          );
        }
      },
      
      afterGet: async (entry, id, ledger) => {
        // Decrypt fields when retrieving
        if (entry && fieldsToEncrypt.length > 0) {
          const decryptedPayload = encryptionService.decryptPayload(
            entry.payload as Record<string, unknown>,
            fieldsToEncrypt
          );
          return {
            ...entry,
            payload: decryptedPayload,
          };
        }
        return entry;
      },
      
      afterQuery: async (result, filters, ledger) => {
        // Decrypt fields in query results
        if (fieldsToEncrypt.length > 0) {
          result.entries = result.entries.map((entry) => {
            const decryptedPayload = encryptionService.decryptPayload(
              entry.payload as Record<string, unknown>,
              fieldsToEncrypt
            );
            return {
              ...entry,
              payload: decryptedPayload,
            };
          });
        }
        return result;
      },
    },
  };
}
```

---

### Stap 3.4: Add Key Rotation Support

**Wat**: Key rotation mechanisme voor security.

**Waar**: `ledger/plugins/src/encryption/rotation.ts`

**Waarom**:
- Security best practice
- Compliance requirements
- Support voor multiple keys

**Hoe**:
```typescript
export class KeyRotationService {
  async rotateKey(
    oldKey: string,
    newKey: string,
    entries: LedgerEntry[]
  ): Promise<void> {
    // Re-encrypt all entries with new key
    // This is a background process
    for (const entry of entries) {
      // Decrypt with old key
      // Encrypt with new key
      // Update entry in database
    }
  }
}
```

---

## 📊 Plugin 4: Analytics Plugin

### Doel
Track usage patterns en metrics voor product decisions.

### Stap 4.1: Create Plugin Structure

**Wat**: Basis plugin structuur voor analytics.

**Waar**: `ledger/plugins/src/analytics/index.ts`

**Waarom**:
- Type-safe configuratie
- Multiple provider support

**Hoe**:
```typescript
import type { OnoalLedgerPlugin } from "@onoal/ledger-framework";

export interface AnalyticsPluginOptions {
  provider?: "mixpanel" | "segment" | "custom";
  apiKey?: string;
  trackEvents?: string[]; // ["append", "query", "verify"]
  anonymize?: boolean; // GDPR compliance
  batchSize?: number; // Batch events
  flushInterval?: number; // Flush interval in ms
}

export function analyticsPlugin(
  options: AnalyticsPluginOptions
): OnoalLedgerPlugin {
  return {
    id: "analytics",
    version: "1.0.0",
    hooks: {
      // Will be implemented
    },
  };
}
```

---

### Stap 4.2: Implement Analytics Service

**Wat**: Analytics service met multiple provider support.

**Waar**: `ledger/plugins/src/analytics/service.ts`

**Waarom**:
- Provider abstraction
- Event batching
- Error handling

**Hoe**:
```typescript
export class AnalyticsService {
  private eventQueue: Array<AnalyticsEvent> = [];
  private flushTimer?: NodeJS.Timeout;
  
  constructor(
    private provider: string,
    private apiKey: string,
    private batchSize: number = 100,
    private flushInterval: number = 5000
  ) {
    this.startFlushTimer();
  }

  track(event: AnalyticsEvent): void {
    this.eventQueue.push(event);
    
    if (this.eventQueue.length >= this.batchSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;
    
    const events = this.eventQueue.splice(0, this.batchSize);
    
    try {
      if (this.provider === "mixpanel") {
        await this.sendToMixpanel(events);
      } else if (this.provider === "segment") {
        await this.sendToSegment(events);
      } else if (this.provider === "custom") {
        await this.sendCustom(events);
      }
    } catch (error) {
      console.error("Analytics flush failed:", error);
      // Re-queue events for retry
      this.eventQueue.unshift(...events);
    }
  }

  private async sendToMixpanel(events: AnalyticsEvent[]): Promise<void> {
    // Send to Mixpanel API
  }

  private async sendToSegment(events: AnalyticsEvent[]): Promise<void> {
    // Send to Segment API
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }
}
```

---

### Stap 4.3: Implement Plugin Hooks

**Wat**: Track events in afterAppend, afterQuery hooks.

**Waar**: `ledger/plugins/src/analytics/index.ts` (update)

**Waarom**:
- Track usage patterns
- Measure performance
- User behavior analysis

**Hoe**:
```typescript
export function analyticsPlugin(
  options: AnalyticsPluginOptions
): OnoalLedgerPlugin {
  const analyticsService = new AnalyticsService(
    options.provider || "custom",
    options.apiKey || "",
    options.batchSize || 100,
    options.flushInterval || 5000
  );
  
  const trackEvents = options.trackEvents || ["append", "query", "verify"];
  
  return {
    id: "analytics",
    version: "1.0.0",
    hooks: {
      afterAppend: async (entryWithProof, ledger) => {
        if (!trackEvents.includes("append")) return;
        
        analyticsService.track({
          event: "ledger.append",
          properties: {
            entryId: entryWithProof.id,
            type: entryWithProof.payload.type,
            issuerOid: options.anonymize
              ? this.anonymize(entryWithProof.payload.issuer_oid)
              : entryWithProof.payload.issuer_oid,
            stream: entryWithProof.stream,
            timestamp: entryWithProof.timestamp,
          },
        });
      },
      
      afterQuery: async (result, filters, ledger) => {
        if (!trackEvents.includes("query")) return;
        
        analyticsService.track({
          event: "ledger.query",
          properties: {
            resultCount: result.entries.length,
            stream: filters.stream,
            hasMore: result.hasMore,
            filters: options.anonymize
              ? this.anonymizeFilters(filters)
              : filters,
          },
        });
        
        return result;
      },
      
      afterVerifyChain: async (result, ledger) => {
        if (!trackEvents.includes("verify")) return;
        
        analyticsService.track({
          event: "ledger.verify",
          properties: {
            valid: result.valid,
            entriesChecked: result.entries_checked,
            duration: result.verification_duration_ms,
          },
        });
        
        return result;
      },
    },
  };
}
```

---

### Stap 4.4: Add Anonymization

**Wat**: GDPR-compliant anonymization.

**Waar**: `ledger/plugins/src/analytics/anonymize.ts`

**Waarom**:
- GDPR compliance
- Privacy protection
- Data minimization

**Hoe**:
```typescript
import { createHash } from "crypto";

export function anonymize(value: string): string {
  // Hash with salt for consistent anonymization
  const salt = process.env.ANALYTICS_SALT || "default-salt";
  return createHash("sha256")
    .update(value + salt)
    .digest("hex")
    .substring(0, 16); // Short hash
}

export function anonymizeFilters(filters: any): any {
  const anonymized = { ...filters };
  
  if (anonymized.issuer_oid) {
    anonymized.issuer_oid = anonymize(anonymized.issuer_oid);
  }
  
  if (anonymized.subject_oid) {
    anonymized.subject_oid = anonymize(anonymized.subject_oid);
  }
  
  return anonymized;
}
```

---

## 🔧 Integratie Stappen

### Stap 5.1: Update Plugins Package Exports

**Wat**: Export alle plugins vanuit main index.

**Waar**: `ledger/plugins/src/index.ts`

**Waarom**:
- Centralized exports
- Easy import voor gebruikers

**Hoe**:
```typescript
export { auditLogPlugin } from "./audit/index.js";
export { rateLimitPlugin } from "./rate-limit/index.js";
export { encryptionPlugin } from "./encryption/index.js";
export { analyticsPlugin } from "./analytics/index.js";

export type { AuditLogPluginOptions } from "./audit/index.js";
export type { RateLimitPluginOptions } from "./rate-limit/index.js";
export type { EncryptionPluginOptions } from "./encryption/index.js";
export type { AnalyticsPluginOptions } from "./analytics/index.js";
```

---

### Stap 5.2: Update Package Dependencies

**Wat**: Voeg benodigde dependencies toe.

**Waar**: `ledger/plugins/package.json`

**Waarom**:
- Crypto libraries voor encryption
- Redis client voor rate limiting
- Analytics SDKs

**Hoe**:
```json
{
  "dependencies": {
    "@onoal/ledger-framework": "workspace:*",
    "redis": "^4.6.0",
    "mixpanel": "^0.18.0",
    "@segment/analytics-node": "^1.0.0"
  }
}
```

---

### Stap 5.3: Create Usage Examples

**Wat**: Documentatie en voorbeelden.

**Waar**: `ledger/plugins/README.md`

**Waarom**:
- Developer onboarding
- Best practices
- Configuration examples

**Hoe**:
```markdown
# Ledger Plugins

## Usage

```typescript
import { createLedger } from "@onoal/ledger-framework";
import {
  auditLogPlugin,
  rateLimitPlugin,
  encryptionPlugin,
  analyticsPlugin,
} from "@onoal/ledger-plugins";

const ledger = await createLedger({
  // ... config
});

// Use plugins
ledger
  .use(auditLogPlugin({ storage: "database" }))
  .use(rateLimitPlugin({ limits: { append: { requests: 100, window: "1m" } } }))
  .use(encryptionPlugin({ encryptFields: ["ssn", "email"] }))
  .use(analyticsPlugin({ provider: "mixpanel", apiKey: "..." }));
```
```

---

## 📋 Implementatie Volgorde

### Fase 1: Basis Structuur (Week 1)
1. ✅ Stap 1.1: Audit Log Plugin Structure
2. ✅ Stap 2.1: Rate Limit Plugin Structure
3. ✅ Stap 3.1: Encryption Plugin Structure
4. ✅ Stap 4.1: Analytics Plugin Structure

### Fase 2: Core Implementatie (Week 2)
5. ✅ Stap 1.2-1.4: Audit Log Service & Hooks
6. ✅ Stap 2.2-2.3: Rate Limiter Service & Hooks
7. ✅ Stap 3.2-3.3: Encryption Service & Hooks
8. ✅ Stap 4.2-4.3: Analytics Service & Hooks

### Fase 3: Advanced Features (Week 3)
9. ✅ Stap 1.5-1.6: Audit Error Handling & Retention
10. ✅ Stap 2.4: Redis Support voor Rate Limiting
11. ✅ Stap 3.4: Key Rotation voor Encryption
12. ✅ Stap 4.4: Anonymization voor Analytics

### Fase 4: Integratie & Testing (Week 4)
13. ✅ Stap 5.1-5.2: Package Exports & Dependencies
14. ✅ Stap 5.3: Documentation & Examples
15. ✅ Testing & Bug Fixes
16. ✅ Performance Optimization

---

## ✅ Checklist

### Audit Log Plugin
- [ ] Plugin structure
- [ ] Database schema
- [ ] Service implementation
- [ ] Hook implementation
- [ ] Error handling
- [ ] Retention policy

### Rate Limit Plugin
- [ ] Plugin structure
- [ ] Rate limiter service
- [ ] Hook implementation
- [ ] Redis support

### Encryption Plugin
- [ ] Plugin structure
- [ ] Encryption service
- [ ] Hook implementation
- [ ] Key rotation

### Analytics Plugin
- [ ] Plugin structure
- [ ] Analytics service
- [ ] Hook implementation
- [ ] Anonymization

### Integratie
- [ ] Package exports
- [ ] Dependencies
- [ ] Documentation
- [ ] Examples

---

## 🎯 Conclusie

Dit plan beschrijft de implementatie van 4 plugins met:
- **30+ stappen** met duidelijke wat/waar/waarom/hoe
- **4 weken** implementatie tijd
- **Type-safe** interfaces
- **Production-ready** features
- **Comprehensive** error handling

**Volgende stap**: Begin met Fase 1 - Basis Structuur voor alle 4 plugins.


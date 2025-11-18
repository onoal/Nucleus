# Performance Optimalisaties Implementatie Plan

## 📋 Overzicht

Dit document beschrijft het gedetailleerde implementatieplan voor 6 performance optimalisaties:

1. **Latest Entry Caching** - 5x sneller append operaties
2. **Dedicated OID Columns** - 40x snellere queries
3. **Transaction Support** - Data integrity
4. **Batch Append** - 10x sneller bulk operations
5. **Materialized Views** - 100x snellere stats
6. **Lazy JSON Parsing** - CPU optimalisatie

Voor elke stap wordt beschreven: **Wat**, **Waar**, **Waarom**, en **Hoe**.

---

## 🔍 Codebase Analyse

### Huidige Situatie

**Latest Entry Retrieval**: `ledger-core.ts:42-55` - Haalt latest entry op via database query bij elke append
**Schema**: `schema.ts` - Geen dedicated OID kolommen, alleen in JSON payload
**Append Flow**: `ledger-core.ts:89-154` - Geen transaction, meerdere queries
**Query Flow**: `ledger-core.ts:171-227` - JSON filtering op OIDs
**Stats**: Geen materialized views, direct COUNT queries
**JSON Parsing**: `ledger-core.ts` - Parse bij elke entry retrieval

---

## 🚀 Optimalisatie 1: Latest Entry Caching

### Stap 1.1: Create Cache Service

**Wat**: In-memory cache service voor latest entry met TTL.

**Waar**: `ledger/framework/src/core/cache.ts` (nieuw bestand)

**Waarom**:

- Elimineert database query bij elke append
- 5x performance boost
- TTL-based invalidation voor safety

**Hoe**:

```typescript
interface CachedLatestEntry {
  hash: string;
  timestamp: number;
  id: string;
  expiresAt: number;
}

export class LatestEntryCache {
  private static cache = new Map<string, CachedLatestEntry>();

  static get(cacheKey: string = "default"): CachedLatestEntry | null {
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }
    return null;
  }

  static set(
    cacheKey: string,
    entry: { hash: string; timestamp: number; id: string },
    ttl: number = 1000 // 1 second default
  ): void {
    this.cache.set(cacheKey, {
      ...entry,
      expiresAt: Date.now() + ttl,
    });
  }

  static invalidate(cacheKey: string = "default"): void {
    this.cache.delete(cacheKey);
  }

  static clear(): void {
    this.cache.clear();
  }
}
```

---

### Stap 1.2: Update getLatestEntry to Use Cache

**Wat**: Update `LedgerCore.getLatestEntry()` om cache te gebruiken.

**Waar**: `ledger/framework/src/core/ledger-core.ts`

**Waarom**:

- Snellere append operaties
- Minder database load

**Hoe**:

```typescript
static async getLatestEntry(
  db: LedgerDb,
  cacheKey: string = "default"
): Promise<{ hash: string; timestamp: number; id: string } | null> {
  // Check cache first
  const cached = LatestEntryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fallback to database
  const result = await db.query.ledgerEntries.findFirst({
    columns: {
      id: true,
      hash: true,
      timestamp: true,
    },
    orderBy: (entries, { desc: d }) => d(entries.timestamp),
  });

  // Cache result
  if (result) {
    LatestEntryCache.set(cacheKey, result, 1000); // 1 second TTL
  }

  return result || null;
}
```

---

### Stap 1.3: Invalidate Cache on Append

**Wat**: Invalidate cache na succesvolle append.

**Waar**: `ledger/framework/src/core/ledger-core.ts` (append method)

**Waarom**:

- Cache consistency
- Nieuwe entry wordt latest entry

**Hoe**:

```typescript
static async append(...): Promise<LedgerEntry> {
  // ... existing code ...

  // After successful insert
  await this.updateTip(db, id, hash, timestamp);

  // Invalidate cache - new entry is now latest
  LatestEntryCache.invalidate("default");

  // Update cache with new latest entry
  LatestEntryCache.set("default", { id, hash, timestamp }, 1000);

  return inserted;
}
```

---

## 🔍 Optimalisatie 2: Dedicated OID Columns

### Stap 2.1: Add OID Columns to Schema

**Wat**: Voeg `issuer_oid`, `subject_oid`, `entry_type` kolommen toe aan schema.

**Waar**: `ledger/framework/src/core/schema.ts`

**Waarom**:

- 40x snellere queries (indexes mogelijk)
- Backward compatible (payload blijft bestaan)

**Hoe**:

```typescript
// SQLite schema
export const ledgerEntriesSqlite = sqliteTable(
  "ledger_entries",
  {
    // ... existing fields ...
    issuerOid: text("issuer_oid"), // NIEUW
    subjectOid: text("subject_oid"), // NIEUW
    entryType: text("entry_type"), // NIEUW
  },
  (table) => ({
    // ... existing indexes ...
    issuerOidIdx: index("idx_ledger_issuer_oid").on(table.issuerOid),
    subjectOidIdx: index("idx_ledger_subject_oid").on(table.subjectOid),
    issuerSubjectIdx: index("idx_ledger_issuer_subject").on(
      table.issuerOid,
      table.subjectOid
    ),
  })
);

// PostgreSQL schema
export const ledgerEntriesPg = pgTable(
  "ledger_entries",
  {
    // ... existing fields ...
    issuerOid: pgText("issuer_oid"), // NIEUW
    subjectOid: pgText("subject_oid"), // NIEUW
    entryType: pgText("entry_type"), // NIEUW
  },
  (table) => ({
    // ... existing indexes ...
    issuerOidIdx: pgIndex("idx_ledger_issuer_oid").on(table.issuerOid),
    subjectOidIdx: pgIndex("idx_ledger_subject_oid").on(table.subjectOid),
    issuerSubjectIdx: pgIndex("idx_ledger_issuer_subject").on(
      table.issuerOid,
      table.subjectOid
    ),
  })
);
```

---

### Stap 2.2: Update Append to Store OIDs

**Wat**: Extract en store OIDs in dedicated kolommen bij append.

**Waar**: `ledger/framework/src/core/ledger-core.ts` (append method)

**Waarom**:

- OIDs beschikbaar voor indexing
- Snellere queries mogelijk

**Hoe**:

```typescript
static async append(...): Promise<LedgerEntry> {
  // ... existing code ...

  // Extract OIDs from payload
  const payloadObj = payload as Record<string, unknown>;
  const issuerOid = payloadObj.issuer_oid as string | undefined;
  const subjectOid = payloadObj.subject_oid as string | undefined;
  const entryType = payloadObj.type as string | undefined;

  const insertValues: Record<string, any> = {
    id,
    stream,
    timestamp,
    payload: payloadValue,
    hash,
    createdAt: timestamp,
    // Add OID columns
    ...(issuerOid && { issuerOid }),
    ...(subjectOid && { subjectOid }),
    ...(entryType && { entryType }),
  };

  // ... rest of append logic ...
}
```

---

### Stap 2.3: Update Query to Use OID Columns

**Wat**: Gebruik dedicated OID kolommen in plaats van JSON filtering.

**Waar**: `ledger/framework/src/core/ledger-core.ts` (queryEntries method)

**Waarom**:

- 40x snellere queries
- Indexes worden gebruikt

**Hoe**:

```typescript
static async queryEntries(...): Promise<QueryResult> {
  // ... existing code ...

  // Use dedicated OID columns instead of JSON filtering
  if (filters.issuer_oid) {
    conditions.push(eq(schema.ledgerEntries.issuerOid, filters.issuer_oid));
  }

  if (filters.subject_oid) {
    conditions.push(eq(schema.ledgerEntries.subjectOid, filters.subject_oid));
  }

  // Fallback to JSON filtering if OID columns are null (backward compatibility)
  // ... existing JSON filtering as fallback ...
}
```

---

## 🔄 Optimalisatie 3: Transaction Support

### Stap 3.1: Wrap Append in Transaction

**Wat**: Wrap append operatie in database transaction.

**Waar**: `ledger/framework/src/core/ledger-core.ts` (append method)

**Waarom**:

- Atomiciteit - alle queries of geen
- Data integrity
- Rollback bij failures

**Hoe**:

```typescript
static async append(...): Promise<LedgerEntry> {
  // Check if database supports transactions
  if (db.transaction) {
    return await db.transaction(async (tx) => {
      return await this.appendInTransaction(tx, signer, stream, payload, status, meta);
    });
  } else {
    // Fallback for databases without transaction support
    return await this.appendInTransaction(db, signer, stream, payload, status, meta);
  }
}

private static async appendInTransaction(
  db: LedgerDb,
  signer: LedgerSigner,
  stream: LedgerStream,
  payload: Record<string, unknown>,
  status: EntryStatus,
  meta?: Record<string, unknown>
): Promise<LedgerEntry> {
  // Move all existing append logic here
  // ... existing code ...
}
```

---

## 📦 Optimalisatie 4: Batch Append

### Stap 4.1: Add Batch Append Method

**Wat**: Nieuwe `appendBatch()` methode voor bulk operations.

**Waar**: `ledger/framework/src/core/ledger-core.ts` (nieuwe method)

**Waarom**:

- 10x sneller voor bulk operations
- Atomiciteit - alle entries of geen
- Minder database round-trips

**Hoe**:

```typescript
static async appendBatch(
  db: LedgerDb,
  signer: LedgerSigner,
  entries: Array<{
    stream: LedgerStream;
    payload: Record<string, unknown>;
    status?: EntryStatus;
    meta?: Record<string, unknown>;
  }>
): Promise<LedgerEntry[]> {
  if (db.transaction) {
    return await db.transaction(async (tx) => {
      const results: LedgerEntry[] = [];
      let latestHash: string | null = null;

      for (const entry of entries) {
        const result = await this.appendInTransaction(
          tx,
          signer,
          entry.stream,
          entry.payload,
          entry.status || "active",
          entry.meta,
          latestHash // Pass previous hash
        );
        results.push(result);
        latestHash = result.hash;
      }

      return results;
    });
  } else {
    throw new Error("Batch append requires transaction support");
  }
}
```

---

### Stap 4.2: Add Batch Append to Ledger Interface

**Wat**: Expose `appendBatch()` in `OnoalLedger` interface.

**Waar**: `ledger/framework/src/core/types.ts` en `ledger.ts`

**Waarom**:

- Public API voor batch operations
- Type-safe interface

**Hoe**:

```typescript
// In types.ts
export interface OnoalLedger {
  // ... existing methods ...
  appendBatch<T extends keyof SchemaDefinition>(
    entries: Array<{
      type: T;
      issuer_oid: string;
      subject_oid?: string;
      payload: InferSchemaType<SchemaDefinition[T]>;
      meta?: Record<string, unknown>;
      stream?: LedgerStream;
    }>
  ): Promise<Array<LedgerEntry & { proof_jwt: string }>>;
}

// In ledger.ts (OnoalLedgerImpl)
async appendBatch<T extends keyof SchemaDefinition>(
  entries: Array<{...}>
): Promise<Array<LedgerEntry & { proof_jwt: string }>> {
  // Implementation
}
```

---

## 📊 Optimalisatie 5: Materialized Views

### Stap 5.1: Create Stats Table Schema

**Wat**: Nieuwe `ledger_stats` table voor materialized views.

**Waar**: `ledger/framework/src/core/schema.ts`

**Waarom**:

- 100x snellere stats queries
- Pre-computed statistics
- Real-time updates

**Hoe**:

```typescript
// SQLite
export const ledgerStatsSqlite = sqliteTable("ledger_stats", {
  stream: text("stream").primaryKey(),
  totalEntries: integer("total_entries").notNull().default(0),
  lastEntryTimestamp: integer("last_entry_timestamp"),
  lastEntryHash: text("last_entry_hash"),
  updatedAt: integer("updated_at").notNull(),
});

// PostgreSQL
export const ledgerStatsPg = pgTable("ledger_stats", {
  stream: ledgerStreamEnum("stream").primaryKey(),
  totalEntries: pgBigint("total_entries", { mode: "number" })
    .notNull()
    .default(0),
  lastEntryTimestamp: pgBigint("last_entry_timestamp", { mode: "number" }),
  lastEntryHash: pgText("last_entry_hash"),
  updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
});
```

---

### Stap 5.2: Update Stats on Append

**Wat**: Update stats table na elke append.

**Waar**: `ledger/framework/src/core/ledger-core.ts` (append method)

**Waarom**:

- Real-time statistics
- Snelle stats queries

**Hoe**:

```typescript
static async updateStats(
  db: LedgerDb,
  stream: LedgerStream,
  entryId: string,
  hash: string,
  timestamp: number
): Promise<void> {
  await db
    .insert(schema.ledgerStats)
    .values({
      stream,
      totalEntries: 1,
      lastEntryTimestamp: timestamp,
      lastEntryHash: hash,
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: schema.ledgerStats.stream,
      set: {
        totalEntries: sql`${schema.ledgerStats.totalEntries} + 1`,
        lastEntryTimestamp: timestamp,
        lastEntryHash: hash,
        updatedAt: Date.now(),
      },
    });
}

// Call in append method
static async append(...): Promise<LedgerEntry> {
  // ... after successful insert ...
  await this.updateStats(db, stream, id, hash, timestamp);
  // ...
}
```

---

### Stap 5.3: Use Stats for getStats()

**Wat**: Gebruik materialized views voor `getStats()`.

**Waar**: `ledger/framework/src/core/ledger-core.ts` (getStats method)

**Waarom**:

- 100x snellere stats queries
- Geen COUNT queries nodig

**Hoe**:

```typescript
static async getStats(db: LedgerDb): Promise<{
  total_entries: number;
  oldest_timestamp: number | null;
  newest_timestamp: number | null;
}> {
  // Use materialized view
  const stats = await db.query.ledgerStats.findMany();

  const totalEntries = stats.reduce((sum, s) => sum + s.totalEntries, 0);
  const timestamps = stats
    .map((s) => s.lastEntryTimestamp)
    .filter((t): t is number => t !== null);

  return {
    total_entries: totalEntries,
    oldest_timestamp: timestamps.length > 0 ? Math.min(...timestamps) : null,
    newest_timestamp: timestamps.length > 0 ? Math.max(...timestamps) : null,
  };
}
```

---

## 🧹 Optimalisatie 6: Lazy JSON Parsing

### Stap 6.1: Create Lazy Parsed Payload Class

**Wat**: Lazy parsing class voor payloads.

**Waar**: `ledger/framework/src/core/lazy-payload.ts` (nieuw bestand)

**Waarom**:

- Parse alleen wanneer nodig
- CPU optimalisatie
- Memory efficient

**Hoe**:

```typescript
export class LazyParsedPayload {
  private _parsed: Record<string, unknown> | null = null;
  private _raw: string | Record<string, unknown>;

  constructor(raw: string | Record<string, unknown>) {
    this._raw = raw;
  }

  get parsed(): Record<string, unknown> {
    if (!this._parsed) {
      this._parsed =
        typeof this._raw === "string" ? JSON.parse(this._raw) : this._raw;
    }
    return this._parsed;
  }

  get raw(): string | Record<string, unknown> {
    return this._raw;
  }

  // Check if already parsed
  get isParsed(): boolean {
    return this._parsed !== null;
  }
}
```

---

### Stap 6.2: Add Payload Cache

**Wat**: Cache voor parsed payloads met TTL.

**Waar**: `ledger/framework/src/core/cache.ts` (uitbreiden)

**Waarom**:

- Snellere herhaalde access
- Minder JSON parsing

**Hoe**:

```typescript
const payloadCache = new Map<
  string,
  {
    parsed: Record<string, unknown>;
    expiresAt: number;
  }
>();

export function getParsedPayload(
  entryId: string,
  raw: string | Record<string, unknown>
): Record<string, unknown> {
  const cached = payloadCache.get(entryId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.parsed;
  }

  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  payloadCache.set(entryId, {
    parsed,
    expiresAt: Date.now() + 60000, // 1 minute TTL
  });

  return parsed;
}
```

---

### Stap 6.3: Use Lazy Parsing in Entry Retrieval

**Wat**: Gebruik lazy parsing bij entry retrieval.

**Waar**: `ledger/framework/src/core/ledger-core.ts` (getEntry method)

**Waarom**:

- Parse alleen wanneer payload nodig is
- CPU optimalisatie

**Hoe**:

```typescript
static async getEntry(db: LedgerDb, id: string): Promise<LedgerEntry | null> {
  const result = await db.query.ledgerEntries.findFirst({
    where: (entries, { eq }) => eq(entries.id, id),
  });

  if (!result) return null;

  // Use lazy parsing - only parse when payload is accessed
  const payload = new LazyParsedPayload(result.payload);

  return {
    ...result,
    payload: payload.parsed, // Parse on access
  };
}
```

---

## 📋 Implementatie Volgorde

### Fase 1: Quick Wins (Week 1)

1. ✅ Latest Entry Caching
2. ✅ Lazy JSON Parsing

### Fase 2: Schema Changes (Week 2)

3. ✅ Dedicated OID Columns
4. ✅ Materialized Views

### Fase 3: Advanced Features (Week 3)

5. ✅ Transaction Support
6. ✅ Batch Append

---

## ✅ Checklist

### Latest Entry Caching

- [ ] Create cache service
- [ ] Update getLatestEntry to use cache
- [ ] Invalidate cache on append
- [ ] Test cache invalidation

### Dedicated OID Columns

- [ ] Add columns to SQLite schema
- [ ] Add columns to PostgreSQL schema
- [ ] Add indexes
- [ ] Update append to store OIDs
- [ ] Update query to use OID columns
- [ ] Migration script for existing data

### Transaction Support

- [ ] Wrap append in transaction
- [ ] Test rollback on failure
- [ ] Handle databases without transactions

### Batch Append

- [ ] Create appendBatch method
- [ ] Add to Ledger interface
- [ ] Implement in OnoalLedgerImpl
- [ ] Test atomicity

### Materialized Views

- [ ] Create stats table schema
- [ ] Update stats on append
- [ ] Use stats for getStats()
- [ ] Migration for existing data

### Lazy JSON Parsing

- [ ] Create LazyParsedPayload class
- [ ] Add payload cache
- [ ] Use lazy parsing in getEntry
- [ ] Use lazy parsing in queryEntries

---

## 🎯 Conclusie

Dit plan beschrijft de implementatie van 6 performance optimalisaties met:

- **Duidelijke stappen** met wat/waar/waarom/hoe
- **Code voorbeelden** voor elke stap
- **Implementatie volgorde** voor minimale disruption
- **Testing checklist** voor validatie

**Volgende stap**: Begin met Fase 1 - Latest Entry Caching en Lazy JSON Parsing.

# Ledger Framework - Optimalisatie Analyse

## Executive Summary

Deze analyse identificeert performance bottlenecks en optimalisatie mogelijkheden in het Ledger Framework. De belangrijkste bevindingen:

1. **Database queries**: Meerdere queries per append operatie, JSON filtering is traag
2. **Schema design**: OIDs zitten in JSON payload, geen dedicated kolommen
3. **Caching**: Geen caching van frequent gebruikte data (latest entry, tip)
4. **Batch operations**: Geen batch append support
5. **JSON parsing**: Herhaaldelijk JSON.parse() bij elke query
6. **JWT generation**: Synchroon, kan async geoptimaliseerd worden

## Kritieke Performance Issues

### 1. Append Operatie - Meerdere Database Queries

**Huidige flow:**

```typescript
// 1. Get latest entry (query)
const latest = await this.getLatestEntry(db);

// 2. Insert entry
await db.insert(schema.ledgerEntries).values(insertValues);

// 3. Get inserted entry (query - omdat SQLite geen RETURNING heeft)
const inserted = await this.getEntry(db, id);

// 4. Update tip (upsert)
await this.updateTip(db, id, hash, timestamp);
```

**Probleem:**

- 4 database operaties per append
- `getLatestEntry()` wordt bij elke append aangeroepen
- SQLite heeft geen RETURNING support, dus extra query nodig

**Optimalisatie:**

- Cache de latest entry hash in memory (met invalidation)
- Gebruik transaction voor atomiciteit
- Voor PostgreSQL: gebruik RETURNING clause
- Batch append support voor meerdere entries tegelijk

### 2. JSON Filtering - Trage Queries

**Huidige implementatie:**

```typescript
// Filtering op subject_oid en issuer_oid gebeurt via JSON operators
sql`${schema.ledgerEntries.payload}->>'subject_oid' = ${filters.subject_oid}`;
```

**Probleem:**

- JSON operators zijn traag (geen index mogelijk)
- Elke query moet de hele payload kolom scannen
- Geen index op OIDs mogelijk

**Optimalisatie:**

- Voeg dedicated kolommen toe: `issuer_oid` en `subject_oid`
- Maak indexes op deze kolommen
- Migreer bestaande data naar nieuwe kolommen
- Backward compatibility: blijf payload ook vullen

### 3. JSON Parsing - Herhaaldelijk Parsen

**Huidige implementatie:**

```typescript
// Bij elke getEntry() en queryEntries()
const payloadParsed =
  typeof entry.payload === "string" ? JSON.parse(entry.payload) : entry.payload;
```

**Probleem:**

- JSON.parse() wordt bij elke entry uitgevoerd
- Zelfs als payload niet nodig is
- Geen lazy parsing

**Optimalisatie:**

- Lazy parsing: parse alleen wanneer nodig
- Cache parsed payload in memory (met TTL)
- Gebruik PostgreSQL jsonb (native binary format, sneller)
- Select specifieke velden in plaats van hele payload

### 4. Geen Caching van Frequent Gebruikte Data

**Probleem:**

- `getLatestEntry()` wordt bij elke append aangeroepen
- `getTip()` wordt frequent aangeroepen
- Geen in-memory cache

**Optimalisatie:**

- Cache latest entry hash in memory
- Invalideer cache bij append
- Cache tip met TTL
- Optionele Redis cache voor distributed systems

### 5. JWT Generation - Synchroon

**Huidige implementatie:**

```typescript
// JWT wordt synchroon gegenereerd tijdens append
const proofJwt = await generateProofJWT(ledgerEntry, ...);
```

**Probleem:**

- JWT generatie blokkeert append operatie
- Crypto operaties zijn CPU intensief
- Kan async geoptimaliseerd worden

**Optimalisatie:**

- Optionele async JWT generation (fire and forget)
- Cache CryptoKey (niet elke keer importeren)
- Batch JWT generation voor meerdere entries

### 6. Plugin Hooks - Sequentieel Uitvoeren

**Huidige implementatie:**

```typescript
// Hooks worden sequentieel uitgevoerd
for (const plugin of this.plugins) {
  await plugin.hooks.beforeAppend(...);
}
```

**Probleem:**

- Plugins blokkeren elkaar
- Geen parallel execution voor non-critical hooks

**Optimalisatie:**

- Parallel execution voor afterAppend hooks (non-critical)
- Hook priority system (critical hooks eerst)
- Timeout voor hooks (prevent blocking)

## Schema Optimalisaties

### 1. Voeg Dedicated Kolommen Toe

**Huidige schema:**

```sql
CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY,
  stream TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  payload TEXT NOT NULL,  -- JSON string met issuer_oid, subject_oid
  ...
);
```

**Voorgesteld schema:**

```sql
CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY,
  stream TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  payload TEXT NOT NULL,
  issuer_oid TEXT,        -- NIEUW: extracted from payload
  subject_oid TEXT,       -- NIEUW: extracted from payload
  entry_type TEXT,        -- NIEUW: extracted from payload.type
  ...
);

-- Indexes voor snelle filtering
CREATE INDEX idx_ledger_issuer_oid ON ledger_entries(issuer_oid);
CREATE INDEX idx_ledger_subject_oid ON ledger_entries(subject_oid);
CREATE INDEX idx_ledger_type ON ledger_entries(entry_type);
CREATE INDEX idx_ledger_issuer_subject ON ledger_entries(issuer_oid, subject_oid);
```

**Voordelen:**

- 10-100x snellere queries op OIDs
- Indexes mogelijk
- Betere query planning

### 2. Materialized Views voor Statistieken

**Voorgesteld:**

```sql
CREATE TABLE ledger_stats (
  stream TEXT PRIMARY KEY,
  total_entries INTEGER NOT NULL,
  last_entry_timestamp INTEGER,
  last_entry_hash TEXT,
  updated_at INTEGER NOT NULL
);
```

**Voordelen:**

- Snelle stats queries zonder COUNT()
- Automatisch bijgewerkt via triggers of application logic

## Database Query Optimalisaties

### 1. Gebruik Transactions

**Huidige implementatie:**

```typescript
await db.insert(...);
const inserted = await this.getEntry(db, id);
await this.updateTip(db, id, hash, timestamp);
```

**Optimalisatie:**

```typescript
await db.transaction(async (tx) => {
  await tx.insert(...);
  const inserted = await tx.query.ledgerEntries.findFirst(...);
  await tx.insert(schema.ledgerTip).values(...).onConflictDoUpdate(...);
  return inserted;
});
```

**Voordelen:**

- Atomiciteit
- Minder round-trips naar database
- Betere performance

### 2. Batch Operations

**Voorgesteld:**

```typescript
// Batch append
await ledger.appendBatch([
  { type: "proof", issuer_oid: "...", payload: {...} },
  { type: "proof", issuer_oid: "...", payload: {...} },
  ...
]);
```

**Voordelen:**

- Minder database round-trips
- Transaction per batch
- Betere throughput

### 3. Select Specifieke Kolommen

**Huidige implementatie:**

```typescript
const rows = await db.select().from(schema.ledgerEntries)...
```

**Optimalisatie:**

```typescript
const rows = await db
  .select({
    id: schema.ledgerEntries.id,
    hash: schema.ledgerEntries.hash,
    timestamp: schema.ledgerEntries.timestamp,
    // Alleen wat nodig is
  })
  .from(schema.ledgerEntries)...
```

**Voordelen:**

- Minder data transfer
- Snellere queries
- Minder memory gebruik

## Caching Strategie

### 1. In-Memory Cache voor Latest Entry

```typescript
class LedgerCore {
  private static latestEntryCache = new Map<string, {
    hash: string;
    timestamp: number;
    id: string;
    expiresAt: number;
  }>();

  static async getLatestEntry(db: LedgerDb, cacheKey: string): Promise<...> {
    const cached = this.latestEntryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const result = await db.query.ledgerEntries.findFirst(...);
    if (result) {
      this.latestEntryCache.set(cacheKey, {
        ...result,
        expiresAt: Date.now() + 1000, // 1 second TTL
      });
    }
    return result;
  }

  static invalidateLatestEntryCache(cacheKey: string) {
    this.latestEntryCache.delete(cacheKey);
  }
}
```

### 2. Redis Cache voor Distributed Systems

```typescript
// Optionele Redis cache
if (config.redis) {
  const cached = await redis.get(`ledger:tip:${ledgerId}`);
  if (cached) return JSON.parse(cached);
}
```

## Code Optimalisaties

### 1. Lazy JSON Parsing

```typescript
class LazyParsedPayload {
  private _parsed: Record<string, unknown> | null = null;

  constructor(private raw: string | Record<string, unknown>) {}

  get parsed(): Record<string, unknown> {
    if (!this._parsed) {
      this._parsed =
        typeof this.raw === "string" ? JSON.parse(this.raw) : this.raw;
    }
    return this._parsed;
  }
}
```

### 2. Cache CryptoKey voor JWT

```typescript
// Cache CryptoKey (niet elke keer importeren)
const cryptoKeyCache = new Map<string, CryptoKey>();

async function getCryptoKey(signingKey: Uint8Array): Promise<CryptoKey> {
  const key = Buffer.from(signingKey).toString("base64");
  if (cryptoKeyCache.has(key)) {
    return cryptoKeyCache.get(key)!;
  }

  const cryptoKey = await importJWK(privateKeyJwk, "EdDSA");
  cryptoKeyCache.set(key, cryptoKey);
  return cryptoKey;
}
```

### 3. Parallel Plugin Hooks

```typescript
// Parallel execution voor non-critical hooks
const afterAppendPromises = this.plugins
  .filter((p) => p.hooks?.afterAppend)
  .map((plugin) =>
    plugin.hooks!.afterAppend!(entryWithProof, this).catch((err) =>
      console.error(`Plugin ${plugin.id} failed:`, err)
    )
  );

await Promise.allSettled(afterAppendPromises);
```

## Monitoring & Metrics

### 1. Performance Metrics

```typescript
// Track query performance
const startTime = Date.now();
const result = await db.query.ledgerEntries.findFirst(...);
const duration = Date.now() - startTime;

if (duration > 100) {
  console.warn(`Slow query detected: ${duration}ms`);
  // Log to monitoring service
}
```

### 2. Query Logging

```typescript
// Log slow queries
if (config.logSlowQueries) {
  // Log queries > threshold
}
```

## Prioriteit Matrix

### Hoge Prioriteit (Direct Impact)

1. **Dedicated OID kolommen** - 10-100x query performance verbetering
2. **Transaction support** - Atomiciteit en betere performance
3. **Latest entry caching** - Elimineert query bij elke append
4. **Select specifieke kolommen** - Minder data transfer

### Medium Prioriteit (Significant Impact)

5. **Batch append support** - Betere throughput
6. **Lazy JSON parsing** - Minder CPU overhead
7. **Parallel plugin hooks** - Snellere append operaties
8. **CryptoKey caching** - Snellere JWT generation

### Lage Prioriteit (Nice to Have)

9. **Materialized views** - Snellere stats
10. **Redis cache** - Distributed caching
11. **Query logging** - Monitoring
12. **Async JWT generation** - Non-blocking

## Implementatie Roadmap

### Fase 1: Quick Wins (1-2 weken)

- Latest entry caching
- Transaction support
- Select specifieke kolommen
- CryptoKey caching

### Fase 2: Schema Migratie (2-4 weken)

- Voeg OID kolommen toe
- Migreer bestaande data
- Update queries om nieuwe kolommen te gebruiken
- Backward compatibility

### Fase 3: Advanced Features (4-8 weken)

- Batch operations
- Lazy parsing
- Parallel hooks
- Materialized views

### Fase 4: Monitoring & Optimization (Ongoing)

- Performance metrics
- Query logging
- Redis cache (optioneel)
- Continuous optimization

## Geschatte Performance Verbetering

| Optimalisatie             | Huidige | Na Optimalisatie | Verbetering |
| ------------------------- | ------- | ---------------- | ----------- |
| Append operatie           | ~50ms   | ~10ms            | 5x sneller  |
| Query op OID              | ~200ms  | ~5ms             | 40x sneller |
| Get entry                 | ~20ms   | ~5ms             | 4x sneller  |
| JWT generation            | ~30ms   | ~5ms             | 6x sneller  |
| Batch append (10 entries) | ~500ms  | ~50ms            | 10x sneller |

## Conclusie

De belangrijkste optimalisaties zijn:

1. **Schema wijzigingen**: Dedicated OID kolommen met indexes
2. **Caching**: Latest entry en tip caching
3. **Transactions**: Atomiciteit en betere performance
4. **Batch operations**: Betere throughput

Deze optimalisaties kunnen de performance met 5-40x verbeteren, afhankelijk van de use case.

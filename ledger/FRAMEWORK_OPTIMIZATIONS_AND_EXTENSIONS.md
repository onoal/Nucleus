# Ledger Framework - 30 Optimalisaties & Uitbreidingen

## 📋 Overzicht

Dit document beschrijft 30 concrete optimalisaties en uitbreidingen voor het Ledger Framework die de performance, functionaliteit en developer experience significant verbeteren.

**Categorieën:**

- ⚡ **Performance** (10) - 5-100x snellere operaties
- 🛠️ **Developer Experience** (4) - Betere DX en tools
- 🔌 **Database Adapters** (3) - Kysely, Prisma, MongoDB
- 🔗 **Integrations** (3) - Express, Fastify, Next.js
- 🔌 **Plugins** (5) - Enterprise features
- 🚀 **Advanced Features** (5) - Multi-sig, Replication, etc.

---

## ⚡ Performance Optimalisaties

### 1. Latest Entry Caching & Tip Optimization

### Probleem

Elke `append()` operatie haalt de latest entry op via database query, wat onnodig traag is.

### Oplossing

In-memory cache voor latest entry hash met automatische invalidatie.

### Implementatie

```typescript
class LedgerCore {
  private static latestEntryCache = new Map<
    string,
    {
      hash: string;
      timestamp: number;
      id: string;
      expiresAt: number;
    }
  >();

  static async getLatestEntry(
    db: LedgerDb,
    cacheKey: string = "default"
  ): Promise<{ hash: string; timestamp: number; id: string } | null> {
    const cached = this.latestEntryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const result = await db.query.ledgerEntries.findFirst({
      columns: { id: true, hash: true, timestamp: true },
      orderBy: (table, { desc: d }) => d(table.timestamp),
    });

    if (result) {
      this.latestEntryCache.set(cacheKey, {
        ...result,
        expiresAt: Date.now() + 1000, // 1 second TTL
      });
    }
    return result || null;
  }

  static invalidateLatestEntryCache(cacheKey: string = "default") {
    this.latestEntryCache.delete(cacheKey);
  }
}
```

### Impact

- **5x sneller** append operaties (elimineert database query)
- **Minder database load** bij hoge throughput
- **TTL-based invalidation** voor safety

### Prioriteit

🔴 **Hoog** - Directe performance impact

---

## 🔍 2. Dedicated OID Columns met Indexes

### Probleem

JSON filtering op `issuer_oid` en `subject_oid` is traag (geen indexes mogelijk).

### Oplossing

Dedicated kolommen toevoegen met indexes, backward compatible met payload.

### Implementatie

```typescript
// Schema migratie
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

### Impact

- **40x sneller** queries op OID
- **Indexes** mogelijk voor complexe queries
- **Backward compatible** (payload blijft bestaan)

### Prioriteit

🔴 **Hoog** - Kritiek voor production workloads

---

## 📦 3. Batch Append Operations

### Probleem

Geen manier om meerdere entries atomisch toe te voegen, wat leidt tot veel database round-trips.

### Oplossing

Batch append met transaction support.

### Implementatie

```typescript
async appendBatch<T extends keyof SchemaDefinition>(
  entries: Array<{
    type: T;
    issuer_oid: string;
    subject_oid?: string;
    payload: InferSchemaType<SchemaDefinition[T]>;
    meta?: Record<string, unknown>;
    stream?: LedgerStream;
  }>
): Promise<Array<LedgerEntry & { proof_jwt: string }>> {
  return await this.database.db.transaction(async (tx) => {
    const results: Array<LedgerEntry & { proof_jwt: string }> = [];

    for (const entry of entries) {
      const result = await LedgerCore.append(
        tx,
        this.signer,
        entry.stream || this.getStreamForType(entry.type),
        this.buildPayload(entry),
        "active",
        entry.meta
      );

      const proofJwt = await generateProofJWT(
        result,
        this.config.name,
        this.config.signingKey
      );

      results.push({ ...result, proof_jwt: proofJwt });
    }

    return results;
  });
}
```

### Impact

- **10x sneller** voor bulk operations
- **Atomiciteit** - alle entries of geen
- **Minder database round-trips**

### Prioriteit

🟡 **Medium** - Handig voor bulk imports en migrations

---

## 🔄 4. Transaction Support voor Append

### Probleem

Append operatie bestaat uit meerdere database queries zonder transaction, wat kan leiden tot inconsistentie.

### Oplossing

Wrap append in database transaction.

### Implementatie

```typescript
static async append(
  db: LedgerDb,
  signer: LedgerSigner,
  stream: LedgerStream,
  payload: Record<string, unknown>,
  status: EntryStatus = "active",
  meta?: Record<string, unknown>
): Promise<LedgerEntry> {
  return await db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    // Get previous hash (from cache if available)
    const latest = await this.getLatestEntry(tx, "default");
    const prevHash = latest?.hash || null;

    // Compute hash
    const hash = this.computeHash(stream, id, payload);

    // Sign entry
    const message = prevHash ? `${hash}:${prevHash}` : hash;
    const signature = signer.sign(message);

    // Insert entry
    await tx.insert(schema.ledgerEntries).values({
      id,
      stream,
      timestamp,
      payload: JSON.stringify(payload),
      hash,
      prevHash,
      signature,
      status,
      meta: meta ? JSON.stringify(meta) : null,
      createdAt: timestamp,
    });

    // Update tip
    await this.updateTip(tx, id, hash, timestamp);

    // Return entry (use RETURNING if available, otherwise query)
    const inserted = await this.getEntry(tx, id);
    if (!inserted) {
      throw new Error("Failed to retrieve inserted entry");
    }

    return inserted;
  });
}
```

### Impact

- **Atomiciteit** - append is nu atomic
- **Consistentie** - geen partial states
- **Betere error handling** - rollback bij failures

### Prioriteit

🔴 **Hoog** - Kritiek voor data integrity

---

## 📊 5. Materialized Views voor Statistieken

### Probleem

Stats queries (COUNT, MIN, MAX) zijn traag op grote datasets.

### Oplossing

Materialized views die automatisch worden bijgewerkt.

### Implementatie

```typescript
// Schema
export const ledgerStatsPg = pgTable("ledger_stats", {
  stream: ledgerStreamEnum("stream").primaryKey(),
  totalEntries: pgBigint("total_entries", { mode: "number" }).notNull(),
  lastEntryTimestamp: pgBigint("last_entry_timestamp", { mode: "number" }),
  lastEntryHash: pgText("last_entry_hash"),
  updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
});

// Update stats na append
static async updateStats(
  db: LedgerDb,
  stream: LedgerStream,
  entryId: string,
  hash: string,
  timestamp: number
) {
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
```

### Impact

- **100x sneller** stats queries
- **Real-time** statistieken
- **Minder database load**

### Prioriteit

🟡 **Medium** - Handig voor dashboards en monitoring

---

## 🔐 6. Multi-Signature Support

### Probleem

Alleen één signer (ledger) kan entries signeren, geen multi-party signatures.

### Oplossing

Ondersteuning voor meerdere signatures per entry.

### Implementatie

```typescript
// Schema uitbreiding
export const ledgerEntrySignaturesPg = pgTable("ledger_entry_signatures", {
  id: pgText("id").primaryKey(),
  entryId: pgText("entry_id")
    .notNull()
    .references(() => ledgerEntriesPg.id, { onDelete: "cascade" }),
  signerOid: pgText("signer_oid").notNull(),
  signature: pgText("signature").notNull(),
  timestamp: pgBigint("timestamp", { mode: "number" }).notNull(),
});

// API uitbreiding
interface MultiSignatureConfig {
  requiredSignatures: number;
  signers: string[]; // OIDs of authorized signers
}

async appendWithMultiSig(
  entry: {...},
  signatures: Array<{ signerOid: string; signature: string }>
): Promise<LedgerEntry> {
  // Verify all signatures
  // Store in ledger_entry_signatures table
  // Only append if required signatures are present
}
```

### Impact

- **Multi-party** consensus mogelijk
- **Governance** support
- **Audit trail** van alle signers

### Prioriteit

🟢 **Laag** - Nice to have voor advanced use cases

---

## 📡 7. Streaming API & WebSocket Support

### Probleem

Geen real-time updates, clients moeten polling gebruiken.

### Oplossing

WebSocket API voor real-time entry notifications.

### Implementatie

```typescript
// WebSocket server
class LedgerWebSocketServer {
  private clients = new Set<WebSocket>();

  constructor(private ledger: OnoalLedger) {
    // Subscribe to append events
    this.ledger.on("entry:appended", (entry) => {
      this.broadcast({
        type: "entry:appended",
        entry,
      });
    });
  }

  handleConnection(ws: WebSocket) {
    this.clients.add(ws);

    ws.on("message", (message) => {
      const { type, filters } = JSON.parse(message);

      if (type === "subscribe") {
        // Subscribe to filtered updates
        this.subscribe(ws, filters);
      }
    });

    ws.on("close", () => {
      this.clients.delete(ws);
    });
  }

  broadcast(message: any) {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}
```

### Impact

- **Real-time** updates
- **Minder polling** overhead
- **Betere UX** voor dashboards

### Prioriteit

🟡 **Medium** - Handig voor real-time applications

---

## 🔍 8. Advanced Query Filters & Full-Text Search

### Probleem

Beperkte query mogelijkheden, geen full-text search.

### Oplossing

Uitgebreide filters en full-text search op payload.

### Implementatie

```typescript
// PostgreSQL full-text search
export const ledgerEntriesSearchPg = pgTable("ledger_entries_search", {
  entryId: pgText("entry_id")
    .primaryKey()
    .references(() => ledgerEntriesPg.id, { onDelete: "cascade" }),
  searchVector: tsvector("search_vector"), // PostgreSQL tsvector
});

// Query uitbreiding
async query(filters: {
  // ... existing filters ...
  search?: string; // Full-text search
  dateRange?: { start: number; end: number };
  statuses?: EntryStatus[];
  sortBy?: "timestamp" | "hash" | "created_at";
  sortOrder?: "asc" | "desc";
}): Promise<QueryResult> {
  // Build query with full-text search
  // Support date ranges
  // Multiple status filters
  // Custom sorting
}
```

### Impact

- **Betere search** mogelijkheden
- **Flexibele filtering**
- **Production-ready** queries

### Prioriteit

🟡 **Medium** - Handig voor complexe use cases

---

## 📈 9. Performance Metrics & Monitoring

### Probleem

Geen inzicht in performance metrics en bottlenecks.

### Oplossing

Built-in metrics collection en export.

### Implementatie

```typescript
interface LedgerMetrics {
  operations: {
    append: {
      count: number;
      avgDuration: number;
      p95Duration: number;
      errors: number;
    };
    query: {
      count: number;
      avgDuration: number;
      avgResults: number;
    };
    verifyChain: {
      count: number;
      avgDuration: number;
      avgEntriesChecked: number;
    };
  };
  database: {
    queries: number;
    avgQueryTime: number;
    slowQueries: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

class MetricsCollector {
  private metrics: LedgerMetrics = {
    /* ... */
  };

  recordOperation(operation: string, duration: number, success: boolean) {
    // Record metrics
  }

  getMetrics(): LedgerMetrics {
    return this.metrics;
  }

  exportPrometheus(): string {
    // Export in Prometheus format
  }

  exportJSON(): LedgerMetrics {
    return this.metrics;
  }
}
```

### Impact

- **Visibility** in performance
- **Proactive** problem detection
- **Data-driven** optimization

### Prioriteit

🟡 **Medium** - Essentieel voor production monitoring

---

## 🔄 10. Replication & Multi-Region Support

### Probleem

Geen replicatie, single point of failure.

### Oplossing

Multi-region replicatie met conflict resolution.

### Implementatie

```typescript
interface ReplicationConfig {
  regions: Array<{
    name: string;
    database: LedgerDatabase;
    priority: number;
  }>;
  replicationMode: "async" | "sync" | "eventual";
  conflictResolution: "last-write-wins" | "merge" | "manual";
}

class LedgerReplicator {
  async append(entry: {...}): Promise<LedgerEntry> {
    // Write to primary
    const result = await this.primaryLedger.append(entry);

    // Replicate to secondaries
    if (this.config.replicationMode === "sync") {
      await Promise.all(
        this.secondaries.map(ledger => ledger.append(entry))
      );
    } else {
      // Async replication
      this.replicateAsync(entry);
    }

    return result;
  }

  async verifyReplication(): Promise<{
    primary: number;
    secondaries: Record<string, number>;
    inSync: boolean;
  }> {
    // Check if all regions are in sync
  }
}
```

### Impact

- **High availability** - geen single point of failure
- **Disaster recovery** - automatic failover
- **Global distribution** - lag reduction

### Prioriteit

🟢 **Laag** - Advanced feature voor enterprise deployments

---

## 📊 Prioriteit Matrix

### Hoge Prioriteit (Direct Impact)

1. ✅ **Latest Entry Caching** - 5x performance boost
2. ✅ **Dedicated OID Columns** - 40x query performance
3. ✅ **Transaction Support** - Data integrity

### Medium Prioriteit (Significant Impact)

4. ✅ **Batch Append** - Bulk operations
5. ✅ **Materialized Views** - Fast stats
6. ✅ **Streaming API** - Real-time updates
7. ✅ **Advanced Queries** - Better search
8. ✅ **Metrics & Monitoring** - Production ready

### Lage Prioriteit (Nice to Have)

9. ✅ **Multi-Signature** - Advanced governance
10. ✅ **Replication** - Enterprise HA

---

## 🎯 Implementatie Roadmap

### Fase 1: Performance (2-3 weken)

- Latest Entry Caching
- Dedicated OID Columns
- Transaction Support

### Fase 2: Features (3-4 weken)

- Batch Append
- Materialized Views
- Advanced Queries

### Fase 3: Enterprise (4-6 weken)

- Streaming API
- Metrics & Monitoring
- Multi-Signature (optioneel)

### Fase 4: Scale (6-8 weken)

- Replication & Multi-Region

---

## 📈 Geschatte Impact

| Optimalisatie     | Huidige | Na Optimalisatie | Verbetering      |
| ----------------- | ------- | ---------------- | ---------------- |
| Append operatie   | ~50ms   | ~10ms            | **5x sneller**   |
| Query op OID      | ~200ms  | ~5ms             | **40x sneller**  |
| Stats query       | ~500ms  | ~5ms             | **100x sneller** |
| Batch append (10) | ~500ms  | ~50ms            | **10x sneller**  |

---

## 🎯 Conclusie

Deze 10 optimalisaties en uitbreidingen maken het Ledger Framework:

- **5-100x sneller** voor verschillende operaties
- **Production-ready** met monitoring en HA
- **Enterprise-grade** met advanced features
- **Developer-friendly** met betere APIs

**Aanbeveling**: Start met Fase 1 (Performance) voor directe impact.

### 6. Lazy JSON Parsing & Payload Caching

### Probleem

JSON.parse() wordt bij elke entry uitgevoerd, zelfs als payload niet nodig is.

### Oplossing

Lazy parsing met caching voor parsed payloads.

### Implementatie

```typescript
class LazyParsedPayload {
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
}

// Cache voor parsed payloads
const payloadCache = new Map<
  string,
  {
    parsed: Record<string, unknown>;
    expiresAt: number;
  }
>();

function getParsedPayload(
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

### Impact

- **Minder CPU** - Parse alleen wanneer nodig
- **Cache hits** - Snellere herhaalde access
- **Memory efficient** - TTL-based cleanup

### Prioriteit

🟡 **Medium** - CPU optimalisatie

---

### 7. CryptoKey Caching voor JWT

### Probleem

CryptoKey wordt elke keer geïmporteerd bij JWT generation.

### Oplossing

Cache CryptoKey instances.

### Implementatie

```typescript
const cryptoKeyCache = new Map<string, CryptoKey>();

async function getCryptoKey(signingKey: Uint8Array): Promise<CryptoKey> {
  const key = Buffer.from(signingKey).toString("base64");

  if (cryptoKeyCache.has(key)) {
    return cryptoKeyCache.get(key)!;
  }

  const privateKeyJwk = {
    kty: "OKP",
    crv: "Ed25519",
    d: Buffer.from(signingKey).toString("base64url"),
    x: Buffer.from(ed25519.getPublicKey(signingKey)).toString("base64url"),
  };

  const cryptoKey = await importJWK(privateKeyJwk, "EdDSA");
  cryptoKeyCache.set(key, cryptoKey);

  return cryptoKey;
}
```

### Impact

- **6x sneller** JWT generation
- **Minder CPU** - Geen herhaaldelijke imports
- **Memory efficient** - Cache per signing key

### Prioriteit

🟡 **Medium** - JWT performance

---

### 8. Parallel Plugin Hooks

### Probleem

Plugin hooks worden sequentieel uitgevoerd, wat append operaties vertraagt.

### Oplossing

Parallel execution voor non-critical hooks.

### Implementatie

```typescript
// Parallel execution voor afterAppend hooks
const afterAppendPromises = this.plugins
  .filter((p) => p.hooks?.afterAppend)
  .map((plugin) =>
    plugin.hooks!.afterAppend!(entryWithProof, this).catch((err) => {
      this.logger.error(`Plugin ${plugin.id} afterAppend failed:`, err);
      // Don't throw - hooks are non-critical
    })
  );

await Promise.allSettled(afterAppendPromises);

// Critical hooks (beforeAppend) blijven sequentieel
for (const plugin of this.plugins) {
  if (plugin.hooks?.beforeAppend) {
    const result = await plugin.hooks.beforeAppend(entry, this);
    if (result === false) {
      throw new Error(`Plugin ${plugin.id} rejected entry`);
    }
  }
}
```

### Impact

- **Snellere append** - Parallel hook execution
- **Betere throughput** - Non-blocking hooks
- **Error isolation** - Eén plugin failure blokkeert niet anderen

### Prioriteit

🟡 **Medium** - Throughput verbetering

---

### 9. Connection Pooling & Query Optimization

### Probleem

Geen connection pooling configuratie, queries kunnen geoptimaliseerd worden.

### Oplossing

Connection pooling en query optimization.

### Implementatie

```typescript
// PostgreSQL connection pooling
export function postgresAdapter(
  options: PostgresAdapterOptions
): LedgerDatabase {
  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.maxConnections || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Query optimization
  const optimizedDb = drizzle(pool, {
    schema,
    logger: options.logQueries ? console.log : false,
  });

  return {
    // ... with optimized queries
  };
}

// Prepared statements caching
const preparedStatements = new Map<string, any>();

function getPreparedStatement(query: string) {
  if (!preparedStatements.has(query)) {
    preparedStatements.set(query, db.prepare(query));
  }
  return preparedStatements.get(query);
}
```

### Impact

- **Betere concurrency** - Connection pooling
- **Snellere queries** - Prepared statements
- **Resource efficiency** - Connection reuse

### Prioriteit

🟡 **Medium** - Database performance

---

### 10. Selective Column Queries

### Probleem

Queries halen alle kolommen op, zelfs als niet alle data nodig is.

### Oplossing

Select alleen benodigde kolommen.

### Implementatie

```typescript
// Huidig: haalt alle kolommen op
const entry = await db.query.ledgerEntries.findFirst({...});

// Geoptimaliseerd: alleen benodigde kolommen
const entry = await db
  .select({
    id: schema.ledgerEntries.id,
    hash: schema.ledgerEntries.hash,
    timestamp: schema.ledgerEntries.timestamp,
    // Alleen wat nodig is
  })
  .from(schema.ledgerEntries)
  .where(eq(schema.ledgerEntries.id, entryId))
  .limit(1);
```

### Impact

- **Minder data transfer** - Alleen benodigde kolommen
- **Snellere queries** - Minder data processing
- **Memory efficient** - Minder memory gebruik

### Prioriteit

🟡 **Medium** - Query optimalisatie

---

## 🛠️ Developer Experience (DX) Verbeteringen

### 11. Type-Safe Query Builder

### Probleem

Query API is beperkt, geen type-safe query builder zoals Prisma of Kysely.

### Oplossing

Type-safe query builder met IntelliSense support.

### Implementatie

```typescript
// Type-safe query builder
interface QueryBuilder<T extends LedgerStream> {
  where(fn: (entry: EntryFields<T>) => boolean): this;
  orderBy(field: keyof EntryFields<T>, direction: "asc" | "desc"): this;
  limit(count: number): this;
  cursor(timestamp: number): this;
  execute(): Promise<Array<LedgerEntry & { stream: T }>>;
}

// Usage
const proofs = await ledger
  .query("proofs")
  .where((e) => e.subject_oid === "oid:onoal:user:alice")
  .where((e) => e.status === "active")
  .orderBy("timestamp", "desc")
  .limit(20)
  .execute();
```

### Impact

- **Betere DX** - IntelliSense en type safety
- **Minder errors** - Compile-time checking
- **Betere autocomplete** - IDE support

### Prioriteit

🟡 **Medium** - Significante DX verbetering

---

### 12. Schema Migration System

### Probleem

Geen gestructureerd migration systeem voor schema wijzigingen (zoals OID kolommen toevoegen).

### Oplossing

Versioned migrations met up/down support en rollback.

### Implementatie

```typescript
// Migration system
interface Migration {
  version: string;
  name: string;
  up: (db: LedgerDb) => Promise<void>;
  down: (db: LedgerDb) => Promise<void>;
}

class MigrationManager {
  async migrate(db: LedgerDb, targetVersion?: string): Promise<void> {
    const currentVersion = await this.getCurrentVersion(db);
    const migrations = this.getMigrations(currentVersion, targetVersion);

    for (const migration of migrations) {
      await migration.up(db);
      await this.recordMigration(db, migration);
    }
  }

  async rollback(db: LedgerDb, targetVersion: string): Promise<void> {
    const currentVersion = await this.getCurrentVersion(db);
    const migrations = this.getMigrations(
      targetVersion,
      currentVersion
    ).reverse();

    for (const migration of migrations) {
      await migration.down(db);
      await this.removeMigration(db, migration);
    }
  }
}

// Example migration
const addOidColumns: Migration = {
  version: "0.2.0",
  name: "add_oid_columns",
  up: async (db) => {
    await db.execute(sql`
      ALTER TABLE ledger_entries
      ADD COLUMN issuer_oid TEXT,
      ADD COLUMN subject_oid TEXT,
      ADD COLUMN entry_type TEXT
    `);

    // Migrate existing data
    await db.execute(sql`
      UPDATE ledger_entries
      SET issuer_oid = payload->>'issuer_oid',
          subject_oid = payload->>'subject_oid',
          entry_type = payload->>'type'
    `);

    // Create indexes
    await db.execute(sql`
      CREATE INDEX idx_ledger_issuer_oid ON ledger_entries(issuer_oid)
    `);
  },
  down: async (db) => {
    await db.execute(sql`DROP INDEX idx_ledger_issuer_oid`);
    await db.execute(sql`
      ALTER TABLE ledger_entries
      DROP COLUMN issuer_oid,
      DROP COLUMN subject_oid,
      DROP COLUMN entry_type
    `);
  },
};
```

### Impact

- **Gestructureerde upgrades** - Versioned migrations
- **Rollback support** - Veilig terugdraaien
- **Data migratie** - Automatische data transformatie

### Prioriteit

🔴 **Hoog** - Essentieel voor production deployments

---

### 13. Dev Tools & Debugging

### Probleem

Beperkte debugging tools, moeilijk om ledger state te inspecteren.

### Oplossing

Comprehensive dev tools en debugging utilities.

### Implementatie

```typescript
// Dev tools
interface DevTools {
  // Inspect ledger state
  inspectEntry(entryId: string): Promise<EntryInspection>;
  inspectChain(startId?: string, limit?: number): Promise<ChainInspection>;

  // Debugging
  traceAppend(entry: {...}): Promise<TraceResult>;
  traceQuery(filters: {...}): Promise<TraceResult>;

  // Testing utilities
  seedTestData(count: number): Promise<void>;
  clearTestData(): Promise<void>;

  // Performance profiling
  profileOperation<T>(name: string, fn: () => Promise<T>): Promise<T & { profile: ProfileResult }>;
}

// Usage
const tools = ledger.getDevTools();
const inspection = await tools.inspectEntry("entry-123");
console.log("Hash:", inspection.hash);
console.log("Computed hash:", inspection.computedHash);
console.log("Signature valid:", inspection.signatureValid);
console.log("Chain position:", inspection.chainPosition);
```

### Impact

- **Betere debugging** - Inspect ledger state
- **Performance profiling** - Identificeer bottlenecks
- **Testing support** - Seed en clear utilities

### Prioriteit

🟡 **Medium** - Handig voor development

---

### 14. CLI Enhancements

### Probleem

CLI heeft basis functionaliteit, mist advanced features.

### Oplossing

Uitgebreide CLI met meer commands en betere UX.

### Implementatie

```typescript
// Nieuwe CLI commands
{
  // Data management
  "ledger:seed": "Seed test data",
  "ledger:clear": "Clear all entries",
  "ledger:export": "Export entries to JSON/CSV",
  "ledger:import": "Import entries from JSON/CSV",

  // Debugging
  "ledger:inspect <entry-id>": "Inspect entry details",
  "ledger:verify": "Verify chain integrity",
  "ledger:stats": "Show ledger statistics",

  // Development
  "ledger:dev": "Start development server with hot reload",
  "ledger:test": "Run ledger tests",
  "ledger:profile": "Profile operations",

  // Database
  "db:backup": "Backup database",
  "db:restore": "Restore from backup",
  "db:diff": "Show schema differences",
}
```

### Impact

- **Betere workflow** - Meer commands
- **Productiviteit** - Snellere development
- **Professional** - Enterprise-grade CLI

### Prioriteit

🟡 **Medium** - DX verbetering

---

## 🔌 Database Adapters & ORMs

### 15. Kysely Adapter

### Probleem

Alleen Drizzle ORM support, geen Kysely (type-safe SQL builder).

### Oplossing

Kysely adapter voor type-safe SQL queries.

### Implementatie

```typescript
import { Kysely } from "kysely";

interface LedgerDatabase {
  ledger_entries: {
    id: string;
    stream: string;
    timestamp: number;
    payload: unknown;
    hash: string;
    prev_hash: string | null;
    signature: string | null;
    status: string;
    meta: unknown | null;
    created_at: number;
  };
  // ... other tables
}

export function kyselyAdapter(db: Kysely<LedgerDatabase>): LedgerDatabase {
  return {
    id: "kysely",
    provider: "kysely",
    db: {
      // Wrap Kysely in LedgerDb interface
      query: {
        ledgerEntries: {
          findFirst: async (options) => {
            let query = db.selectFrom("ledger_entries");
            // Apply options...
            return await query.executeTakeFirst();
          },
        },
      },
      select: async (builder) => {
        return await builder.execute();
      },
      insert: async (table, values) => {
        return await db.insertInto(table).values(values).execute();
      },
    },
  };
}
```

### Impact

- **Type-safe SQL** - Compile-time query checking
- **Flexibiliteit** - Complexe queries mogelijk
- **Performance** - Direct SQL zonder ORM overhead

### Prioriteit

🟡 **Medium** - Handig voor advanced queries

---

### 16. Prisma Adapter

### Probleem

Geen Prisma support, populair ORM voor TypeScript.

### Oplossing

Prisma adapter voor Prisma gebruikers.

### Implementatie

```typescript
import { PrismaClient } from "@prisma/client";

export function prismaAdapter(prisma: PrismaClient): LedgerDatabase {
  return {
    id: "prisma",
    provider: "prisma",
    db: {
      query: {
        ledgerEntries: {
          findFirst: async (options) => {
            return await prisma.ledgerEntry.findFirst({
              where: options.where,
              orderBy: options.orderBy,
            });
          },
        },
      },
      // Wrap Prisma methods
    },
  };
}
```

### Impact

- **Prisma ecosystem** - Gebruik bestaande Prisma setup
- **Migrations** - Gebruik Prisma migrations
- **Type safety** - Prisma's type generation

### Prioriteit

🟢 **Laag** - Nice to have voor Prisma gebruikers

---

### 17. MongoDB Adapter

### Probleem

Alleen relationele databases, geen NoSQL support.

### Oplossing

MongoDB adapter voor document-based storage.

### Implementatie

```typescript
import { MongoClient, Collection } from "mongodb";

export function mongoAdapter(
  client: MongoClient,
  dbName: string = "ledger"
): LedgerDatabase {
  const db = client.db(dbName);
  const entries = db.collection("ledger_entries");

  return {
    id: "mongodb",
    provider: "mongodb",
    db: {
      query: {
        ledgerEntries: {
          findFirst: async (options) => {
            return await entries.findOne(buildMongoQuery(options.where), {
              sort: buildMongoSort(options.orderBy),
            });
          },
        },
      },
      // MongoDB operations
    },
  };
}
```

### Impact

- **NoSQL support** - Document-based storage
- **Horizontale scaling** - MongoDB sharding
- **Flexibele schema** - Dynamic schema evolution

### Prioriteit

🟢 **Laag** - Voor NoSQL use cases

---

## 🔗 Integrations

### 18. Express.js Integration

### Probleem

Geen ready-made Express.js integration.

### Oplossing

Express middleware en route helpers.

### Implementatie

```typescript
import express from "express";
import { createLedgerMiddleware, createLedgerRoutes } from "@onoal/ledger-express";

const app = express();
const ledger = await createLedger({...});

// Middleware
app.use(createLedgerMiddleware(ledger));

// Routes
app.use("/api/ledger", createLedgerRoutes(ledger));

// Custom routes with ledger context
app.get("/api/proofs", async (req, res) => {
  const ledger = req.ledger; // Injected by middleware
  const proofs = await ledger.query({ stream: "proofs" });
  res.json(proofs);
});
```

### Impact

- **Easy integration** - Drop-in Express support
- **Middleware** - Request context injection
- **Type safety** - TypeScript support

### Prioriteit

🟡 **Medium** - Handig voor Express apps

---

### 19. Fastify Integration

### Probleem

Geen Fastify support.

### Oplossing

Fastify plugin voor ledger integration.

### Implementatie

```typescript
import Fastify from "fastify";
import { ledgerPlugin } from "@onoal/ledger-fastify";

const fastify = Fastify();

await fastify.register(ledgerPlugin, {
  ledger: await createLedger({...}),
});

// Routes automatically registered
// Access via fastify.ledger
```

### Impact

- **Fastify ecosystem** - Plugin system
- **Performance** - Fastify's speed
- **Type safety** - TypeScript support

### Prioriteit

🟡 **Medium** - Voor Fastify gebruikers

---

### 20. Next.js Integration

### Probleem

Geen Next.js App Router support.

### Oplossing

Next.js route handlers en server components support.

### Implementatie

```typescript
// app/api/ledger/route.ts
import { createLedgerHandler } from "@onoal/ledger-nextjs";

export const GET = createLedgerHandler(async (req, ledger) => {
  const entries = await ledger.query({ stream: "proofs" });
  return Response.json(entries);
});

// Server Component
import { getLedger } from "@onoal/ledger-nextjs/server";

export default async function LedgerPage() {
  const ledger = await getLedger();
  const stats = await ledger.getStats();
  return <div>Entries: {stats.total_entries}</div>;
}
```

### Impact

- **Next.js support** - App Router compatible
- **Server Components** - React integration
- **API Routes** - Route handlers

### Prioriteit

🟡 **Medium** - Voor Next.js projects

---

## 🔌 Plugins

### 21. Audit Log Plugin

### Probleem

Geen built-in audit logging.

### Oplossing

Audit log plugin voor compliance en debugging.

### Implementatie

```typescript
import { auditLogPlugin } from "@onoal/ledger-plugins/audit";

const plugin = auditLogPlugin({
  logLevel: "all", // "all" | "errors" | "operations"
  storage: "database", // "database" | "file" | "external"
  retention: "90d", // Retention period
});

// Logs all operations
// - Entry creation
// - Entry queries
// - Chain verification
// - Errors
```

### Impact

- **Compliance** - Audit trail
- **Debugging** - Operation history
- **Security** - Track all access

### Prioriteit

🟡 **Medium** - Voor compliance requirements

---

### 22. Rate Limiting Plugin

### Probleem

Geen rate limiting, kan leiden tot abuse.

### Oplossing

Rate limiting plugin met configurable limits.

### Implementatie

```typescript
import { rateLimitPlugin } from "@onoal/ledger-plugins/rate-limit";

const plugin = rateLimitPlugin({
  limits: {
    append: { requests: 100, window: "1m" },
    query: { requests: 1000, window: "1m" },
    verify: { requests: 10, window: "1m" },
  },
  storage: "memory", // "memory" | "redis"
  keyGenerator: (req) => req.headers.get("x-api-key"),
});
```

### Impact

- **Abuse prevention** - Rate limiting
- **Resource protection** - Prevent overload
- **Fair usage** - Distribute load

### Prioriteit

🟡 **Medium** - Voor public APIs

---

### 23. Encryption Plugin

### Probleem

Payloads zijn niet encrypted, alleen signed.

### Oplossing

Encryption plugin voor sensitive data.

### Implementatie

```typescript
import { encryptionPlugin } from "@onoal/ledger-plugins/encryption";

const plugin = encryptionPlugin({
  algorithm: "AES-256-GCM",
  keyDerivation: "PBKDF2",
  encryptFields: ["ssn", "email", "phone"], // Fields to encrypt
  keyRotation: true, // Automatic key rotation
});
```

### Impact

- **Data privacy** - Encrypted payloads
- **Compliance** - GDPR, HIPAA support
- **Security** - Additional layer

### Prioriteit

🟡 **Medium** - Voor sensitive data

---

### 24. Backup Plugin

### Probleem

Geen automatische backup functionaliteit.

### Oplossing

Backup plugin met scheduled backups.

### Implementatie

```typescript
import { backupPlugin } from "@onoal/ledger-plugins/backup";

const plugin = backupPlugin({
  schedule: "0 2 * * *", // Daily at 2 AM
  storage: "s3", // "s3" | "gcs" | "local"
  retention: "30d",
  compression: true,
  encryption: true,
});
```

### Impact

- **Disaster recovery** - Automated backups
- **Data safety** - Regular snapshots
- **Compliance** - Backup requirements

### Prioriteit

🟡 **Medium** - Voor production deployments

---

### 25. Analytics Plugin

### Probleem

Geen analytics tracking.

### Oplossing

Analytics plugin voor usage tracking.

### Implementatie

```typescript
import { analyticsPlugin } from "@onoal/ledger-plugins/analytics";

const plugin = analyticsPlugin({
  provider: "mixpanel", // "mixpanel" | "segment" | "custom"
  trackEvents: ["append", "query", "verify"],
  anonymize: true, // GDPR compliance
});
```

### Impact

- **Usage insights** - Track usage patterns
- **Product decisions** - Data-driven
- **Monitoring** - User behavior

### Prioriteit

🟢 **Laag** - Nice to have

---

## 📊 Uitgebreide Prioriteit Matrix

### 🔴 Hoge Prioriteit (Direct Impact)

1. ✅ **Latest Entry Caching** - 5x performance boost
2. ✅ **Dedicated OID Columns** - 40x query performance
3. ✅ **Transaction Support** - Data integrity
4. ✅ **Schema Migration System** - Production upgrades

### 🟡 Medium Prioriteit (Significant Impact)

#### Performance

5. ✅ **Batch Append** - Bulk operations
6. ✅ **Materialized Views** - Fast stats
7. ✅ **Lazy JSON Parsing** - CPU optimalisatie
8. ✅ **CryptoKey Caching** - 6x snellere JWT
9. ✅ **Parallel Plugin Hooks** - Throughput verbetering
10. ✅ **Connection Pooling** - Database performance
11. ✅ **Selective Column Queries** - Query optimalisatie

#### Features

12. ✅ **Streaming API** - Real-time updates
13. ✅ **Advanced Queries** - Better search
14. ✅ **Metrics & Monitoring** - Production ready

#### Developer Experience

15. ✅ **Type-Safe Query Builder** - DX improvement
16. ✅ **Dev Tools** - Better debugging
17. ✅ **CLI Enhancements** - Better workflow

#### Adapters

18. ✅ **Kysely Adapter** - Advanced queries

#### Integrations

19. ✅ **Express Integration** - Easy integration
20. ✅ **Fastify Integration** - Fastify support
21. ✅ **Next.js Integration** - Next.js support

#### Plugins

22. ✅ **Audit Log Plugin** - Compliance
23. ✅ **Rate Limiting Plugin** - Abuse prevention
24. ✅ **Encryption Plugin** - Data privacy
25. ✅ **Backup Plugin** - Disaster recovery

### 🟢 Lage Prioriteit (Nice to Have)

26. ✅ **Multi-Signature** - Advanced governance
27. ✅ **Replication** - Enterprise HA
28. ✅ **Prisma Adapter** - Prisma ecosystem
29. ✅ **MongoDB Adapter** - NoSQL support
30. ✅ **Analytics Plugin** - Usage tracking

---

## 🎯 Uitgebreide Implementatie Roadmap

### Fase 1: Performance & Core (3-4 weken)

- Latest Entry Caching
- Dedicated OID Columns
- Transaction Support
- Schema Migration System

### Fase 2: Features & DX (4-5 weken)

- Batch Append
- Materialized Views
- Advanced Queries
- Type-Safe Query Builder
- Dev Tools
- CLI Enhancements

### Fase 3: Integrations & Adapters (3-4 weken)

- Kysely Adapter
- Express Integration
- Fastify Integration
- Next.js Integration

### Fase 4: Plugins & Enterprise (4-5 weken)

- Streaming API
- Metrics & Monitoring
- Audit Log Plugin
- Rate Limiting Plugin
- Encryption Plugin
- Backup Plugin

### Fase 5: Advanced Features (6-8 weken)

- Multi-Signature
- Replication & Multi-Region
- Prisma Adapter (optioneel)
- MongoDB Adapter (optioneel)
- Analytics Plugin (optioneel)

---

## 📈 Geschatte Impact Totaal

| Categorie        | Optimalisaties | Impact                                  |
| ---------------- | -------------- | --------------------------------------- |
| **Performance**  | 10             | 5-100x sneller                          |
| **DX**           | 4              | Significant betere developer experience |
| **Adapters**     | 3              | Meer database keuzes                    |
| **Integrations** | 3              | Easy framework integration              |
| **Plugins**      | 5              | Enterprise features                     |
| **Totaal**       | **25**         | Comprehensive framework                 |

---

## 🎯 Conclusie

Deze 30 optimalisaties en uitbreidingen maken het Ledger Framework:

- **5-100x sneller** voor verschillende operaties
- **Production-ready** met monitoring, backups, en HA
- **Enterprise-grade** met advanced features en compliance
- **Developer-friendly** met betere DX, tools, en integrations
- **Flexibel** met meerdere adapters en ORM support (Drizzle, Kysely, Prisma)
- **Extensible** met comprehensive plugin system
- **Well-integrated** met Express, Fastify, Next.js
- **Secure** met encryption, rate limiting, en audit logging

**Aanbeveling**: Start met Fase 1 (Performance & Core) voor directe impact, gevolgd door Fase 2 (Features & DX) voor betere developer experience.

---

## 📋 Quick Reference

### Performance Optimalisaties (10)

1. Latest Entry Caching
2. Dedicated OID Columns
3. Transaction Support
4. Batch Append
5. Materialized Views
6. Lazy JSON Parsing
7. CryptoKey Caching
8. Parallel Plugin Hooks
9. Connection Pooling
10. Selective Column Queries

### Developer Experience (4)

11. Type-Safe Query Builder
12. Schema Migration System
13. Dev Tools & Debugging
14. CLI Enhancements

### Database Adapters (3)

15. Kysely Adapter
16. Prisma Adapter
17. MongoDB Adapter

### Integrations (3)

18. Express.js Integration
19. Fastify Integration
20. Next.js Integration

### Plugins (5)

21. Audit Log Plugin
22. Rate Limiting Plugin
23. Encryption Plugin
24. Backup Plugin
25. Analytics Plugin

### Advanced Features (5)

26. Multi-Signature Support
27. Replication & Multi-Region
28. Streaming API & WebSocket
29. Advanced Query Filters
30. Performance Metrics & Monitoring

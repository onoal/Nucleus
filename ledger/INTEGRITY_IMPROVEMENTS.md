# Ledger Integriteit Verbeteringen

## 📋 Overzicht

Dit document beschrijft concrete verbeteringen voor de integriteit van het Ledger Framework. De huidige implementatie heeft basis hash chain verificatie, maar mist verschillende kritieke integriteitschecks.

## 🔍 Huidige Integriteit Features

### ✅ Wat werkt

1. **Hash Chain Linking** - `prevHash` wordt gecontroleerd in `verifyChain()`
2. **Ed25519 Signatures** - Elke entry wordt gesigneerd bij append
3. **Checkpoints** - Merkle root voor time ranges (basis implementatie)
4. **Schema Validatie** - Payload validatie bij append

### ❌ Wat ontbreekt

1. **Hash Recomputatie Verificatie** - Opgeslagen hash wordt niet geverifieerd tegen berekende hash
2. **Signature Verificatie** - Signatures worden niet geverifieerd tijdens chain verification
3. **Payload Integriteit** - Geen verificatie of payload nog intact is
4. **Timestamp Verificatie** - Geen controle op timestamp ordering
5. **Echte Merkle Tree** - Checkpoints gebruiken simpele concatenatie
6. **Periodic Integrity Checks** - Geen background verificatie
7. **Tamper Detection** - Geen mechanisme om wijzigingen te detecteren
8. **Database Constraints** - Geen database-level integriteit constraints

## 🎯 Verbeteringen

### 1. Hash Recomputatie Verificatie

**Probleem**: `verifyChain()` controleert alleen `prevHash` links, maar verifieert niet of de opgeslagen `hash` overeenkomt met de berekende hash.

**Oplossing**: Voeg hash recomputatie toe aan `verifyChain()`.

```typescript
// In hash-chain.ts
static async verifyChain(
  db: LedgerDb,
  startId?: string,
  limit: number = 100
): Promise<ChainVerificationResult> {
  // ... existing code ...

  for (const entry of rows) {
    // 1. Verify hash matches computed hash
    const computedHash = LedgerCore.computeHash(
      entry.stream,
      entry.id,
      entry.payload // Parse from JSON if needed
    );

    if (entry.hash !== computedHash) {
      return {
        valid: false,
        error: `Hash mismatch at entry ${entry.id}: stored ${entry.hash}, computed ${computedHash}`,
        entries_checked: entriesChecked,
      };
    }

    // 2. Verify prevHash chain (existing)
    if (prevHash !== null && entry.prevHash !== prevHash) {
      return {
        valid: false,
        error: `Chain broken at entry ${entry.id}: expected prev_hash ${prevHash}, got ${entry.prevHash}`,
        entries_checked: entriesChecked,
      };
    }

    prevHash = entry.hash;
    entriesChecked++;
  }
}
```

**Impact**: Detecteert corrupte entries waar de hash niet overeenkomt met de data.

### 2. Signature Verificatie

**Probleem**: Signatures worden niet geverifieerd tijdens chain verification.

**Oplossing**: Voeg signature verificatie toe met publieke sleutel.

```typescript
// In hash-chain.ts
static async verifyChain(
  db: LedgerDb,
  signer: LedgerSigner, // Add signer parameter
  startId?: string,
  limit: number = 100
): Promise<ChainVerificationResult> {
  // ... existing code ...

  for (const entry of rows) {
    // ... hash verification ...

    // 3. Verify signature if present
    if (entry.signature) {
      const message = entry.prevHash
        ? `${entry.hash}:${entry.prevHash}`
        : entry.hash;

      const isValid = LedgerSigner.verify(
        message,
        entry.signature,
        signer.getPublicKeyHex()
      );

      if (!isValid) {
        return {
          valid: false,
          error: `Invalid signature at entry ${entry.id}`,
          entries_checked: entriesChecked,
        };
      }
    }

    prevHash = entry.hash;
    entriesChecked++;
  }
}
```

**Impact**: Detecteert entries met ongeldige signatures (tampering).

### 3. Timestamp Ordering Verificatie

**Probleem**: Geen verificatie dat timestamps monotoom stijgen.

**Oplossing**: Controleer timestamp ordering in chain.

```typescript
// In hash-chain.ts verifyChain()
let lastTimestamp: number | null = null;

for (const entry of rows) {
  // ... hash and signature verification ...

  // 4. Verify timestamp ordering
  if (lastTimestamp !== null && entry.timestamp < lastTimestamp) {
    return {
      valid: false,
      error: `Timestamp out of order at entry ${entry.id}: ${entry.timestamp} < ${lastTimestamp}`,
      entries_checked: entriesChecked,
    };
  }

  // 5. Check for timestamp gaps (potential missing entries)
  if (lastTimestamp !== null) {
    const gap = entry.timestamp - lastTimestamp;
    if (gap > 24 * 60 * 60 * 1000) {
      // 24 hours
      // Log warning but don't fail (could be intentional)
      console.warn(`Large timestamp gap detected: ${gap}ms between entries`);
    }
  }

  lastTimestamp = entry.timestamp;
  prevHash = entry.hash;
  entriesChecked++;
}
```

**Impact**: Detecteert timestamp manipulatie en ontbrekende entries.

### 4. Payload Integriteit Verificatie

**Probleem**: Geen verificatie dat payload JSON nog geldig is.

**Oplossing**: Valideer JSON parsing en schema.

```typescript
// In hash-chain.ts verifyChain()
for (const entry of rows) {
  // ... existing checks ...

  // 6. Verify payload can be parsed
  try {
    const payload =
      typeof entry.payload === "string"
        ? JSON.parse(entry.payload)
        : entry.payload;

    // Verify payload is object
    if (typeof payload !== "object" || payload === null) {
      return {
        valid: false,
        error: `Invalid payload at entry ${entry.id}: not an object`,
        entries_checked: entriesChecked,
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: `Invalid JSON payload at entry ${entry.id}: ${error}`,
      entries_checked: entriesChecked,
    };
  }
}
```

**Impact**: Detecteert corrupte payload data.

### 5. Echte Merkle Tree voor Checkpoints

**Probleem**: Checkpoints gebruiken simpele hash concatenatie, geen echte Merkle tree.

**Oplossing**: Implementeer echte Merkle tree met binary tree structuur.

```typescript
// In hash-chain.ts
/**
 * Build Merkle tree from entries
 */
static buildMerkleTree(hashes: string[]): string {
  if (hashes.length === 0) {
    throw new Error("Cannot build Merkle tree from empty array");
  }

  if (hashes.length === 1) {
    return hashes[0];
  }

  // Build tree level by level
  let currentLevel = hashes;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length
        ? currentLevel[i + 1]
        : left; // Duplicate last if odd

      const combined = `${left}:${right}`;
      const hash = bytesToHex(sha256(new TextEncoder().encode(combined)));
      nextLevel.push(hash);
    }

    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

/**
 * Create checkpoint with Merkle tree
 */
static async createCheckpoint(
  db: LedgerDb,
  signer: LedgerSigner,
  startTimestamp: number,
  endTimestamp: number
): Promise<string> {
  const rows = await db
    .select({ hash: schema.ledgerEntries.hash })
    .from(schema.ledgerEntries)
    .where(
      and(
        gte(schema.ledgerEntries.timestamp, startTimestamp),
        lte(schema.ledgerEntries.timestamp, endTimestamp)
      )
    )
    .orderBy(asc(schema.ledgerEntries.timestamp));

  if (rows.length === 0) {
    throw new Error("No entries found for checkpoint");
  }

  // Build Merkle tree
  const hashes = rows.map((row: any) => row.hash);
  const rootHash = this.buildMerkleTree(hashes);

  // Sign root hash
  const signature = signer.sign(rootHash);
  const id = crypto.randomUUID();

  await db.insert(schema.ledgerCheckpoints).values({
    id,
    timestamp: Date.now(),
    rootHash,
    signature,
    entriesCount: rows.length,
    startTimestamp,
    endTimestamp,
    createdAt: Date.now(),
  });

  return rootHash;
}
```

**Impact**: Betere integriteit verificatie met Merkle proofs.

### 6. Periodic Integrity Checks

**Probleem**: Geen automatische background verificatie.

**Oplossing**: Implementeer periodic integrity checker.

```typescript
// In ledger.ts
class IntegrityChecker {
  private intervalId: NodeJS.Timeout | null = null;
  private ledger: OnoalLedger;
  private logger: Logger;
  private intervalMs: number;

  constructor(ledger: OnoalLedger, intervalMs: number = 60 * 60 * 1000) {
    this.ledger = ledger;
    this.logger = ledger.getLogger();
    this.intervalMs = intervalMs;
  }

  start() {
    if (this.intervalId) {
      return; // Already running
    }

    this.intervalId = setInterval(async () => {
      try {
        await this.checkIntegrity();
      } catch (error) {
        this.logger.error("Periodic integrity check failed", error);
      }
    }, this.intervalMs);

    this.logger.info("Integrity checker started", {
      intervalMs: this.intervalMs,
    });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info("Integrity checker stopped");
    }
  }

  async checkIntegrity() {
    const result = await this.ledger.verifyChain(undefined, 1000);

    if (!result.valid) {
      this.logger.error("Integrity check failed", {
        error: result.error,
        entries_checked: result.entries_checked,
      });

      // Trigger alert/hook
      // Could emit event, send webhook, etc.
    } else {
      this.logger.debug("Integrity check passed", {
        entries_checked: result.entries_checked,
      });
    }
  }
}
```

**Impact**: Automatische detectie van integriteitsproblemen.

### 7. Database Constraints

**Probleem**: Geen database-level integriteit constraints.

**Oplossing**: Voeg database constraints toe.

```typescript
// In schema.ts
export const ledgerEntriesPg = pgTable(
  "ledger_entries",
  {
    // ... existing fields ...
  },
  (table) => ({
    // ... existing indexes ...

    // Add unique constraint on hash (prevent duplicates)
    hashUnique: pgIndex("idx_ledger_hash_unique").on(table.hash).unique(),

    // Add check constraint for timestamp ordering (PostgreSQL only)
    // Note: This requires trigger or application-level enforcement
  })
);

// Add trigger for timestamp ordering (PostgreSQL)
// CREATE TRIGGER check_timestamp_order
// BEFORE INSERT ON ledger_entries
// FOR EACH ROW
// EXECUTE FUNCTION check_timestamp_monotonic();
```

**Impact**: Database-level bescherming tegen corruptie.

### 8. Tamper Detection via Audit Log

**Probleem**: Geen logging van integriteitschecks.

**Oplossing**: Voeg audit logging toe.

```typescript
// In ledger.ts
interface IntegrityAuditLog {
  timestamp: number;
  type: "full_verification" | "periodic_check" | "entry_verification";
  result: "passed" | "failed";
  entries_checked: number;
  error?: string;
  duration_ms: number;
}

class IntegrityAuditor {
  private logs: IntegrityAuditLog[] = [];
  private maxLogs = 1000;

  log(audit: IntegrityAuditLog) {
    this.logs.push(audit);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  getRecentLogs(limit: number = 100): IntegrityAuditLog[] {
    return this.logs.slice(-limit);
  }

  getFailureRate(): number {
    const recent = this.getRecentLogs(100);
    if (recent.length === 0) return 0;

    const failures = recent.filter((log) => log.result === "failed").length;
    return failures / recent.length;
  }
}
```

**Impact**: Traceerbaarheid en monitoring van integriteit.

### 9. Enhanced Chain Verification Result

**Probleem**: `ChainVerificationResult` geeft beperkte informatie.

**Oplossing**: Uitgebreid result type.

```typescript
// In types-internal.ts
export interface ChainVerificationResult {
  valid: boolean;
  entries_checked: number;
  error?: string;

  // New fields
  hash_mismatches?: number;
  signature_failures?: number;
  timestamp_issues?: number;
  payload_errors?: number;

  // Statistics
  first_entry_timestamp?: number;
  last_entry_timestamp?: number;
  verification_duration_ms?: number;

  // Detailed errors
  errors?: Array<{
    entry_id: string;
    type:
      | "hash_mismatch"
      | "signature_invalid"
      | "timestamp_out_of_order"
      | "payload_invalid";
    message: string;
  }>;
}
```

**Impact**: Betere diagnostiek bij integriteitsproblemen.

### 10. Entry-Level Verification

**Probleem**: Geen manier om individuele entries te verifiëren.

**Oplossing**: Voeg `verifyEntry()` methode toe.

```typescript
// In ledger-core.ts
static async verifyEntry(
  db: LedgerDb,
  signer: LedgerSigner,
  entryId: string
): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const entry = await this.getEntry(db, entryId);

  if (!entry) {
    return {
      valid: false,
      errors: ["Entry not found"],
    };
  }

  const errors: string[] = [];

  // 1. Verify hash
  const computedHash = this.computeHash(entry.stream, entry.id, entry.payload);
  if (entry.hash !== computedHash) {
    errors.push(`Hash mismatch: stored ${entry.hash}, computed ${computedHash}`);
  }

  // 2. Verify signature
  if (entry.signature) {
    const message = entry.prev_hash
      ? `${entry.hash}:${entry.prev_hash}`
      : entry.hash;

    const isValid = LedgerSigner.verify(
      message,
      entry.signature,
      signer.getPublicKeyHex()
    );

    if (!isValid) {
      errors.push("Invalid signature");
    }
  }

  // 3. Verify prevHash chain (if not genesis)
  if (entry.prev_hash) {
    const prevEntry = await db.query.ledgerEntries.findFirst({
      where: (table, { eq }) => eq(table.hash, entry.prev_hash),
    });

    if (!prevEntry) {
      errors.push("Previous entry not found");
    } else if (prevEntry.hash !== entry.prev_hash) {
      errors.push("Previous hash mismatch");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

**Impact**: Verificatie van individuele entries mogelijk.

## 📊 Implementatie Prioriteit

### Hoge Prioriteit (Direct Impact)

1. **Hash Recomputatie Verificatie** - Detecteert corrupte data
2. **Signature Verificatie** - Detecteert tampering
3. **Entry-Level Verification** - Basis functionaliteit

### Medium Prioriteit (Significant Impact)

4. **Timestamp Ordering** - Detecteert timestamp manipulatie
5. **Payload Integriteit** - Detecteert corrupte payloads
6. **Enhanced Verification Result** - Betere diagnostiek

### Lage Prioriteit (Nice to Have)

7. **Merkle Tree** - Betere checkpoint verificatie
8. **Periodic Checks** - Automatische monitoring
9. **Audit Logging** - Traceerbaarheid
10. **Database Constraints** - Extra bescherming

## 🚀 Implementatie Roadmap

### Fase 1: Core Verificatie (1-2 weken)

- Hash recomputatie verificatie
- Signature verificatie
- Entry-level verification
- Enhanced verification result

### Fase 2: Advanced Checks (2-3 weken)

- Timestamp ordering
- Payload integriteit
- Periodic integrity checker
- Audit logging

### Fase 3: Optimization (3-4 weken)

- Merkle tree implementatie
- Database constraints
- Performance optimalisaties
- Monitoring dashboard

## 🔒 Security Impact

Deze verbeteringen verhogen de integriteit van het ledger systeem aanzienlijk:

- **Tamper Detection**: Detecteert wijzigingen in entries
- **Data Corruption**: Detecteert corrupte data
- **Timestamp Manipulation**: Detecteert timestamp wijzigingen
- **Signature Forgery**: Detecteert ongeldige signatures
- **Chain Integrity**: Volledige chain verificatie

## 📝 Testing

Voor elke verbetering:

1. **Unit Tests** - Test individuele verificatie functies
2. **Integration Tests** - Test volledige chain verificatie
3. **Corruption Tests** - Test met corrupte data
4. **Performance Tests** - Test impact op performance

## 🎯 Conclusie

Deze verbeteringen maken het ledger systeem veel robuuster en betrouwbaarder. Ze detecteren verschillende vormen van corruptie en tampering, en bieden betere diagnostiek bij problemen.

**Aanbeveling**: Start met Fase 1 (core verificatie) voor directe impact op integriteit.

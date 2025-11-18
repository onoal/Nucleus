# Integriteit Verbeteringen - Implementatie Stappenplan

## 📋 Overzicht

Dit document bevat een gedetailleerd, stap-voor-stap implementatieplan voor alle integriteitsverbeteringen. Elke stap bevat:

- **Waarom**: Reden en doel van de stap
- **Wat**: Exacte acties en wijzigingen
- **Waar**: Bestandslocaties en code referenties
- **Wie**: Betrokken classes, functies en componenten

---

## 🎯 Fase 1: Core Verificatie (Hoge Prioriteit)

### Stap 1.1: Uitbreiden ChainVerificationResult Type

#### Waarom

Het huidige `ChainVerificationResult` type geeft beperkte informatie. We hebben meer details nodig voor betere diagnostiek bij integriteitsproblemen.

#### Wat

- Uitbreiden `ChainVerificationResult` interface met nieuwe velden
- Toevoegen van error tracking arrays
- Toevoegen van statistieken velden

#### Waar

**Bestand**: `ledger/framework/src/core/types-internal.ts`

- **Lijn**: 95-99 (huidige interface definitie)
- **Context**: `ChainVerificationResult` interface

#### Wie

- **Type**: `ChainVerificationResult` interface
- **Gebruikt door**:
  - `HashChain.verifyChain()` in `hash-chain.ts`
  - `OnoalLedgerImpl.verifyChain()` in `ledger.ts`
  - `coreRoutesModule()` in `core-routes.ts`

#### Code Wijziging

```typescript
// HUIDIG (regel 95-99):
export interface ChainVerificationResult {
  valid: boolean;
  error?: string;
  entries_checked?: number;
}

// NIEUW:
export interface ChainVerificationResult {
  valid: boolean;
  error?: string;
  entries_checked?: number;

  // Nieuwe velden voor gedetailleerde tracking
  hash_mismatches?: number;
  signature_failures?: number;
  timestamp_issues?: number;
  payload_errors?: number;

  // Statistieken
  first_entry_timestamp?: number;
  last_entry_timestamp?: number;
  verification_duration_ms?: number;

  // Gedetailleerde errors per entry
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

#### Impact

- Alle callers van `verifyChain()` moeten mogelijk worden aangepast
- Nieuwe velden zijn optioneel, dus backward compatible

---

### Stap 1.2: Hash Recomputatie Verificatie Toevoegen

#### Waarom

De huidige `verifyChain()` controleert alleen `prevHash` links, maar verifieert niet of de opgeslagen `hash` overeenkomt met de berekende hash. Dit is kritiek om corrupte entries te detecteren.

#### Wat

- Toevoegen van hash recomputatie check in `verifyChain()`
- Vergelijken van opgeslagen hash met berekende hash
- Toevoegen van error tracking voor hash mismatches

#### Waar

**Bestand**: `ledger/framework/src/core/hash-chain.ts`

- **Functie**: `HashChain.verifyChain()` (regel 46-116)
- **Specifieke locatie**: In de loop die entries verifieert (regel 94-113)
- **Nodig**: Toegang tot `LedgerCore.computeHash()` methode

#### Wie

- **Class**: `HashChain` (static class)
- **Methode**: `verifyChain()`
- **Afhankelijk van**:
  - `LedgerCore.computeHash()` - voor hash berekening
  - Database query resultaten - entries met payload
- **Gebruikt door**:
  - `OnoalLedgerImpl.verifyChain()` (regel 1111 in `ledger.ts`)
  - `coreRoutesModule()` (regel 99 in `core-routes.ts`)

#### Code Wijziging

```typescript
// In hash-chain.ts, regel 75-85: Query moet payload bevatten
const rows = await db
  .select({
    id: schema.ledgerEntries.id,
    stream: schema.ledgerEntries.stream, // NIEUW: nodig voor hash berekening
    hash: schema.ledgerEntries.hash,
    prevHash: schema.ledgerEntries.prevHash,
    timestamp: schema.ledgerEntries.timestamp,
    payload: schema.ledgerEntries.payload, // NIEUW: nodig voor hash berekening
  })
  .from(schema.ledgerEntries)
  .where(whereClause)
  .orderBy(asc(schema.ledgerEntries.timestamp))
  .limit(limit);

// In hash-chain.ts, regel 94-113: Voeg hash verificatie toe
let prevHash: string | null = null;
let entriesChecked = 0;
let hashMismatches = 0; // NIEUW: counter
const errors: Array<{ entry_id: string; type: string; message: string }> = []; // NIEUW: error array

for (const entry of rows) {
  // NIEUW: 1. Verify hash matches computed hash
  const payloadParsed =
    typeof entry.payload === "string"
      ? JSON.parse(entry.payload)
      : entry.payload;

  const computedHash = LedgerCore.computeHash(
    entry.stream as LedgerStream,
    entry.id,
    payloadParsed
  );

  if (entry.hash !== computedHash) {
    hashMismatches++;
    errors.push({
      entry_id: entry.id,
      type: "hash_mismatch",
      message: `Hash mismatch: stored ${entry.hash}, computed ${computedHash}`,
    });

    // Optioneel: continue of fail fast
    return {
      valid: false,
      error: `Hash mismatch at entry ${entry.id}`,
      entries_checked: entriesChecked,
      hash_mismatches: hashMismatches,
      errors,
    };
  }

  // Bestaande prevHash check (regel 95-109)
  // ...
}
```

#### Impact

- Query moet nu ook `stream` en `payload` ophalen (meer data transfer)
- Performance impact: extra hash berekening per entry
- Nodig: Import van `LedgerCore` in `hash-chain.ts`

---

### Stap 1.3: Signature Verificatie Toevoegen

#### Waarom

Signatures worden gegenereerd bij append maar nooit geverifieerd tijdens chain verification. Dit is essentieel om tampering te detecteren.

#### Wat

- Toevoegen van signature verificatie in `verifyChain()`
- Verificeren met publieke sleutel van signer
- Toevoegen van error tracking voor signature failures

#### Waar

**Bestand**: `ledger/framework/src/core/hash-chain.ts`

- **Functie**: `HashChain.verifyChain()` (regel 46-116)
- **Specifieke locatie**: Na hash verificatie, in de entry loop
- **Nodig**: `LedgerSigner` instance met publieke sleutel

#### Wie

- **Class**: `HashChain` (static class)
- **Methode**: `verifyChain()` - moet `signer` parameter krijgen
- **Afhankelijk van**:
  - `LedgerSigner.verify()` - static methode voor verificatie
  - Publieke sleutel van de ledger signer
- **Gebruikt door**:
  - `OnoalLedgerImpl.verifyChain()` - moet signer doorgeven
  - `coreRoutesModule()` - moet signer doorgeven

#### Code Wijziging

```typescript
// In hash-chain.ts, regel 46: Voeg signer parameter toe
static async verifyChain(
  db: LedgerDb,
  signer: LedgerSigner,  // NIEUW: signer parameter
  startId?: string,
  limit: number = 100
): Promise<ChainVerificationResult> {
  // ... existing code ...

  let signatureFailures = 0;  // NIEUW: counter

  for (const entry of rows) {
    // ... hash verificatie (Stap 1.2) ...

    // NIEUW: 2. Verify signature if present
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
        signatureFailures++;
        errors.push({
          entry_id: entry.id,
          type: "signature_invalid",
          message: "Invalid signature",
        });

        return {
          valid: false,
          error: `Invalid signature at entry ${entry.id}`,
          entries_checked: entriesChecked,
          signature_failures: signatureFailures,
          errors,
        };
      }
    }

    // ... rest van verificatie ...
  }

  // Update return statement (regel 115)
  return {
    valid: true,
    entries_checked: entriesChecked,
    hash_mismatches: hashMismatches,
    signature_failures: signatureFailures,
    errors: errors.length > 0 ? errors : undefined,
  };
}
```

#### Impact

- **Breaking change**: `verifyChain()` signature wijzigt (nieuwe parameter)
- Alle callers moeten worden aangepast:
  - `OnoalLedgerImpl.verifyChain()` (regel 1111 in `ledger.ts`)
  - `coreRoutesModule()` (regel 99 in `core-routes.ts`)
- Nodig: Import van `LedgerSigner` in `hash-chain.ts`

---

### Stap 1.4: Ledger.ts Aanpassen voor Nieuwe verifyChain Signature

#### Waarom

Na Stap 1.3 heeft `HashChain.verifyChain()` een nieuwe `signer` parameter nodig. We moeten de caller aanpassen om de signer door te geven.

#### Wat

- Aanpassen van `OnoalLedgerImpl.verifyChain()` om signer door te geven
- Toegang krijgen tot de ledger signer instance

#### Waar

**Bestand**: `ledger/framework/src/core/ledger.ts`

- **Class**: `OnoalLedgerImpl` (regel 373+)
- **Methode**: `verifyChain()` (regel 1074-1170)
- **Specifieke locatie**: Regel 1111 waar `HashChain.verifyChain()` wordt aangeroepen

#### Wie

- **Class**: `OnoalLedgerImpl`
- **Methode**: `verifyChain()`
- **Afhankelijk van**:
  - `this.signer` - LedgerSigner instance (moet beschikbaar zijn in class)
  - `HashChain.verifyChain()` - met nieuwe signature
- **Gebruikt door**:
  - Externe API via `OnoalLedger` interface
  - `coreRoutesModule()` route handler

#### Code Wijziging

```typescript
// In ledger.ts, regel 1111: Pas aanroep aan
// HUIDIG:
verificationResult = await HashChain.verifyChain(
  this.database.db,
  startId,
  limit
);

// NIEUW:
verificationResult = await HashChain.verifyChain(
  this.database.db,
  this.signer, // NIEUW: signer parameter
  startId,
  limit
);
```

#### Impact

- **Signer beschikbaar**: `this.signer` is al beschikbaar in `OnoalLedgerImpl` (constructor parameter, regel 384 in `ledger.ts`)
- Geen extra wijzigingen nodig voor signer toegang
- Direct gebruik: `this.signer` in de methode

---

### Stap 1.5: Core Routes Aanpassen voor Nieuwe verifyChain Signature

#### Waarom

De `/ledger/verify` route gebruikt `HashChain.verifyChain()` direct en moet worden aangepast voor de nieuwe signature.

#### Wat

- Aanpassen van route handler om signer te verkrijgen
- Doorgeven van signer aan `HashChain.verifyChain()`

#### Waar

**Bestand**: `ledger/framework/src/core/core-routes.ts`

- **Functie**: `coreRoutesModule()` (regel 25+)
- **Specifieke locatie**: Route handler voor `GET /ledger/verify` (regel 77-114)
- **Regel 99**: Directe aanroep van `HashChain.verifyChain()`

#### Wie

- **Functie**: `coreRoutesModule()` - factory functie
- **Route handler**: `GET /ledger/verify` (regel 81)
- **Afhankelijk van**:
  - `ledger` instance - om signer te verkrijgen
  - `HashChain.verifyChain()` - met nieuwe signature
- **Gebruikt door**: HTTP requests naar `/ledger/verify`

#### Code Wijziging

```typescript
// In core-routes.ts, regel 81-113: Pas route handler aan
{
  method: "GET",
  path: "/ledger/verify",
  handler: async (req: Request, ledger: OnoalLedger) => {
    try {
      const database = ledger.getService<any>("database") as
        | LedgerDatabase
        | undefined;
      if (!database || !database.db) {
        return Response.json(
          { error: "Database not initialized" },
          { status: 500 }
        );
      }
      const db = database.db;

      // NIEUW: Get signer from service container
      // Signer wordt geregistreerd als service tijdens ledger creatie (ledger.ts:237)
      const signer = ledger.getService<LedgerSigner>("signer");
      if (!signer) {
        return Response.json(
          { error: "Signer not available" },
          { status: 500 }
        );
      }

      const url = new URL(req.url);
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam
        ? Math.min(Math.max(parseInt(limitParam, 10), 1), 1000)
        : 100;

      // AANGEPAST: Voeg signer parameter toe
      const result = await HashChain.verifyChain(db, signer, undefined, limit);

      return Response.json(result);
    } catch (error) {
      console.error("Chain verification error:", error);
      return Response.json(
        {
          error: "Failed to verify hash chain",
          message:
            error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  },
},
```

#### Impact

- **Signer beschikbaar**: Signer wordt geregistreerd als service tijdens ledger creatie (regel 237 in `ledger.ts`)
- **Service naam**: `"signer"`
- **Type**: `LedgerSigner` (import uit `core/signer.ts`)
- **Nodig**: Import toevoegen: `import type { LedgerSigner } from "../core/signer.js";`

---

### Stap 1.6: Entry-Level Verification Methode Toevoegen

#### Waarom

Naast chain verification moeten we individuele entries kunnen verifiëren. Dit is nuttig voor debugging en spot checks.

#### Wat

- Nieuwe `verifyEntry()` methode toevoegen aan `LedgerCore`
- Verificeren van hash, signature en prevHash voor één entry
- Returneren van gedetailleerd resultaat

#### Waar

**Bestand**: `ledger/framework/src/core/ledger-core.ts`

- **Class**: `LedgerCore` (regel 22+)
- **Nieuwe methode**: `verifyEntry()` - toevoegen na `getEntry()` (regel 159)
- **Na regel**: ~193 (na `getEntry()` implementatie)

#### Wie

- **Class**: `LedgerCore` (static class)
- **Nieuwe methode**: `verifyEntry()` - static methode
- **Afhankelijk van**:
  - `LedgerCore.getEntry()` - om entry op te halen
  - `LedgerCore.computeHash()` - voor hash verificatie
  - `LedgerSigner.verify()` - voor signature verificatie
- **Gebruikt door**:
  - `OnoalLedgerImpl` - om entry verificatie te bieden
  - Externe API (via nieuwe route)

#### Code Wijziging

```typescript
// In ledger-core.ts, na regel 193: Voeg nieuwe methode toe
/**
 * Verify a single entry's integrity
 *
 * Checks:
 * 1. Hash matches computed hash
 * 2. Signature is valid (if present)
 * 3. Previous hash chain link is valid (if not genesis)
 *
 * @param db - Database instance
 * @param signer - Ledger signer with public key
 * @param entryId - Entry ID to verify
 * @returns Verification result with errors array
 */
static async verifyEntry(
  db: LedgerDb,
  signer: LedgerSigner,
  entryId: string
): Promise<{
  valid: boolean;
  errors: string[];
  entry_id: string;
}> {
  const entry = await this.getEntry(db, entryId);

  if (!entry) {
    return {
      valid: false,
      errors: ["Entry not found"],
      entry_id: entryId,
    };
  }

  const errors: string[] = [];

  // 1. Verify hash
  const computedHash = this.computeHash(entry.stream, entry.id, entry.payload);
  if (entry.hash !== computedHash) {
    errors.push(
      `Hash mismatch: stored ${entry.hash}, computed ${computedHash}`
    );
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
      errors.push("Previous entry not found in chain");
    } else if (prevEntry.hash !== entry.prev_hash) {
      errors.push("Previous hash mismatch");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    entry_id: entry.id,
  };
}
```

#### Impact

- Nieuwe publieke API methode
- Vereist import van `LedgerSigner` in `ledger-core.ts`
- Kan worden geëxporteerd via `OnoalLedger` interface

---

### Stap 1.7: Entry Verification Toevoegen aan Ledger Interface

#### Waarom

Entry verification moet beschikbaar zijn via de publieke `OnoalLedger` interface.

#### Wat

- Toevoegen van `verifyEntry()` methode aan `OnoalLedger` interface
- Implementeren in `OnoalLedgerImpl` class
- Exporteren via `index.ts`

#### Waar

**Bestand 1**: `ledger/framework/src/core/types.ts`

- **Interface**: `OnoalLedger` (zoek naar interface definitie, ~regel 735+)
- **Toevoegen**: Nieuwe methode signature

**Bestand 2**: `ledger/framework/src/core/ledger.ts`

- **Class**: `OnoalLedgerImpl` (regel 373+)
- **Toevoegen**: Implementatie van `verifyEntry()`

**Bestand 3**: `ledger/framework/src/index.ts`

- **Export**: Zorg dat methode geëxporteerd wordt

#### Wie

- **Interface**: `OnoalLedger` - publieke API contract
- **Class**: `OnoalLedgerImpl` - implementatie
- **Methode**: `verifyEntry()` - nieuwe publieke methode
- **Afhankelijk van**:
  - `LedgerCore.verifyEntry()` - core implementatie
  - `this.signer` - signer instance
- **Gebruikt door**: Externe code die ledger gebruikt

#### Code Wijziging

```typescript
// In types.ts, in OnoalLedger interface (na verifyChain):
/**
 * Verify a single entry's integrity
 *
 * @param entryId - Entry ID to verify
 * @returns Verification result with errors array
 */
verifyEntry(entryId: string): Promise<{
  valid: boolean;
  errors: string[];
  entry_id: string;
}>;

// In ledger.ts, in OnoalLedgerImpl class (na verifyChain methode, ~regel 1170):
async verifyEntry(entryId: string): Promise<{
  valid: boolean;
  errors: string[];
  entry_id: string;
}> {
  try {
    return await LedgerCore.verifyEntry(
      this.database.db,
      this.signer,
      entryId
    );
  } catch (error) {
    this.logger.error(
      "Entry verification failed",
      error instanceof Error ? error : new Error(String(error)),
      { entryId, operation: "verifyEntry" }
    );
    throw error;
  }
}
```

#### Impact

- Nieuwe publieke API
- Backward compatible (nieuwe methode)
- Vereist dat `this.signer` beschikbaar is

---

## 🎯 Fase 2: Advanced Checks (Medium Prioriteit)

### Stap 2.1: Timestamp Ordering Verificatie

#### Waarom

Timestamps moeten monotoom stijgen. Out-of-order timestamps kunnen wijzen op timestamp manipulatie of ontbrekende entries.

#### Wat

- Toevoegen van timestamp ordering check in `verifyChain()`
- Detecteren van out-of-order timestamps
- Optioneel: waarschuwen voor grote gaps

#### Waar

**Bestand**: `ledger/framework/src/core/hash-chain.ts`

- **Functie**: `HashChain.verifyChain()` (regel 46-116)
- **Specifieke locatie**: In de entry loop, na signature verificatie

#### Wie

- **Class**: `HashChain`
- **Methode**: `verifyChain()`
- **Afhankelijk van**: Entry timestamps uit database query
- **Gebruikt door**: Chain verification flow

#### Code Wijziging

```typescript
// In hash-chain.ts, in verifyChain() loop:
let lastTimestamp: number | null = null;
let timestampIssues = 0;

for (const entry of rows) {
  // ... hash en signature verificatie ...

  // NIEUW: 3. Verify timestamp ordering
  if (lastTimestamp !== null && entry.timestamp < lastTimestamp) {
    timestampIssues++;
    errors.push({
      entry_id: entry.id,
      type: "timestamp_out_of_order",
      message: `Timestamp out of order: ${entry.timestamp} < ${lastTimestamp}`,
    });

    return {
      valid: false,
      error: `Timestamp out of order at entry ${entry.id}`,
      entries_checked: entriesChecked,
      timestamp_issues: timestampIssues,
      errors,
    };
  }

  // Optioneel: Check for large gaps (warning only)
  if (lastTimestamp !== null) {
    const gap = entry.timestamp - lastTimestamp;
    if (gap > 24 * 60 * 60 * 1000) {
      // 24 hours
      // Log warning but don't fail
      console.warn(
        `Large timestamp gap detected: ${gap}ms between entries ${entry.id}`
      );
    }
  }

  lastTimestamp = entry.timestamp;
  prevHash = entry.hash;
  entriesChecked++;
}
```

#### Impact

- Detecteert timestamp manipulatie
- Kan false positives geven bij clock skew (overweeg tolerance)

---

### Stap 2.2: Payload Integriteit Verificatie

#### Waarom

Payload moet geldige JSON zijn en een object. Corrupte payloads kunnen wijzen op database corruptie.

#### Wat

- Toevoegen van payload parsing verificatie
- Valideren dat payload een object is
- Error tracking voor payload errors

#### Waar

**Bestand**: `ledger/framework/src/core/hash-chain.ts`

- **Functie**: `HashChain.verifyChain()` (regel 46-116)
- **Specifieke locatie**: In de entry loop, na hash verificatie (payload is al geparsed)

#### Wie

- **Class**: `HashChain`
- **Methode**: `verifyChain()`
- **Afhankelijk van**: Entry payload uit database
- **Gebruikt door**: Chain verification flow

#### Code Wijziging

```typescript
// In hash-chain.ts, in verifyChain() loop:
let payloadErrors = 0;

for (const entry of rows) {
  // ... hash verificatie (payload is al geparsed) ...

  // NIEUW: 4. Verify payload integrity
  try {
    const payloadParsed =
      typeof entry.payload === "string"
        ? JSON.parse(entry.payload)
        : entry.payload;

    // Verify payload is object
    if (typeof payloadParsed !== "object" || payloadParsed === null) {
      payloadErrors++;
      errors.push({
        entry_id: entry.id,
        type: "payload_invalid",
        message: "Payload is not an object",
      });

      return {
        valid: false,
        error: `Invalid payload at entry ${entry.id}`,
        entries_checked: entriesChecked,
        payload_errors: payloadErrors,
        errors,
      };
    }
  } catch (error) {
    payloadErrors++;
    errors.push({
      entry_id: entry.id,
      type: "payload_invalid",
      message: `Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`,
    });

    return {
      valid: false,
      error: `Invalid JSON payload at entry ${entry.id}`,
      entries_checked: entriesChecked,
      payload_errors: payloadErrors,
      errors,
    };
  }

  // ... rest van verificatie ...
}
```

#### Impact

- Detecteert corrupte payload data
- Kan performance impact hebben (extra JSON parsing, maar dit gebeurt al voor hash check)

---

### Stap 2.3: Enhanced Return Statement met Statistieken

#### Waarom

Het return statement moet alle nieuwe statistieken en errors bevatten voor volledige diagnostiek.

#### Wat

- Updaten van return statement in `verifyChain()`
- Toevoegen van alle counters en statistieken
- Toevoegen van timing informatie

#### Waar

**Bestand**: `ledger/framework/src/core/hash-chain.ts`

- **Functie**: `HashChain.verifyChain()` (regel 46-116)
- **Specifieke locatie**: Return statements (regel 53, 65, 88, 97, 105, 115)

#### Wie

- **Class**: `HashChain`
- **Methode**: `verifyChain()`
- **Return type**: `ChainVerificationResult` (uitgebreid in Stap 1.1)
- **Gebruikt door**: Alle callers van verifyChain

#### Code Wijziging

```typescript
// In hash-chain.ts, aan het begin van verifyChain():
const startTime = Date.now(); // NIEUW: timing start

// In verifyChain(), aan het einde (regel 115):
const verificationDuration = Date.now() - startTime; // NIEUW: timing

return {
  valid: true,
  entries_checked: entriesChecked,
  hash_mismatches: hashMismatches || 0,
  signature_failures: signatureFailures || 0,
  timestamp_issues: timestampIssues || 0,
  payload_errors: payloadErrors || 0,
  first_entry_timestamp: rows.length > 0 ? rows[0].timestamp : undefined,
  last_entry_timestamp:
    rows.length > 0 ? rows[rows.length - 1].timestamp : undefined,
  verification_duration_ms: verificationDuration,
  errors: errors.length > 0 ? errors : undefined,
};
```

#### Impact

- Alle return statements moeten worden aangepast
- Consistente error reporting

---

## 🎯 Fase 3: Optimalisatie & Advanced Features (Lage Prioriteit)

### Stap 3.1: Merkle Tree Implementatie

#### Waarom

Echte Merkle trees zijn efficiënter dan simpele concatenatie voor checkpoint verificatie.

#### Wat

- Nieuwe `buildMerkleTree()` methode toevoegen
- Aanpassen van `createCheckpoint()` om Merkle tree te gebruiken

#### Waar

**Bestand**: `ledger/framework/src/core/hash-chain.ts`

- **Functie**: `createCheckpoint()` (regel 121-160)
- **Nieuwe methode**: `buildMerkleTree()` - toevoegen voor `createCheckpoint()`

#### Wie

- **Class**: `HashChain`
- **Nieuwe methode**: `buildMerkleTree()` - static methode
- **Functie**: `createCheckpoint()` - gebruikt nieuwe methode
- **Afhankelijk van**: `sha256` hashing
- **Gebruikt door**: Checkpoint creation

#### Code Wijziging

```typescript
// In hash-chain.ts, voor createCheckpoint():
/**
 * Build Merkle tree from entry hashes
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

// In createCheckpoint(), vervang regel 142-144:
// HUIDIG:
const allHashes = rows.map((row: any) => row.hash).join(":");
const encoder = new TextEncoder();
const rootHash = bytesToHex(sha256(encoder.encode(allHashes)));

// NIEUW:
const hashes = rows.map((row: any) => row.hash);
const rootHash = this.buildMerkleTree(hashes);
```

#### Impact

- Betere integriteit voor checkpoints
- Efficiënter dan concatenatie

---

## 📝 Testing Checklist

Voor elke stap:

### Unit Tests

- [ ] Test hash recomputatie verificatie
- [ ] Test signature verificatie
- [ ] Test timestamp ordering
- [ ] Test payload integriteit
- [ ] Test entry-level verification
- [ ] Test error tracking

### Integration Tests

- [ ] Test volledige chain verification met alle checks
- [ ] Test met corrupte data
- [ ] Test met ontbrekende signatures
- [ ] Test met out-of-order timestamps

### Performance Tests

- [ ] Benchmark verifyChain() met nieuwe checks
- [ ] Test impact op grote chains (1000+ entries)

---

## 🔄 Dependencies & Volgorde

### Kritieke Volgorde

1. **Stap 1.1** moet eerst (type definitie)
2. **Stap 1.2-1.3** kunnen parallel (beide in hash-chain.ts)
3. **Stap 1.4-1.5** moeten na 1.3 (callers aanpassen)
4. **Stap 1.6-1.7** kunnen parallel (nieuwe feature)
5. **Stap 2.x** kunnen na Fase 1

### Breaking Changes

- **Stap 1.3**: Breaking change in `HashChain.verifyChain()` signature
- **Stap 1.4-1.5**: Vereist aanpassing van alle callers

### Backward Compatibility

- Nieuwe velden in `ChainVerificationResult` zijn optioneel
- Nieuwe methoden zijn additions, geen wijzigingen

---

## ✅ Implementatie Checklist

### Fase 1: Core Verificatie

- [ ] Stap 1.1: Uitbreiden ChainVerificationResult type
- [ ] Stap 1.2: Hash recomputatie verificatie
- [ ] Stap 1.3: Signature verificatie
- [ ] Stap 1.4: Ledger.ts aanpassen
- [ ] Stap 1.5: Core routes aanpassen
- [ ] Stap 1.6: Entry verification methode
- [ ] Stap 1.7: Entry verification in interface

### Fase 2: Advanced Checks

- [ ] Stap 2.1: Timestamp ordering
- [ ] Stap 2.2: Payload integriteit
- [ ] Stap 2.3: Enhanced return statement

### Fase 3: Optimalisatie

- [ ] Stap 3.1: Merkle tree implementatie

---

**Laatste update**: Gedetailleerd implementatieplan met codebase referenties
**Versie**: 1.0.0

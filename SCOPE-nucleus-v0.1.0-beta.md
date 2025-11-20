1. Doel van Nucleus v0.1.0-beta

Hoofddoel

Een minimaal maar kloppend Nucleus-systeem waarmee je:

OID-records kunt verankeren in een ledger (via de oid module).

Proofs/attestations kunt opslaan over OID-subjects (via de proof module).

Dit alles met:

TypeScript als hoofdtaal (SDK, modules, adapters).

Rust alleen voor canonicalisatie + hashing (via WASM).

Gebruiksscenario’s van de beta

Elke namespace (bijv. onoal) kan z’n eigen OID-records vastleggen in Nucleus.

Voor die OIDs kun je in dezelfde Nucleus-instantie proofs schrijven (KYC, membership, etc.).

Alles is:

append-only

verifieerbaar

lokaal/autonoom

2. Talen & verantwoordelijkheden
   2.1 TypeScript (leidend)

TS is de “host” en orkestreert alles:

Public SDK (@onoal/nucleus-sdk)

Storage-adapters (@onoal/nucleus-storage-sqlite)

Module-implementaties:

proof module

oid module

Integratie met @onoal/oid lib:

OID parsing & validatie

OID-record types

High-level chain-logica:

head → index, prevHash

context (callerOid, timestamps)

Error handling / logging

2.2 Rust (minimal core)

Rust is alleen voor deterministische integriteits-primitieven:

Canonical JSON (JCS-stijl) voor NucleusRecords (en optioneel OID-records).

SHA-256 hashing + base64url encodering.

Export via WASM:

computeHash(recordWithoutHash: any): string;
canonicalize(recordWithoutHash: any): Uint8Array; // optional

Geen IO, geen adapters, geen modulelogica in Rust in deze beta.

3. Nucleus Core – datamodel & engine (v0.1.0-beta)
   3.1 NucleusRecord

JSON-object:

{
"schema": "nucleus-core/v0.1.0-beta",
"module": "proof",
"chainId": "nucleus:proof:example-1",
"index": 0,
"prevHash": null,
"createdAt": "2025-11-20T12:00:00Z",
"body": {},
"meta": {},
"hash": "base64url-sha256"
}

Core velden (gelijk aan eerdere spec, maar versietag aangepast):

schema: "nucleus-core/v0.1.0-beta"

module: "proof" of "oid"

chainId: string, opaque; per module bepaal je patroon

index: integer, 0-based

prevHash: null voor genesis, anders hash van vorige record in chain

createdAt: ISO 8601 UTC

body: JSON payload (module-specifiek)

meta: optioneel metadata object (tags, hints)

hash: base64url(SHA-256(canonical(record zonder hash)))

3.2 Core invariants

De engine (TS) dwingt af:

Append-only

nooit update/delete, alleen nieuwe records.

Uniciteit

hash is uniek

(chainId, index) is uniek

Chain-consistentie

index == 0 → prevHash == null

index > 0 → er bestaat een record P met zelfde chainId, P.index == index-1, P.hash == prevHash.

3.3 Canonicalisatie & hashing (Rust → WASM)

Rust-core doet:

fn compute_hash(record_without_hash: JsValue) -> String;

Canonicaliseer JSON:

keys gesorteerd

geen extra whitespace

hash-property uitgesloten

SHA-256 over canonical bytes

base64url-encode → string

TS-engine:

bouwt record zonder hash

roept compute_hash

voegt hash toe

slaat record op

4. TS SDK & storage
   4.1 @onoal/nucleus-sdk

Publieke API:

interface Nucleus {
append(input: AppendInput): Promise<NucleusRecord>;
getHead(chainId: string): Promise<NucleusRecord | null>;
getByHash(hash: string): Promise<NucleusRecord | null>;
getChain(chainId: string, opts?: GetChainOpts): Promise<NucleusRecord[]>;
}

interface AppendInput {
module: "proof" | "oid";
chainId: string;
body: any;
meta?: Record<string, any>;
context?: {
callerOid?: string; // OID van schrijver
now?: string; // optioneel override, anders system time UTC
};
}

Flow in append:

Bepaal now (of gebruik context.now).

Haal prevRecord = getHead(chainId).

Stel index + prevHash vast.

Bouw tijdelijk record zonder hash.

Roep Rust compute_hash aan → hash.

Bouw final record.

Vind module-runtime (proof of oid) → validateRecord(...).

Als ok == false → error.

Sla record op via storage-adapter.

Return record.

4.2 @onoal/nucleus-storage-sqlite

SQLite-tabel:

CREATE TABLE records (
hash TEXT PRIMARY KEY,
chain_id TEXT NOT NULL,
idx INTEGER NOT NULL,
created_at TEXT NOT NULL,
module TEXT NOT NULL,
json TEXT NOT NULL
);

CREATE UNIQUE INDEX records_chain_idx ON records(chain_id, idx);

Implements:

interface RecordStore {
put(record: NucleusRecord): Promise<void>;
getByHash(hash: string): Promise<NucleusRecord | null>;
getChain(chainId: string, opts?: GetChainOpts): Promise<NucleusRecord[]>;
getHead(chainId: string): Promise<NucleusRecord | null>;
}

5. Modules v0.1.0-beta

In deze beta zijn er twee modules:

proof – voor attestations over OIDs.

oid – om OID-records zelf te verankeren per namespace.

Allebei draaien als TS-modules via een uniforme runtime-interface.

5.1 Module runtime interface (TS)
interface ModuleRuntime {
validateRecord(input: {
record: NucleusRecord;
prevRecord: NucleusRecord | null;
context: {
callerOid?: string;
now: string;
};
}): Promise<{ ok: boolean; errorCode?: string; errorMessage?: string }>;
}

SDK:

registerModule("proof", proofModuleRuntime);
registerModule("oid", oidModuleRuntime);

5.2 proof module – OID-native proofs

Doel: attestations/proofs over OID-subjects, door OID-issuers.

5.2.1 Body-structuur

record.body:

{
"subject": "oid:onoal:user:6w9f4k2h3p",
"issuer": "oid:onoal:org:1af093c2",
"kind": "kyc",
"data": {
"country": "NL",
"level": "basic"
},
"issuedAt": "2025-11-20T12:00:00Z",
"expiresAt": "2026-11-20T12:00:00Z",
"issuerProof": {
"type": "ed25519-jcs-2025",
"keyRef": "#main",
"signature": "base64url..."
}
}

OID is hier “native” omdat:

subject en issuer MUST geldige OID-strings zijn (gevalideerd door @onoal/oid).

Clients kunnen direct doorklikken naar OID-records (via de oid module).

5.2.2 Validatieregels (v0.1.0-beta)

De proof module runtime in TS:

Checkt:

subject en issuer parsebaar als geldige OIDs.

kind is non-empty string.

data is een object.

issuedAt is geldige ISO-tijd.

issuedAt <= record.createdAt.

Als expiresAt aanwezig: expiresAt > issuedAt.

Als context.callerOid aanwezig:

MUST gelijk zijn aan issuer (issuer schrijft zijn eigen proofs).

IssuerProof (optioneel in beta, maar alvast voorbereid):

Wanneer ingevuld:

canonicaliseer body zonder issuerProof (kan in TS)

verifieer signature via OID-keys van issuer (met @onoal/oid + crypto lib)

ChainId-patroon (aanbevolen, niet hard):

één chain per (issuer, subject, kind)
→ makkelijk auditbaar, simpele historie.

5.3 oid module – OID-records verankeren

Doel: opslag van OID Core Records per namespace in Nucleus.
Je gebruikt Nucleus als integriteitslaag bovenop je OID-store.

5.3.1 Body-structuur

record.body bevat één OID-record:

{
"oidRecord": {
"oid": "oid:onoal:user:6w9f4k2h3p",
"schema": "oid-core/v0.1.1",
"kind": "human",
"keys": [ ... ],
"metadata": {
"displayName": "Thiemo",
"locale": "nl-NL"
},
"createdAt": "2025-11-20T12:00:00Z",
"updatedAt": "2025-11-20T12:00:00Z",
"proof": {
"type": "ed25519-jcs-2025",
"createdAt": "2025-11-20T12:00:00Z",
"keyRef": "#main",
"signature": "base64url..."
}
}
}

Let op: dit is exact het OID-recordformaat dat we eerder voor oid-core/v0.1.1 hebben gedefinieerd, ingepakt onder oidRecord.

5.3.2 ChainId-strategie (aanbevolen)

Je kunt per namespace een logische layout kiezen. Aanbevolen patroon:

Eén chain per OID:

chainId = "oid:" + <namespace> + ":" + <base64url(oid)>

Bijvoorbeeld voor oid:onoal:user:6w9f4k2h3p:

chainId = "oid:onoal:d2lkOm9ub2FsOnVzZXI6Nnc5ZjRrMmgzcA"

Dan krijg je:

Een lineaire historie per OID:

record 0: created

record 1: key-rotatie

record 2: metadata-update

etc.

5.3.3 Validatieregels (v0.1.0-beta)

De oid module runtime in TS:

Parse body.oidRecord als OID-record (@onoal/oid types).

Check:

schema == "oid-core/v0.1.1".

oidRecord.oid is een geldige OID string.

kind, keys, createdAt, updatedAt voldoen aan OID-spec.

proof van OID-record valide signature is (gebruik OID-lib + canonicalisatie).

Canonicalisatie van OID-record kun je in deze beta in TS doen; later mag dat ook via Rust-WASM gedeeld worden.

(Optioneel) Chain-consistentiepolicy:

Als prevRecord bestaat:

prev.body.oidRecord.oid MUST gelijk zijn aan huidige oid.

updatedAt van nieuwe record MUST > updatedAt van vorige.

OID mag niet “van namespace wisselen”.

Caller policy:

In beta mag je simpel houden:

Als context.callerOid aanwezig is:

Hij moet gelijk zijn aan oidRecord.oid of geautoriseerd zijn volgens jouw app-policy (later uit te breiden).

Je kunt deze policy nu nog mild houden en later strenger maken.

6. Non-goals v0.1.0-beta

Bewust niet in deze scope:

Geen Postgres/S3 adapters (alleen SQLite in deze beta).

Geen netwerk / replicatie / consensus.

Geen Rust-modules (alle modulelogica in TS).

Geen complexe multi-writer of multi-tenant access control (voor nu via app-laag).

Geen UI of query-DSL; alleen basis getHead, getByHash, getChain.

7. Samenvattend in één alinea

v0.1.0-beta van Nucleus is een TS-geleide ledger-engine met een kleine Rust-core (canonical JSON + hash), twee modules (proof en oid) die OID-gebaseerde waarheid vastleggen, en één SQLite-adapter. OID zit “native” in de records als subject / issuer én via de oid-module als verankerde OID-records per namespace. Alles is append-only, verifieerbaar en lokaal – precies genoeg om met echte data te gaan spelen zonder dat je jezelf vastschroeft voor de toekomst.

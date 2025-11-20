/**
 * Basic usage example for Nucleus v0.1.0-beta
 *
 * This example demonstrates:
 * 1. Registering modules
 * 2. Creating a Nucleus instance
 * 3. Anchoring an OID record
 * 4. Issuing a proof about that OID
 * 5. Querying the chains
 */

import {
  createNucleus,
  registerModule,
  oidModule,
  proofModule,
  generateOidChainId,
  generateProofChainId,
} from "../packages/nucleus/src/index.js";
import { SQLiteRecordStore } from "../packages/nucleus/src/storage-sqlite/index.js";
import type { OidRecord } from "../packages/nucleus/src/modules/oid/index.js";

async function main() {
  console.log("🚀 Nucleus v0.1.0-beta - Basic Usage Example\n");

  // ============================================================
  // 1. Register Modules
  // ============================================================
  console.log("📦 Registering modules...");
  registerModule("oid", oidModule);
  registerModule("proof", proofModule);
  console.log("✅ Modules registered: oid, proof\n");

  // ============================================================
  // 2. Create Nucleus Instance
  // ============================================================
  console.log("🔧 Creating Nucleus instance...");

  // Note: In production, use createNucleus() which loads WASM
  // For this example, we'll use Nucleus directly with a mock hash function
  const storage = new SQLiteRecordStore(":memory:");

  // Mock hash for example (in production, this comes from WASM)
  const mockComputeHash = (record: Record<string, unknown>): string => {
    const str = JSON.stringify(record);
    return `hash-${str.length}-${Date.now()}`;
  };

  const { Nucleus } = await import("../packages/nucleus/src/core/nucleus.js");
  const nucleus = new Nucleus(storage, mockComputeHash);

  console.log("✅ Nucleus instance created\n");

  // ============================================================
  // 3. Anchor an OID Record
  // ============================================================
  console.log("🆔 Anchoring OID record...");

  const aliceOid = "oid:onoal:user:alice123";

  const aliceOidRecord: OidRecord = {
    oid: aliceOid,
    schema: "oid-core/v0.1.1",
    kind: "human",
    keys: [
      {
        id: "#main",
        usage: ["auth", "sign"],
        alg: "ed25519",
        publicKey: "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
        createdAt: "2025-11-20T12:00:00.000Z",
      },
    ],
    metadata: {
      displayName: "Alice",
      locale: "en-US",
    },
    createdAt: "2025-11-20T12:00:00.000Z",
    updatedAt: "2025-11-20T12:00:00.000Z",
    proof: {
      type: "ed25519-jcs-2025",
      createdAt: "2025-11-20T12:00:00.000Z",
      keyRef: "#main",
      signature: "mock-signature-for-example",
    },
  };

  const oidChainId = generateOidChainId(aliceOid);

  const oidRecord = await nucleus.append({
    module: "oid",
    chainId: oidChainId,
    body: { oidRecord: aliceOidRecord },
    context: { callerOid: aliceOid },
  });

  console.log(`✅ OID anchored:`);
  console.log(`   Hash: ${oidRecord.hash}`);
  console.log(`   Chain: ${oidChainId}`);
  console.log(`   Index: ${oidRecord.index}\n`);

  // ============================================================
  // 4. Issue a Proof about Alice
  // ============================================================
  console.log("🔐 Issuing KYC proof about Alice...");

  const verifierOid = "oid:onoal:org:kyc-verifier";
  const proofChainId = generateProofChainId(verifierOid, aliceOid, "kyc");

  const kycProof = await nucleus.append({
    module: "proof",
    chainId: proofChainId,
    body: {
      subject: aliceOid,
      issuer: verifierOid,
      kind: "kyc",
      data: {
        country: "NL",
        level: "basic",
        verifiedAt: "2025-11-20T12:00:00.000Z",
      },
      issuedAt: "2025-11-20T12:00:00.000Z",
      expiresAt: "2026-11-20T12:00:00.000Z",
    },
    context: { callerOid: verifierOid },
  });

  console.log(`✅ Proof issued:`);
  console.log(`   Hash: ${kycProof.hash}`);
  console.log(`   Chain: ${proofChainId}`);
  console.log(`   Subject: ${aliceOid}`);
  console.log(`   Issuer: ${verifierOid}\n`);

  // ============================================================
  // 5. Query Chains
  // ============================================================
  console.log("📊 Querying chains...\n");

  // Get Alice's OID chain
  const oidChain = await nucleus.getChain(oidChainId);
  console.log(`🔗 OID Chain (${oidChainId}):`);
  console.log(`   Records: ${oidChain.length}`);
  console.log(`   Latest: ${oidChain[oidChain.length - 1]?.hash}\n`);

  // Get proof chain
  const proofChain = await nucleus.getChain(proofChainId);
  console.log(`🔗 Proof Chain (${proofChainId}):`);
  console.log(`   Records: ${proofChain.length}`);
  console.log(`   Latest: ${proofChain[proofChain.length - 1]?.hash}\n`);

  // Get by hash
  const retrievedProof = await nucleus.getByHash(kycProof.hash);
  console.log(`🔍 Retrieved by hash:`);
  console.log(`   Module: ${retrievedProof?.module}`);
  console.log(`   Index: ${retrievedProof?.index}\n`);

  // ============================================================
  // 6. Demonstrate Chain History
  // ============================================================
  console.log("📝 Updating Alice's OID record (key rotation example)...");

  const updatedAliceOidRecord: OidRecord = {
    ...aliceOidRecord,
    keys: [
      ...aliceOidRecord.keys,
      {
        id: "#backup",
        usage: ["sign"],
        alg: "ed25519",
        publicKey: "z6MknGc3ocHs3zdPiJbnaaqDi58NGb4pk1Sp9WxWufuXSdxf",
        createdAt: "2025-11-20T13:00:00.000Z",
      },
    ],
    updatedAt: "2025-11-20T13:00:00.000Z",
    proof: {
      type: "ed25519-jcs-2025",
      createdAt: "2025-11-20T13:00:00.000Z",
      keyRef: "#main",
      signature: "mock-signature-for-update",
    },
  };

  const updatedOidRecord = await nucleus.append({
    module: "oid",
    chainId: oidChainId,
    body: { oidRecord: updatedAliceOidRecord },
    context: { callerOid: aliceOid },
  });

  console.log(`✅ OID updated:`);
  console.log(`   Hash: ${updatedOidRecord.hash}`);
  console.log(`   Index: ${updatedOidRecord.index}`);
  console.log(`   Previous: ${updatedOidRecord.prevHash}\n`);

  // Show full chain
  const fullOidChain = await nucleus.getChain(oidChainId);
  console.log(`🔗 Full OID Chain History:`);
  fullOidChain.forEach((record, i) => {
    console.log(
      `   [${i}] ${record.hash.substring(0, 16)}... (${new Date(record.createdAt).toISOString()})`
    );
  });

  console.log("\n✨ Example complete!");

  storage.close();
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});

/**
 * Basic Usage Example
 *
 * This example demonstrates how to create and use a ledger
 * with the @onoal/nucleus package.
 */

import { createLedger, proofModule, assetModule } from "../src/index";

async function main() {
  // Create a ledger with WASM backend
  const ledger = await createLedger({
    id: "example-ledger",
    backend: {
      mode: "wasm",
    },
    modules: [proofModule(), assetModule({ name: "tickets" })],
  });

  console.log(`Created ledger: ${ledger.id}`);

  // Append a proof record
  const proofHash = await ledger.append({
    id: "proof-1",
    stream: "proofs",
    timestamp: Date.now(),
    payload: {
      type: "proof",
      subject_oid: "oid:onoal:human:alice",
      issuer_oid: "oid:onoal:org:example",
    },
  });

  console.log(`Proof record hash: ${proofHash}`);

  // Append an asset record
  const assetHash = await ledger.append({
    id: "asset-1",
    stream: "assets",
    timestamp: Date.now(),
    payload: {
      type: "ticket",
      owner_oid: "oid:onoal:human:alice",
    },
  });

  console.log(`Asset record hash: ${assetHash}`);

  // Query proofs
  const proofResults = await ledger.query({
    stream: "proofs",
    limit: 10,
  });

  console.log(`Found ${proofResults.total} proof records`);

  // Verify chain integrity
  await ledger.verify();
  console.log("Chain verification passed");

  // Get ledger stats
  const length = await ledger.length();
  const isEmpty = await ledger.isEmpty();
  const latestHash = await ledger.latestHash();

  console.log(`Ledger length: ${length}`);
  console.log(`Is empty: ${isEmpty}`);
  console.log(`Latest hash: ${latestHash}`);
}

// Run example
// Uncomment to run:
// main().catch(console.error);

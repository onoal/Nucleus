/**
 * Builder Pattern Example
 *
 * This example demonstrates how to use the LedgerBuilder
 * for a fluent API when creating ledgers.
 */

import { ledgerBuilder, proofModule, assetModule } from "../src/index";

async function main() {
  // Create a ledger using the builder pattern
  const ledger = await ledgerBuilder("example-ledger")
    .withWasmBackend()
    .withModule(proofModule())
    .withModule(assetModule({ name: "tickets" }))
    .withStrictValidation()
    .withMaxEntries(1000)
    .withMetrics()
    .build();

  console.log(`Created ledger: ${ledger.id}`);

  // Use the ledger
  const hash = await ledger.append({
    id: "record-1",
    stream: "proofs",
    timestamp: Date.now(),
    payload: {
      type: "proof",
      subject_oid: "oid:onoal:human:alice",
      issuer_oid: "oid:onoal:org:example",
    },
  });

  console.log(`Record hash: ${hash}`);
}

// Run example
// Uncomment to run:
// main().catch(console.error);

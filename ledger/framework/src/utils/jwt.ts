/**
 * JWT Generator for Ledger Framework
 *
 * Generates proof JWTs for ledger entries using Ed25519 signing.
 * Each ledger entry gets a proof JWT that can be verified independently.
 *
 * @module utils/jwt
 */

import { SignJWT, importPKCS8, importJWK } from "jose";
import { ed25519 } from "@noble/curves/ed25519.js";
import type { LedgerEntry } from "../core/types-internal.js";

/**
 * Generate proof JWT for ledger entry
 *
 * Creates a JWT that proves the entry exists in the ledger.
 * The JWT contains entry metadata and is signed with the ledger's private key.
 *
 * @param entry - Ledger entry
 * @param issuer - Ledger name (used as JWT issuer)
 * @param signingKey - Ed25519 private key (Uint8Array)
 * @returns Proof JWT string
 *
 * @example
 * ```typescript
 * const entry = await ledger.append({ ... });
 * const proofJwt = await generateProofJWT(
 *   entry,
 *   "my-ledger",
 *   privateKey
 * );
 *
 * // Verify later
 * const { payload } = await jwtVerify(proofJwt, publicKey);
 * console.log(payload.entry_id); // Entry ID
 * ```
 */
export async function generateProofJWT(
  entry: LedgerEntry,
  issuer: string,
  signingKey: Uint8Array
): Promise<string> {
  // JWT payload structure
  // Based on: onoal/ledger/src/lib/ledger-grant-token.ts patterns
  const payload = {
    // Standard JWT claims
    iss: issuer, // Ledger name
    sub: entry.id, // Entry ID
    aud: "ledger", // Audience
    iat: Math.floor(entry.timestamp / 1000), // Issued at (Unix timestamp)
    exp: Math.floor((entry.timestamp + 365 * 24 * 3600 * 1000) / 1000), // Expiration (1 year from entry timestamp)

    // Custom claims
    entry_id: entry.id,
    hash: entry.hash,
    prev_hash: entry.prev_hash || null,
    signature: entry.signature || null,
    stream: entry.stream,
    status: entry.status,
  };

  // Convert Uint8Array private key to CryptoKey for jose
  // Ed25519 private key is 32 bytes, we need to convert it to PKCS8 format
  // or use the JWK format
  const privateKeyJwk = {
    kty: "OKP",
    crv: "Ed25519",
    d: Buffer.from(signingKey).toString("base64url"),
    x: Buffer.from(ed25519.getPublicKey(signingKey)).toString("base64url"),
  };

  const cryptoKey = await importJWK(privateKeyJwk, "EdDSA");

  // Create and sign JWT with Ed25519
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({
      alg: "EdDSA",
      crv: "Ed25519",
    })
    .setIssuedAt(payload.iat)
    .setExpirationTime(payload.exp)
    .setIssuer(issuer)
    .setSubject(entry.id)
    .setAudience("ledger")
    .sign(cryptoKey);

  return jwt;
}

/**
 * Helper to convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Helper to convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

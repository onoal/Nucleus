/**
 * Signature utilities for mesh messages
 *
 * Provides functions for signing and verifying mesh network messages.
 *
 * @module utils/signature
 */

import type { LedgerSigner } from "@onoal/ledger-core/internal";
import { LedgerSigner as SignerClass } from "@onoal/ledger-core/internal";
import type { MeshMessage } from "../types.js";

/**
 * Sign a mesh message
 *
 * Creates a signature for a mesh message using the ledger's signer.
 *
 * @param message - Message to sign (without signature)
 * @param signer - Ledger signer instance
 * @returns Ed25519 signature in hex format
 *
 * @example
 * ```typescript
 * const signature = signMessage(message, signer);
 * message.signature = signature;
 * ```
 */
export function signMessage(
  message: Omit<MeshMessage, "signature">,
  signer: LedgerSigner
): string {
  // Create message payload for signing
  const payload = JSON.stringify({
    id: message.id,
    type: message.type,
    timestamp: message.timestamp,
    from: message.from,
    to: message.to,
    payload: message.payload,
  });

  // Sign with Ed25519
  return signer.sign(payload);
}

/**
 * Verify a mesh message signature
 *
 * Verifies that a mesh message was signed by the expected ledger.
 *
 * @param message - Message to verify
 * @param publicKey - Ed25519 public key in hex format
 * @returns True if signature is valid, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = verifyMessage(message, peerPublicKey);
 * if (!isValid) {
 *   throw new Error("Invalid message signature");
 * }
 * ```
 */
export function verifyMessage(
  message: MeshMessage,
  publicKey: string
): boolean {
  // Create message payload for verification
  const payload = JSON.stringify({
    id: message.id,
    type: message.type,
    timestamp: message.timestamp,
    from: message.from,
    to: message.to,
    payload: message.payload,
  });

  // Verify signature using LedgerSigner static method
  return SignerClass.verify(payload, message.signature, publicKey);
}

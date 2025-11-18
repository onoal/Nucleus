/**
 * Ledger signing operations using Ed25519
 *
 * @module core/signer
 */

import { ed25519 } from "@noble/curves/ed25519.js";
import { sha512 } from "@noble/hashes/sha512.js";
import { concatBytes } from "@noble/hashes/utils.js";
import {
  hexToBytes,
  bytesToHex,
  bytesToBase64Url,
} from "../lib/crypto-utils.js";

// Setup sha512 for ed25519
const ed25519Utils = ed25519.utils as typeof ed25519.utils & {
  sha512Sync?: (...messages: Uint8Array[]) => Uint8Array;
};
ed25519Utils.sha512Sync = (...messages: Uint8Array[]) =>
  sha512(concatBytes(...messages));

/**
 * JWK representation of a public key
 */
export interface JsonWebKey {
  kty: string;
  crv: string;
  x: string;
  kid?: string;
  use?: string;
  alg?: string;
}

/**
 * Ledger signer for cryptographic operations
 */
export class LedgerSigner {
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;
  private kid: string;

  /**
   * Create a new ledger signer
   *
   * @param privateKeyHex - Ed25519 private key in hex format (64 chars)
   * @param kid - Key identifier
   */
  constructor(privateKeyHex: string, kid: string) {
    this.privateKey = hexToBytes(privateKeyHex);
    this.publicKey = ed25519.getPublicKey(this.privateKey);
    this.kid = kid;
  }

  /**
   * Sign a message
   *
   * @param message - Message to sign
   * @returns Signature in hex format
   */
  sign(message: string): string {
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);
    const signature = ed25519.sign(messageBytes, this.privateKey);
    return bytesToHex(signature);
  }

  /**
   * Sign a proof entry in the hash chain
   *
   * @param hash - Current entry hash
   * @param prevHash - Previous entry hash (null for genesis)
   * @returns Signature in hex format
   */
  signProofEntry(hash: string, prevHash: string | null): string {
    const message = prevHash ? `${hash}:${prevHash}` : hash;
    return this.sign(message);
  }

  /**
   * Get public key as JWK
   *
   * @returns JWK representation
   */
  getJwk(): JsonWebKey {
    return {
      kty: "OKP",
      crv: "Ed25519",
      x: bytesToBase64Url(this.publicKey),
      kid: this.kid,
      use: "sig",
      alg: "EdDSA",
    };
  }

  /**
   * Get key ID
   */
  getKid(): string {
    return this.kid;
  }

  /**
   * Get public key as hex
   */
  getPublicKeyHex(): string {
    return bytesToHex(this.publicKey);
  }

  /**
   * Verify a signature
   *
   * @param message - Original message
   * @param signatureHex - Signature in hex format
   * @param publicKeyHex - Public key in hex format
   * @returns True if signature is valid
   */
  static verify(
    message: string,
    signatureHex: string,
    publicKeyHex: string
  ): boolean {
    try {
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(message);
      const signatureBytes = hexToBytes(signatureHex);
      const publicKeyBytes = hexToBytes(publicKeyHex);

      return ed25519.verify(signatureBytes, messageBytes, publicKeyBytes);
    } catch {
      return false;
    }
  }

  /**
   * Generate a new Ed25519 key pair
   *
   * @returns Private and public keys in hex format
   */
  static generateKeyPair(): {
    privateKey: string;
    publicKey: string;
  } {
    const privateKey = ed25519.utils.randomSecretKey();
    const publicKey = ed25519.getPublicKey(privateKey);

    return {
      privateKey: bytesToHex(privateKey),
      publicKey: bytesToHex(publicKey),
    };
  }
}


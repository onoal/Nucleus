/**
 * Encryption Plugin for Onoal Ledger
 *
 * Encrypts sensitive fields in payloads for data privacy.
 */

import type { OnoalLedgerPlugin } from "@onoal/ledger-core";

export interface EncryptionPluginOptions {
  /**
   * Encryption algorithm
   * - "AES-256-GCM": AES-256 in GCM mode (recommended)
   * - "AES-256-CBC": AES-256 in CBC mode
   */
  algorithm?: "AES-256-GCM" | "AES-256-CBC";

  /**
   * Key derivation algorithm
   * - "PBKDF2": Password-Based Key Derivation Function 2
   * - "scrypt": scrypt key derivation
   */
  keyDerivation?: "PBKDF2" | "scrypt";

  /**
   * Fields to encrypt in payload
   * These fields will be encrypted before storage and decrypted when retrieved
   */
  encryptFields?: string[];

  /**
   * Enable automatic key rotation
   */
  keyRotation?: boolean;

  /**
   * Encryption key
   * If not provided, will use LEDGER_ENCRYPTION_KEY environment variable
   */
  encryptionKey?: string | Uint8Array;

  /**
   * Key rotation interval (if keyRotation is true)
   * Format: "90d" (90 days), "1y" (1 year)
   */
  rotationInterval?: string;

  /**
   * Salt for key derivation (optional, auto-generated if not provided)
   */
  salt?: string | Uint8Array;
}

import { EncryptionService } from "./service.js";
import type { OnoalLedger, LedgerEntry } from "@onoal/ledger-core";

/**
 * Creates an encryption plugin for the ledger
 *
 * @example
 * ```typescript
 * const ledger = await createLedger({...});
 * ledger.use(encryptionPlugin({
 *   algorithm: "AES-256-GCM",
 *   encryptFields: ["ssn", "email", "phone"],
 *   encryptionKey: process.env.LEDGER_ENCRYPTION_KEY
 * }));
 * ```
 */
export function encryptionPlugin(
  options: EncryptionPluginOptions = {}
): OnoalLedgerPlugin {
  const encryptionKey =
    options.encryptionKey ||
    (process.env.LEDGER_ENCRYPTION_KEY as string | undefined);

  if (!encryptionKey) {
    throw new Error(
      "Encryption key is required. Provide encryptionKey option or set LEDGER_ENCRYPTION_KEY environment variable."
    );
  }

  const encryptionService = new EncryptionService(
    options.algorithm || "AES-256-GCM",
    encryptionKey,
    options.keyDerivation || "PBKDF2",
    options.salt
  );

  const fieldsToEncrypt = options.encryptFields || [];

  return {
    id: "encryption",
    version: "1.0.0",
    hooks: {
      beforeAppend: async (entry, ledger) => {
        // Encrypt specified fields in payload before storage
        if (fieldsToEncrypt.length > 0 && entry.payload) {
          entry.payload = encryptionService.encryptPayload(
            entry.payload as Record<string, unknown>,
            fieldsToEncrypt
          );
        }
      },

      afterGet: async (entry, id, ledger) => {
        // Decrypt fields when retrieving
        if (entry && fieldsToEncrypt.length > 0) {
          const decryptedPayload = encryptionService.decryptPayload(
            entry.payload as Record<string, unknown>,
            fieldsToEncrypt
          );
          return {
            ...entry,
            payload: decryptedPayload,
          };
        }
        return entry;
      },

      afterQuery: async (result, filters, ledger) => {
        // Decrypt fields in query results
        if (fieldsToEncrypt.length > 0) {
          result.entries = result.entries.map((entry) => {
            const decryptedPayload = encryptionService.decryptPayload(
              entry.payload as Record<string, unknown>,
              fieldsToEncrypt
            );
            return {
              ...entry,
              payload: decryptedPayload,
            };
          });
        }
        return result;
      },
    },
  };
}

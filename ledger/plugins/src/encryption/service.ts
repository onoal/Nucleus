/**
 * Encryption Service
 *
 * Handles field-level encryption and decryption of payload data.
 * Uses AES-256-GCM by default for authenticated encryption.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
  pbkdf2,
} from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const pbkdf2Async = promisify(pbkdf2);

export class EncryptionService {
  private key: Buffer;
  private algorithm: string;

  constructor(
    algorithm: "AES-256-GCM" | "AES-256-CBC" = "AES-256-GCM",
    encryptionKey: string | Uint8Array,
    keyDerivation: "PBKDF2" | "scrypt" = "PBKDF2",
    salt?: string | Uint8Array
  ) {
    this.algorithm =
      algorithm === "AES-256-GCM" ? "aes-256-gcm" : "aes-256-cbc";
    this.key = this.deriveKey(encryptionKey, keyDerivation, salt);
  }

  /**
   * Encrypt a field value
   */
  encryptField(value: string): string {
    if (!value || typeof value !== "string") {
      return value;
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(value, "utf8", "hex");
    encrypted += cipher.final("hex");

    // For GCM, get auth tag
    if (this.algorithm === "aes-256-gcm") {
      const authTag = (cipher as any).getAuthTag();
      // Format: iv:authTag:encrypted
      return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    } else {
      // For CBC, no auth tag
      return `${iv.toString("hex")}:${encrypted}`;
    }
  }

  /**
   * Decrypt a field value
   */
  decryptField(encryptedValue: string): string {
    if (!encryptedValue || typeof encryptedValue !== "string") {
      return encryptedValue;
    }

    // Check if value is encrypted (has format iv:authTag:encrypted or iv:encrypted)
    if (!this.isEncrypted(encryptedValue)) {
      return encryptedValue; // Not encrypted, return as-is
    }

    const parts = encryptedValue.split(":");
    if (parts.length < 2) {
      throw new Error("Invalid encrypted value format");
    }

    const iv = Buffer.from(parts[0]!, "hex");
    let authTag: Buffer | undefined;
    let encrypted: string;

    if (this.algorithm === "aes-256-gcm") {
      if (parts.length !== 3) {
        throw new Error("Invalid GCM encrypted value format");
      }
      authTag = Buffer.from(parts[1]!, "hex");
      encrypted = parts[2]!;
    } else {
      encrypted = parts[1]!;
    }

    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    if (authTag && this.algorithm === "aes-256-gcm") {
      (decipher as any).setAuthTag(authTag);
    }

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  /**
   * Encrypt specified fields in a payload
   */
  encryptPayload(
    payload: Record<string, unknown>,
    fieldsToEncrypt: string[]
  ): Record<string, unknown> {
    if (fieldsToEncrypt.length === 0) {
      return payload;
    }

    const encrypted = { ...payload };

    for (const field of fieldsToEncrypt) {
      if (field in encrypted && typeof encrypted[field] === "string") {
        encrypted[field] = this.encryptField(encrypted[field] as string);
      }
    }

    return encrypted;
  }

  /**
   * Decrypt specified fields in a payload
   */
  decryptPayload(
    payload: Record<string, unknown>,
    fieldsToEncrypt: string[]
  ): Record<string, unknown> {
    if (fieldsToEncrypt.length === 0) {
      return payload;
    }

    const decrypted = { ...payload };

    for (const field of fieldsToEncrypt) {
      if (field in decrypted && typeof decrypted[field] === "string") {
        const value = decrypted[field] as string;
        try {
          decrypted[field] = this.decryptField(value);
        } catch (error) {
          // If decryption fails, keep original value (might not be encrypted)
          console.warn(`Failed to decrypt field ${field}:`, error);
        }
      }
    }

    return decrypted;
  }

  /**
   * Check if a value appears to be encrypted
   */
  private isEncrypted(value: string): boolean {
    // Check format: iv:authTag:encrypted (GCM) or iv:encrypted (CBC)
    const parts = value.split(":");
    return parts.length >= 2 && parts[0]!.length === 32; // IV is 16 bytes = 32 hex chars
  }

  /**
   * Derive encryption key from password/key
   */
  private deriveKey(
    key: string | Uint8Array,
    keyDerivation: "PBKDF2" | "scrypt",
    salt?: string | Uint8Array
  ): Buffer {
    const keyBuffer =
      typeof key === "string" ? Buffer.from(key, "utf8") : Buffer.from(key);
    const saltBuffer = salt
      ? typeof salt === "string"
        ? Buffer.from(salt, "utf8")
        : Buffer.from(salt)
      : randomBytes(16);

    if (keyDerivation === "PBKDF2") {
      return pbkdf2Async(
        keyBuffer,
        saltBuffer,
        100000,
        32,
        "sha256"
      ) as Promise<Buffer> as any;
    } else {
      return scryptAsync(keyBuffer, saltBuffer, 32) as Promise<Buffer> as any;
    }
  }
}

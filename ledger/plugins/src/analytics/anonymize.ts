/**
 * Anonymization utilities for GDPR compliance
 */

import { createHash } from "crypto";

/**
 * Anonymize a value using SHA-256 hash with salt
 */
export function anonymize(value: string, salt?: string): string {
  const defaultSalt = process.env.ANALYTICS_SALT || "default-salt";
  const usedSalt = salt || defaultSalt;

  return createHash("sha256")
    .update(value + usedSalt)
    .digest("hex")
    .substring(0, 16); // Short hash for readability
}

/**
 * Anonymize filters (OIDs, etc.) for analytics
 */
export function anonymizeFilters(filters: any): any {
  const anonymized = { ...filters };

  if (anonymized.issuer_oid) {
    anonymized.issuer_oid = anonymize(anonymized.issuer_oid);
  }

  if (anonymized.subject_oid) {
    anonymized.subject_oid = anonymize(anonymized.subject_oid);
  }

  return anonymized;
}

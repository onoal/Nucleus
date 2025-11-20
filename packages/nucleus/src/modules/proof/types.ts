/**
 * Types for proof module
 * 
 * The proof module handles attestations/proofs about OID subjects,
 * issued by OID issuers.
 */

/**
 * Proof record body
 * 
 * An attestation about a subject (OID) by an issuer (OID)
 */
export interface ProofBody {
  /** OID of the subject (entity being attested about) */
  subject: string;

  /** OID of the issuer (entity making the attestation) */
  issuer: string;

  /** Type of proof (e.g., "kyc", "membership", "verification") */
  kind: string;

  /** Proof-specific data */
  data: Record<string, unknown>;

  /** ISO 8601 timestamp when proof was issued */
  issuedAt: string;

  /** Optional: ISO 8601 timestamp when proof expires */
  expiresAt?: string;

  /** Optional: Cryptographic proof from issuer */
  issuerProof?: IssuerProof;
}

/**
 * Cryptographic signature from issuer
 */
export interface IssuerProof {
  /** Signature algorithm (e.g., "ed25519-jcs-2025") */
  type: string;

  /** Reference to signing key in issuer's OID record (e.g., "#main") */
  keyRef: string;

  /** Base64url-encoded signature */
  signature: string;
}

/**
 * Recommended chainId pattern for proof records
 * 
 * Pattern: `nucleus:proof:{issuer}:{subject}:{kind}`
 * 
 * This creates one chain per unique (issuer, subject, kind) combination,
 * making it easy to audit all proofs of a specific type for a subject.
 * 
 * @param issuer Issuer OID
 * @param subject Subject OID
 * @param kind Proof kind
 * @returns Recommended chainId
 * 
 * @example
 * ```typescript
 * const chainId = generateProofChainId(
 *   'oid:onoal:org:verifier',
 *   'oid:onoal:user:alice',
 *   'kyc'
 * );
 * // => "nucleus:proof:oid:onoal:org:verifier:oid:onoal:user:alice:kyc"
 * ```
 */
export function generateProofChainId(issuer: string, subject: string, kind: string): string {
  return `nucleus:proof:${issuer}:${subject}:${kind}`;
}


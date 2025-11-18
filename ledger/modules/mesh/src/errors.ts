/**
 * Custom error types for mesh network
 *
 * Provides specific error types for better error handling.
 *
 * @module errors
 */

/**
 * Base mesh error class
 */
export class MeshError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "MeshError";
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (typeof (Error as any).captureStackTrace === "function") {
      (Error as any).captureStackTrace(this, MeshError);
    }
  }
}

/**
 * Peer not found error
 */
export class PeerNotFoundError extends MeshError {
  constructor(ledgerId: string) {
    super(`Peer not found: ${ledgerId}`, "PEER_NOT_FOUND", 404);
    this.name = "PeerNotFoundError";
  }
}

/**
 * Connection failed error
 */
export class ConnectionFailedError extends MeshError {
  constructor(endpoint: string, reason?: string) {
    super(
      `Failed to connect to ${endpoint}: ${reason || "Unknown error"}`,
      "CONNECTION_FAILED",
      503
    );
    this.name = "ConnectionFailedError";
  }
}

/**
 * Invalid message error
 */
export class InvalidMessageError extends MeshError {
  constructor(reason: string) {
    super(`Invalid message: ${reason}`, "INVALID_MESSAGE", 400);
    this.name = "InvalidMessageError";
  }
}

/**
 * Signature verification failed error
 */
export class SignatureVerificationError extends MeshError {
  constructor() {
    super(
      "Signature verification failed",
      "SIGNATURE_VERIFICATION_FAILED",
      401
    );
    this.name = "SignatureVerificationError";
  }
}

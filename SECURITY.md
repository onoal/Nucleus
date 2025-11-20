# Security Policy

## 🛡️ Supported Versions

Nucleus is currently in **BETA**. Security patches will be provided for the latest beta version only.

| Version    | Supported | Status               |
| ---------- | --------- | -------------------- |
| 0.1.x-beta | ✅ Yes    | Current beta release |
| < 0.1.0    | ❌ No     | Unsupported          |

---

## ⚠️ Beta Security Notice

**Nucleus v0.1.x is NOT production-ready.**

This is a beta release intended for:

- Testing and experimentation
- Developer feedback
- Architecture validation

**DO NOT use for:**

- Production systems
- Sensitive or personal data (PII)
- Financial transactions
- Compliance-regulated environments

---

## 🔒 Security Features

### ✅ Implemented (v0.1.x)

- **OID Signature Verification**: Full Ed25519-JCS-2025 cryptographic validation via `@onoal/oid-core`
- **Chain Integrity**: SHA-256 hashing with `prevHash` linkage (append-only)
- **Deterministic Hashing**: JCS canonicalization via Rust/WASM
- **Timestamp Validation**: ISO-8601 format with monotonic ordering
- **Type Safety**: Strict TypeScript with runtime validation

### ❌ Known Limitations

- **Proof Signature Verification**: NOT implemented (structural validation only)
- **Access Control**: NO authentication or authorization
- **Rate Limiting**: NO protection against spam/abuse
- **Audit Logging**: NO built-in security event tracking
- **Key Rotation**: NO mechanism for key compromise recovery

---

## 🚨 Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in Nucleus:

### 📧 Private Disclosure

**Email:** [security@onoal.org](mailto:security@onoal.org)

**DO NOT** open a public GitHub issue for security vulnerabilities.

### 📝 What to Include

1. **Description**: Clear explanation of the vulnerability
2. **Impact**: Who is affected and what can an attacker do?
3. **Reproduction**: Step-by-step instructions to reproduce
4. **Environment**: Version, platform, configuration
5. **Proof of Concept**: Code or commands demonstrating the issue
6. **Suggested Fix**: (Optional) How to mitigate or resolve

### ⏱️ Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Status Updates**: Every 14 days until resolution
- **Coordinated Disclosure**: 90 days from report (or earlier if resolved)

### 🏆 Recognition

We deeply appreciate security researchers. With your permission, we will:

- Credit you in release notes and CHANGELOG
- List you in our security acknowledgments (coming soon)
- (Future) Participate in a bug bounty program (v1.0+)

---

## 🔐 Cryptographic Primitives

Nucleus uses industry-standard cryptographic algorithms:

### Hashing

- **Algorithm**: SHA-256 (FIPS 180-4)
- **Implementation**: Rust `sha2` crate v0.10+ compiled to WASM
- **Usage**: Record hash computation over canonical JSON

### Signing (OID Records)

- **Algorithm**: Ed25519 (RFC 8032)
- **Implementation**: `@noble/curves` via `@onoal/oid-core`
- **Usage**: OID record signature verification

### Canonicalization

- **Standard**: JCS (JSON Canonicalization Scheme, RFC 8785)
- **Implementation**: Custom Rust implementation
- **Usage**: Deterministic JSON serialization before hashing

---

## 🛡️ Security Best Practices

### For Developers Using Nucleus

1. **Validate All Inputs**

   ```typescript
   // Always validate OIDs and chainIds
   if (!isValidOid(oid)) {
     throw new Error("Invalid OID format");
   }
   ```

2. **Isolate Environments**
   - Never share databases across trust boundaries
   - Use separate instances for different tenants/users

3. **External Rate Limiting**

   ```typescript
   // Implement your own rate limiting
   if (await isRateLimited(callerOid)) {
     throw new Error("Rate limit exceeded");
   }
   ```

4. **Monitor and Alert**
   - Log all append operations
   - Alert on suspicious patterns (rapid appends, invalid records)

5. **Plan for Migration**
   - Assume schema/API changes before v1.0
   - Implement data export/import mechanisms

### For ONOAL Core Developers

1. **Code Review**: All security-related changes require peer review
2. **Dependency Scanning**: Use `npm audit` and `cargo audit` regularly
3. **Fuzz Testing**: (Planned for v0.3+) Fuzzing critical paths
4. **Static Analysis**: ESLint security rules + Clippy in Rust

---

## 📋 Security Roadmap

### v0.2.0 (Next Release)

- ✅ Proof signature verification (cryptographic)
- ✅ Basic access control (caller authentication)
- ✅ Rate limiting middleware

### v0.3.0

- ✅ Comprehensive audit logging
- ✅ Key rotation support
- ✅ Fuzz testing for canonicalization and hashing

### v0.4.0

- ✅ Revocation support
- ✅ Compliance tools (GDPR, CCPA)
- ✅ Multi-signature support

### v1.0.0 (Stable Release)

- ✅ Third-party security audit
- ✅ Bug bounty program
- ✅ Production hardening guide

---

## 🔍 Security Audits

**v0.1.x**: No external security audit conducted (beta release)

**v1.0.0**: Planned third-party security audit before stable release

---

## 📚 Additional Resources

- **OID Core Security**: [onoal/oid-core](https://github.com/onoal/oid-core)
- **Design Decisions**: [DESIGN-DECISIONS.md](./DESIGN-DECISIONS.md)
- **Architecture**: [CONTEXT.md](./CONTEXT.md)
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/

---

## 📞 Contact

- **Security Issues**: [security@onoal.org](mailto:security@onoal.org) (private)
- **General Questions**: [GitHub Discussions](https://github.com/onoal/nucleus/discussions)
- **Bug Reports**: [GitHub Issues](https://github.com/onoal/nucleus/issues) (non-security only)

---

**Last Updated**: November 20, 2025  
**Policy Version**: 1.0.0

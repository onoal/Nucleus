# Contributing to Nucleus

Thank you for your interest in contributing to Nucleus! We welcome contributions from the community.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community](#community)

---

## 📜 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct (see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)).

**In short:**

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect differing viewpoints
- Report unacceptable behavior to [conduct@onoal.org](mailto:conduct@onoal.org)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18.0.0
- **pnpm** ≥ 8.0.0
- **Rust** (for WASM core development)
- **wasm-pack** (for building WASM modules)

### Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/nucleus.git
cd nucleus

# Add upstream remote
git remote add upstream https://github.com/onoal/nucleus.git
```

---

## 🛠️ Development Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Build WASM Core

```bash
cd packages/nucleus-core-rs
./build.sh
cd ../..
```

### 3. Build TypeScript

```bash
pnpm run build
```

### 4. Run Tests

```bash
pnpm test
```

### 5. Lint Code

```bash
pnpm run lint
```

---

## 🤝 How to Contribute

### Types of Contributions

We welcome:

- 🐛 **Bug fixes**
- ✨ **New features** (discuss in an issue first)
- 📝 **Documentation improvements**
- 🧪 **Test coverage**
- 🎨 **Code quality improvements**
- 💡 **Examples and tutorials**

### Before You Start

1. **Check existing issues** - Someone might already be working on it
2. **Open a discussion** - For large features, discuss the approach first
3. **Create an issue** - Describe the problem or feature clearly
4. **Get feedback** - Wait for maintainer input before starting work

---

## 🔄 Pull Request Process

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write clear, concise commit messages (see [Commit Guidelines](#commit-guidelines))
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass

### 3. Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `chore:` - Build process or tooling changes
- `ci:` - CI/CD changes

**Examples:**

```bash
feat(oid): add signature verification for OID records
fix(storage): resolve SQLite constraint violation on duplicate hash
docs(readme): update installation instructions
test(proof): add edge cases for expired proofs
```

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub with:

- **Clear title** (following commit conventions)
- **Description** of what changed and why
- **Related issues** (e.g., "Closes #123")
- **Screenshots/demos** (if applicable)
- **Breaking changes** (if any)

### 5. Code Review

- Address feedback promptly
- Keep discussions respectful
- Be open to suggestions
- Update your PR based on review comments

### 6. Merge

Once approved:

- Maintainers will merge your PR
- Your contribution will be credited in release notes

---

## 📏 Coding Standards

### TypeScript

- **Strict mode enabled** - No `any` without justification
- **ESLint** - Follow `.eslintrc.json` rules
- **Prettier** - Auto-format with `.prettierrc.json`
- **Naming conventions**:
  - `camelCase` for variables and functions
  - `PascalCase` for classes and interfaces
  - `UPPER_SNAKE_CASE` for constants

### Rust

- **Clippy** - Follow Rust best practices
- **rustfmt** - Format with default settings
- **Documentation** - Add doc comments for public APIs

### Documentation

- **JSDoc comments** for public APIs
- **Inline comments** for complex logic
- **README updates** for user-facing changes
- **CHANGELOG** entries for all releases

---

## 🧪 Testing

### Running Tests

```bash
# All tests
pnpm test

# Specific package
cd packages/nucleus
pnpm test

# Watch mode
pnpm test --watch

# Coverage
pnpm test --coverage
```

### Writing Tests

- **Unit tests** for individual functions
- **Integration tests** for end-to-end flows
- **Test file naming**: `*.test.ts` or `*.spec.ts`
- **Descriptive test names**: `it("should throw error when OID is invalid")`

### Test Coverage Goals

- **Core SDK**: > 90%
- **Modules**: > 85%
- **Storage**: > 80%
- **Utilities**: > 75%

---

## 📝 Documentation

### What Needs Documentation

- **Public APIs** - JSDoc comments
- **New features** - Update README.md
- **Breaking changes** - Update CHANGELOG.md and migration guides
- **Examples** - Add to `examples/` directory
- **Architecture changes** - Update CONTEXT.md

### Documentation Style

- **Clear and concise** - Avoid jargon
- **Code examples** - Show, don't just tell
- **TypeScript types** - Include in examples
- **Error handling** - Document possible errors

---

## 🌐 Community

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and general discussions
- **Discord** - Real-time chat (coming soon)
- **Twitter** - [@onoal_org](https://twitter.com/onoal_org) (announcements)

### Getting Help

- **Documentation** - Check README.md and CONTEXT.md first
- **Discussions** - Ask questions in GitHub Discussions
- **Issues** - Search existing issues before opening new ones

### Recognition

We value all contributions! Contributors are:

- Credited in release notes
- Listed in CONTRIBUTORS.md (coming soon)
- Eligible for special roles in our community

---

## 🔒 Security

**Do not open public issues for security vulnerabilities.**

See [SECURITY.md](./SECURITY.md) for our security policy and disclosure process.

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## 🙏 Thank You!

Every contribution, no matter how small, helps make Nucleus better. Thank you for being part of our community!

---

**Questions?** Open a [GitHub Discussion](https://github.com/onoal/nucleus/discussions) or email [hello@onoal.org](mailto:hello@onoal.org).

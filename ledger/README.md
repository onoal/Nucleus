# Ledger Framework

**Standalone framework for building custom Onoal ledgers**

This directory contains all packages related to the Ledger Framework - a modular, extensible framework for creating custom ledgers with hash-chain integrity.

## 📦 Packages

### Core

- **`ledger-core`** - Core framework with service container, module system, and ledger engine
- **`ledger-schema`** - Schema validation system

### Adapters

- **`ledger-database-postgres`** - PostgreSQL database adapter
- **`ledger-database-sqlite`** - SQLite database adapter
- **`ledger-database-cloudflare-d1`** - Cloudflare D1 database adapter

### Modules

- **`ledger-module-proof`** - Proof management module
- **`ledger-module-asset`** - Asset management module
- **`ledger-module-connect`** - Connect grant module
- **`ledger-module-token`** - Token module (fungible tokens with double-entry accounting)

### Client & Tools

- **`ledger-sdk`** - Type-safe client SDK for interacting with ledger APIs
- **`ledger-sdk-native`** - Native SDK implementation
- **`ledger-cli`** - CLI tool for scaffolding new ledger projects

### Plugins

- **`ledger-plugins`** - Plugins (webhook, ZK, analytics)

## 🚀 Quick Start

```bash
# Create a new ledger project
npx create-onoal-ledger

# Or install packages directly
pnpm add @onoal/ledger-core
pnpm add @onoal/ledger-module-proof
pnpm add @onoal/ledger-database-sqlite
```

## 📖 Documentation

- [Ledger Framework Analysis](../../docs/LEDGER_FRAMEWORK_ANALYSIS.md) - Complete status analysis
- [Ledger Framework Implementation Plan](../../docs/LEDGER_FRAMEWORK_IMPLEMENTATION_PLAN.md) - Implementation guide
- [Onoal Ledger SDK Analysis](../../docs/ONOAL_LEDGER_SDK_ANALYSIS.md) - SDK context

## 🏗️ Architecture

The Ledger Framework follows patterns from:

- **BetterAuth** - Plugin system, adapter pattern, factory functions
- **Medusa.js** - Module system, service container, dependency injection

### Key Concepts

- **Ledger**: Main instance that orchestrates modules, plugins, and adapters
- **Modules**: Provide services and routes (e.g., Proof, Asset, Connect)
- **Adapters**: Storage abstraction (SQLite, PostgreSQL, D1)
- **Plugins**: Extend functionality (webhooks, ZK proofs, analytics)
- **Services**: Business logic for managing ledger entries

## 📄 License

MIT

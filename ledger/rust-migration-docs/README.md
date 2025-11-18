# Rust Migration Documentation

Deze folder bevat alle documentatie die specifiek over de migratie van ledger context naar Rust gaat.

## Bestanden

- **CONTEXT_FILES_OVERVIEW.md** - Overzicht van alle context files die gemigreerd moeten worden naar Rust
- **context-README.md** - README van de context package die is geëxtraheerd voor Rust migratie

## Migratie Status

De context files zijn geëxtraheerd naar `ledger/context/` om de migratie naar Rust te faciliteren.

### Prioriteit

1. **RequestContext** (`auth.ts`) - Hoogste prioriteit
2. **LogContext** (`logger.ts`) - Hoge prioriteit
3. **Server Integration** (`server/index.ts`) - Medium prioriteit
4. **Type Definitions** (`types.ts`) - Low prioriteit


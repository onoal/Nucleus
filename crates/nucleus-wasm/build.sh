#!/bin/bash
set -e

echo "Building nucleus-wasm..."

# Clean previous build
rm -rf pkg
mkdir -p pkg

# Build WASM
echo "Compiling to WASM..."
cargo build --target wasm32-unknown-unknown --release

# Generate bindings
echo "Generating WASM bindings..."
wasm-bindgen \
  --target web \
  --out-dir pkg \
  --no-typescript \
  target/wasm32-unknown-unknown/release/nucleus_wasm.wasm

# Optimize WASM (optional, requires wasm-opt)
if command -v wasm-opt &> /dev/null; then
    echo "Optimizing WASM..."
    wasm-opt -Os pkg/nucleus_wasm_bg.wasm -o pkg/nucleus_wasm_bg.wasm
fi

echo "Build complete! Output in pkg/"
echo ""
echo "Usage:"
echo "  import init, { WasmLedger } from '@onoal/nucleus-wasm/pkg/nucleus_wasm.js';"


#!/bin/bash
set -e

echo "Building Rust WASM module..."

# Build with wasm-pack
wasm-pack build \
  --target bundler \
  --out-dir ../nucleus/src/wasm \
  --out-name nucleus_core_rs

echo "✅ WASM build complete!"
echo "Output: packages/nucleus/src/wasm/"


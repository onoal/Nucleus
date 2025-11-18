//! Nucleus WASM - WASM bindings for nucleus-engine
//!
//! This crate provides WASM bindings to use the Nucleus Engine
//! from JavaScript/TypeScript in browser or Node.js environments.

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use it as the global allocator
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// Initialize panic hook for better error messages
#[wasm_bindgen(start)]
pub fn init() {
    // Set up panic hook for better error messages in console
    console_error_panic_hook::set_once();
}

// Re-export modules
mod ledger;
mod record;
mod error;

pub use ledger::WasmLedger;
pub use record::WasmRecord;
pub use error::WasmError;


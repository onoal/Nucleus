use wasm_bindgen::prelude::*;

/// WASM error type
#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct WasmError {
    message: String,
}

#[wasm_bindgen]
impl WasmError {
    #[wasm_bindgen(constructor)]
    pub fn new(message: String) -> Self {
        Self { message }
    }

    #[wasm_bindgen(getter)]
    pub fn message(&self) -> String {
        self.message.clone()
    }
}

impl From<nucleus_engine::EngineError> for WasmError {
    fn from(err: nucleus_engine::EngineError) -> Self {
        Self {
            message: err.to_string(),
        }
    }
}

impl From<serde_json::Error> for WasmError {
    fn from(err: serde_json::Error) -> Self {
        Self {
            message: format!("Serialization error: {}", err),
        }
    }
}


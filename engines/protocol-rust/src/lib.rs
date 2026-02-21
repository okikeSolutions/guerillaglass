//! Shared Rust protocol types and helpers for Guerillaglass native engines.

/// Capture timing primitives.
pub mod clock;
/// Protocol request and response message types.
pub mod messages;

/// Re-exported capture clock primitives.
pub use clock::{CaptureClock, RunningDuration};
/// Re-exported protocol message helpers and constants.
pub use messages::{
    decode_request_line, encode_response_line, failure, success, EngineMethod, EngineRequest,
    EngineResponse, ProtocolErrorCode, PROTOCOL_VERSION,
};

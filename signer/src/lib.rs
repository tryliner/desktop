//! Liner Signer — Protected HMAC request and cover signing library for Liner.

pub mod crypto;
pub mod ffi;

pub use crypto::{
    deobfuscate_api_key, deobfuscate_cover_key, deobfuscate_monitor_key, sha256_hex,
    sign_api_base64url, sign_base64url, sign_cover_base64url, sign_monitor_base64url,
};
pub use ffi::*;

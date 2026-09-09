//! C-ABI FFI Exports for precompiled binary distribution.

use crate::crypto::{sha256_hex, sign_api_base64url, sign_cover_base64url};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::time::{SystemTime, UNIX_EPOCH};

/// Signs a cover URL token payload for `covers.tryliner.fun` (using COVER_TOKEN_SECRET).
/// Returns a newly allocated null-terminated C string. Caller must free with `liner_signer_free_string`.
#[no_mangle]
pub unsafe extern "C" fn liner_signer_sign_cover_url(payload: *const c_char) -> *mut c_char {
    if payload.is_null() {
        return std::ptr::null_mut();
    }
    let c_str = match CStr::from_ptr(payload).to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };
    match sign_cover_base64url(c_str.as_bytes()) {
        Ok(signature) => CString::new(signature)
            .map(|s| s.into_raw())
            .unwrap_or(std::ptr::null_mut()),
        Err(_) => std::ptr::null_mut(),
    }
}

/// Signs a canonical API request string (`METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY_SHA256`) using REQUEST_SIGNING_SECRET.
/// Returns the signature string. Populates `out_timestamp` and `out_nonce`.
/// Caller must free both strings using `liner_signer_free_string`.
#[no_mangle]
pub unsafe extern "C" fn liner_signer_sign_request(
    method: *const c_char,
    path: *const c_char,
    body: *const c_char,
    out_timestamp: *mut u64,
    out_nonce: *mut *mut c_char,
) -> *mut c_char {
    if method.is_null() || path.is_null() || out_timestamp.is_null() || out_nonce.is_null() {
        return std::ptr::null_mut();
    }

    let method_str = match CStr::from_ptr(method).to_str() {
        Ok(s) => s.trim().to_uppercase(),
        Err(_) => return std::ptr::null_mut(),
    };
    let path_str = match CStr::from_ptr(path).to_str() {
        Ok(s) => s.trim(),
        Err(_) => return std::ptr::null_mut(),
    };
    let body_hash = if !body.is_null() {
        match CStr::from_ptr(body).to_str() {
            Ok(b) if !b.is_empty() => sha256_hex(b.as_bytes()),
            _ => sha256_hex(b""),
        }
    } else {
        sha256_hex(b"")
    };

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let mut nonce_bytes = [0u8; 8];
    let _ = getrandom::getrandom(&mut nonce_bytes);
    let nonce = hex::encode(nonce_bytes);

    let canonical = format!("{method_str}\n{path_str}\n{timestamp}\n{nonce}\n{body_hash}");
    let signature = match sign_api_base64url(canonical.as_bytes()) {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    *out_timestamp = timestamp;
    *out_nonce = match CString::new(nonce) {
        Ok(n) => n.into_raw(),
        Err(_) => return std::ptr::null_mut(),
    };

    CString::new(signature)
        .map(|s| s.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

/// Signs a canonical Monitor Telemetry request string (`METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY_SHA256`) using MONITOR_SIGNING_SECRET.
/// Returns the signature string. Populates `out_timestamp` and `out_nonce`.
/// Caller must free both strings using `liner_signer_free_string`.
#[no_mangle]
pub unsafe extern "C" fn liner_signer_sign_monitor_request(
    method: *const c_char,
    path: *const c_char,
    body: *const c_char,
    out_timestamp: *mut u64,
    out_nonce: *mut *mut c_char,
) -> *mut c_char {
    if method.is_null() || path.is_null() || out_timestamp.is_null() || out_nonce.is_null() {
        return std::ptr::null_mut();
    }

    let method_str = match CStr::from_ptr(method).to_str() {
        Ok(s) => s.trim().to_uppercase(),
        Err(_) => return std::ptr::null_mut(),
    };
    let path_str = match CStr::from_ptr(path).to_str() {
        Ok(s) => s.trim(),
        Err(_) => return std::ptr::null_mut(),
    };
    let body_hash = if !body.is_null() {
        match CStr::from_ptr(body).to_str() {
            Ok(b) if !b.is_empty() => sha256_hex(b.as_bytes()),
            _ => sha256_hex(b""),
        }
    } else {
        sha256_hex(b"")
    };

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let mut nonce_bytes = [0u8; 8];
    let _ = getrandom::getrandom(&mut nonce_bytes);
    let nonce = hex::encode(nonce_bytes);

    let canonical = format!("{method_str}\n{path_str}\n{timestamp}\n{nonce}\n{body_hash}");
    let signature = match crate::crypto::sign_monitor_base64url(canonical.as_bytes()) {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    *out_timestamp = timestamp;
    *out_nonce = match CString::new(nonce) {
        Ok(n) => n.into_raw(),
        Err(_) => return std::ptr::null_mut(),
    };

    CString::new(signature)
        .map(|s| s.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

/// Signs arbitrary raw bytes using REQUEST_SIGNING_SECRET and returns base64url HMAC signature.
#[no_mangle]
pub unsafe extern "C" fn liner_signer_sign_raw_payload(
    payload: *const u8,
    payload_len: usize,
) -> *mut c_char {
    if payload.is_null() {
        return std::ptr::null_mut();
    }
    let slice = std::slice::from_raw_parts(payload, payload_len);
    match sign_api_base64url(slice) {
        Ok(signature) => CString::new(signature)
            .map(|s| s.into_raw())
            .unwrap_or(std::ptr::null_mut()),
        Err(_) => std::ptr::null_mut(),
    }
}

/// Frees a string allocated by any `liner_signer_*` FFI function.
#[no_mangle]
pub unsafe extern "C" fn liner_signer_free_string(s: *mut c_char) {
    if !s.is_null() {
        drop(CString::from_raw(s));
    }
}

# Security & Risk Review Checklist: 018 - 6-Digit OTP Password Reset Flow

**Purpose**: Review and verify security controls, rate limiting, and cryptographic defenses for OTP password recovery.  
**Created**: 2026-10-09  
**Feature**: [spec.md](../spec.md)  

---

## 1. Authentication & Cryptographic Defenses

- [x] Cryptographic randomness used for 6-digit OTP generation (`crypto.getRandomValues`)
- [x] Timing-safe string comparison (`crypto.timingSafeEqual`) used to prevent timing side-channel attacks
- [x] OTPs bounded to 10-minute validity window with automatic memory eviction
- [x] Single-use OTP invalidation: OTP permanently cleared immediately upon successful verification
- [x] Zero plaintext password retention in memory or unhashed session storage

---

## 2. Abuse Prevention & Rate Limiting

- [x] IP-level rate limiting enforced (maximum 5 requests per 60 seconds)
- [x] Identifier-level rate limiting enforced (maximum 3 requests per 60 seconds per canonical email)
- [x] 60-second cooldown period enforced between OTP resend dispatches
- [x] Progressive lockout enforced: maximum 5 incorrect OTP submissions before 15-minute freeze
- [x] Uniform API responses across existing and non-existing accounts to prevent user enumeration

---

## 3. Session & Credential Invalidation

- [x] Pre-existing sessions invalidated upon password reset via `passwordUpdatedAt` timestamp
- [x] `validateSessionActive` rejects tokens where `iat < passwordUpdatedAt`
- [x] Legacy URL tokens and magic recovery links eliminated from server and client
- [x] Direct visits to `/reset-password` cleanly route to `/forgot-password` without exposing token states

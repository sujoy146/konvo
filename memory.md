# Project Memory

Living context for this project. Read this first at the start of every session; update it at the end. Keep it short and factual.

## Project
Real-time one-to-one chat app with browser-side end-to-end encryption. Next.js (App Router) + TypeScript + Tailwind · Appwrite Cloud Free · Web Crypto. Runs locally; no hosting/deployment in scope.
Docs: `prd.md`, `system-architecture.md`, `rules.md`, `design.md`, `tasks.md`.

## Confirmed Decisions
| # | Decision | Notes |
|---|---|---|
| D1 | Appwrite **Cloud** (free plan) | Not self-hosted. |
| D2 | Users list via a **`profiles` collection**, created on first entry to `/chat` | Client SDK cannot list Auth users; no server API key allowed. Profile now includes `publicKey`. |
| D3 | Scope = core + **both bonus features** | Unread counts; send status + failure handling. |
| D4 | **Next.js App Router** | |
| D5 | Conversation ID = sorted `userA_userB`; **no `conversations` collection** | `getConversationId()` |
| D6 | Signup = name + email + password, **with email verification** if available on free plan, else without | Controlled by `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION`. Availability to be confirmed in T0.2. |
| D7 | Unread counts in **browser localStorage** (per-device) | Keys namespaced per user. Uses metadata only, no decryption. |
| D8 | **Document-level permissions**: only sender and recipient can read a message | Also applies to Realtime events. Defense in depth on top of D12. |
| D9 | Failed sends: **auto-retry ×3** (1s/2s/4s), then a Retry button | Client-generated message ID and a single ciphertext make retries idempotent. |
| D10 | No API keys anywhere; only public IDs as `NEXT_PUBLIC_*` | Now 7 variables (adds keys collection ID). |
| D11 | Client-side route guard (no middleware) | Web SDK session lives in the browser. |
| D12 | **End-to-end encryption** with Web Crypto: ECDH P-256 key pair per user, HKDF → AES-GCM 256 per conversation, fresh IV per message, AAD binds message/conversation/sender | Only `ciphertext` is stored. Sender, recipient, name, timestamps stay readable. |
| D13 | Private key wrapped (AES-GCM) with a PBKDF2-SHA-256 key from the password (≥600k iterations); stored in a separate owner-only **`keys` collection** | Not in `profiles` (readable by all users, would allow offline guessing). Works on any browser. |
| D14 | Unwrapped private key cached in **IndexedDB as a non-extractable CryptoKey**; deleted on logout | Reload needs no password. Stale/missing → Unlock screen. |
| D15 | Password reset = old messages unrecoverable (accepted). Key replacement only after explicit confirmation | `KeyResetScreen`; old messages show "Can't decrypt" placeholder. |
| D16 | Minimum password length **10** | Password protects the encryption key. |
| D17 | **Removed from scope:** Vercel hosting, GitHub publishing, deployment, Deliverables checklist, Appwrite platform for a deployed domain | Only `localhost` platform is needed. |

## Appwrite Resource IDs (fill in during Phase 1; these are not secrets)
- Endpoint: _(with region, from console)_
- Project ID:
- Database ID:
- `profiles` collection ID:
- `keys` collection ID:
- `messages` collection ID:

## Verified Facts (fill in during Phase 0)
- Installed `appwrite` SDK version:
- Session creation method name:
- Realtime channel string for message creates:
- Verification email works on free plan? (yes/no):
- Web Crypto (ECDH P-256, HKDF, AES-GCM, PBKDF2) works on localhost? (yes/no):
- Non-extractable CryptoKey round-trips through IndexedDB? (yes/no):
- PBKDF2 600k iterations timing on this machine:

## Data Model (short form)
- `profiles`: `userId`(unique), `name`, `email`, `publicKey`; doc ID = user `$id`.
- `keys`: `publicKey`, `salt`, `iv`, `wrappedPrivateKey`, `iterations`; doc ID = user `$id`; read/update = owner only.
- `messages`: `conversationId`, `senderId`, `senderName`, `recipientId`, `ciphertext` (`v1.<iv>.<ct>`); time = `$createdAt`; doc read permission = sender + recipient only.

## Local Storage Keys
- localStorage `chat:unread:<myId>` → `{ [otherUserId]: number }`
- localStorage `chat:lastRead:<myId>` → `{ [otherUserId]: ISO date }`
- IndexedDB `chat-keys` / `keys` / `<myId>` → `{ privateKey: CryptoKey (non-extractable), publicKey }`

## Known Limitations (accepted)
- Sender identity is client-supplied and both participants share a key (confidentiality, not authorship). Would need an Appwrite Function to enforce.
- No key verification: the project owner could swap a public key (active MITM). Protects stored data, not an active attacker controlling the project.
- Password reset loses message history. Weak password weakens the wrapped key; Appwrite Auth also receives the password at login.
- Metadata visible to Appwrite; no forward secrecy.
- Client-side route guard only.
- Unread counts are per-device; initial computation looks at the latest 100 received messages.
- Free-plan quotas apply.

## Status
- **Current phase:** Not started (docs revised for E2EE, deployment removed).
- **Last completed task:** —
- **Next task:** T0.1
- **Blockers:** none

## Session Log
| Date | What was done | Next |
|---|---|---|
| 2026-09-28 | Requirements clarified; wrote all six planning docs. | Phase 0 checks, then Phase 1 Appwrite setup. |
| 2026-09-28 | Revised docs: added end-to-end encryption (keys collection, crypto/keystore modules, unlock and key-reset screens, new Phase 4); removed Vercel/GitHub/deliverables/deployment tasks. | Phase 0 checks (incl. new T0.3), then Phase 1. |

## Conventions Cheat Sheet
- One Appwrite client in `src/lib/appwrite.ts`; env via `src/lib/config.ts`.
- All crypto in `src/lib/crypto.ts`; IndexedDB in `src/lib/keystore.ts`. Never touch `crypto.subtle` elsewhere.
- Fresh IV per message; encrypt once, retries reuse the ciphertext.
- Never log or persist plaintext, keys or passwords.
- Always unsubscribe Realtime in effect cleanup.
- Render message text as plain text only.
- Run `npm run lint && npm run build` before every commit; check no secrets in the diff.

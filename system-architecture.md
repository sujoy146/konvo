# System Architecture

## 1. Overview
A browser-only client (Next.js App Router, all interactive pages are Client Components) talks directly to Appwrite Cloud using the public Appwrite Web SDK. There is **no custom backend and no server-side secret**. Message text is encrypted and decrypted in the browser with the Web Crypto API; Appwrite only stores and relays ciphertext. The app runs locally with `npm run dev`.

```
┌──────────────────────────────────┐      HTTPS (REST)       ┌────────────────────────────┐
│  Browser (Next.js client)        │ ──────────────────────▶ │       Appwrite Cloud       │
│  React + Tailwind                │                         │  Auth   (accounts/sessions)│
│  Appwrite Web SDK                │ ◀────────────────────── │  Databases (profiles,      │
│  Web Crypto (encrypt/decrypt)    │    WebSocket (Realtime) │     keys, messages)        │
│  IndexedDB (non-extractable key) │                         │  Realtime                  │
└──────────────────────────────────┘                         └────────────────────────────┘
        plaintext exists only here                              sees ciphertext + metadata
```

## 2. Technology Choices
| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript strict | Required; App Router is the current default. |
| Styling | Tailwind CSS | Required; fast responsive layout. |
| Backend | Appwrite Cloud Free | Required: Auth, DB, Realtime. |
| SDK | `appwrite` (Web SDK) | Client-side auth, DB, Realtime. Pin the version in `package.json`. |
| Encryption | Web Crypto API (`crypto.subtle`) | Built in, audited, no dependency. ECDH P-256, HKDF, AES-GCM, PBKDF2. |
| Key cache | IndexedDB | Can store non-extractable `CryptoKey` objects (localStorage cannot). |
| State | React Context + hooks | App is small; no Redux/Zustand needed. |

> Appwrite's newer docs/console may say *Tables/Rows* instead of *Collections/Documents* (TablesDB). This project uses the Databases API terms (collections/documents/attributes). Before coding, confirm the installed SDK version's Databases and Realtime channel names against the Appwrite docs (see `tasks.md` T0).

## 3. Folder Structure
```
src/
  app/
    layout.tsx              # root layout, <AuthProvider><EncryptionProvider>
    page.tsx                # redirects to /chat or /login
    login/page.tsx
    signup/page.tsx
    verify/page.tsx         # completes email verification from the emailed link
    chat/page.tsx           # protected chat screen
  components/
    auth/AuthForm.tsx
    auth/UnlockScreen.tsx   # "Unlock messages" (password re-entry)
    auth/KeyResetScreen.tsx # "Encryption keys need to be reset"
    chat/UserList.tsx
    chat/UserListItem.tsx   # name, selected state, unread badge
    chat/ChatWindow.tsx     # header (lock indicator) + MessageList + MessageInput
    chat/MessageList.tsx    # scroll handling
    chat/MessageBubble.tsx  # sender name, time, status, decrypt-failed variant
    chat/MessageInput.tsx
    ui/ (Button, Input, Avatar, Spinner)
  context/
    AuthContext.tsx
    EncryptionContext.tsx   # key state: checking | locked | needs-reset | ready
  hooks/
    useProfiles.ts
    useMessages.ts          # history, realtime, encrypt/decrypt, send + retry
    useUnread.ts            # localStorage-backed counts
  lib/
    appwrite.ts             # Client, Account, Databases singletons
    config.ts               # typed env access, fails loudly if missing
    conversation.ts         # getConversationId()
    crypto.ts               # ALL Web Crypto code (pure functions, no React)
    keystore.ts             # IndexedDB cache of the non-extractable private key
    storage.ts              # safe localStorage helpers
  types/index.ts
.env.example
README.md
```

## 4. Configuration (environment variables)
All are **public identifiers**, not secrets. They are bundled into client JS by design.

```
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://<region>.cloud.appwrite.io/v1   # copy exact value from console
NEXT_PUBLIC_APPWRITE_PROJECT_ID=
NEXT_PUBLIC_APPWRITE_DATABASE_ID=
NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID=
NEXT_PUBLIC_APPWRITE_KEYS_COLLECTION_ID=
NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID=
NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true
```
Never used or committed: any Appwrite **API key**. `.env.local` is git-ignored; `.env.example` is committed.

## 5. Data Model

### 5.1 `profiles` collection
| Attribute | Type | Notes |
|---|---|---|
| `userId` | string(36), required | Auth user `$id`. Unique index. |
| `name` | string(128), required | Display name. |
| `email` | string(255), required | |
| `publicKey` | string(200), required | Base64 of the raw ECDH P-256 public key (65 bytes). |

- Document ID = the user's `$id` (`ID.custom(user.$id)`), so lookup is direct and duplicates are impossible.
- Index: `idx_userId` (unique).
- Permissions: collection-level **Create: users**, **Read: users**; **Document security: ON**. On create, set document permissions Update/Delete = that user (Update is needed to publish a new public key after a key reset).

### 5.2 `keys` collection (private-key vault)
| Attribute | Type | Notes |
|---|---|---|
| `publicKey` | string(200), required | Same value as in `profiles`; lets the client detect stale local keys. |
| `salt` | string(64), required | Base64, 16 random bytes, for PBKDF2. |
| `iv` | string(64), required | Base64, 12 random bytes, for AES-GCM. |
| `wrappedPrivateKey` | string(1000), required | Base64 of AES-GCM(PKCS#8 private key). |
| `iterations` | integer, required | PBKDF2 iteration count used (so it can be raised later). |

- Document ID = the user's `$id`.
- Permissions: collection-level **Create: users** only (no collection-level Read/Update); **Document security: ON**. Each document is created with **Read: user(me), Update: user(me)** and no delete. Nobody except the owner can read a wrapped key through the API.
- Why a separate collection instead of the profile: `profiles` must be readable by all users (to list them and fetch public keys). Putting the wrapped private key there would let any user download everyone's wrapped keys and guess passwords offline.

### 5.3 `messages` collection
| Attribute | Type | Notes |
|---|---|---|
| `conversationId` | string(100), required | Deterministic, see 5.4. |
| `senderId` | string(36), required | |
| `senderName` | string(128), required | Denormalized for display. |
| `recipientId` | string(36), required | |
| `ciphertext` | string(10000), required | `v1.<iv base64>.<ciphertext base64>`. Max 2000 plaintext characters fit comfortably. |

- Timestamp = built-in `$createdAt` (server-assigned, used for ordering and display).
- Indexes: `idx_conversation` (key on `conversationId`), `idx_recipient` (key on `recipientId`, used for unread computation).
- Permissions: collection-level **Create: users** only (no collection-level Read); **Document security: ON**. Each new message is created with document permissions **Read: user(senderId), user(recipientId)**. No update/delete permissions.
- Result: Appwrite enforces that only the two participants can read a message (queries **and** Realtime events), and even they receive only ciphertext from the server.

### 5.4 Conversation ID
```ts
export const getConversationId = (a: string, b: string) => [a, b].sort().join("_");
```
Same result regardless of who opens the chat. Two Appwrite IDs (≤36 chars each) + `_` fits in 100 chars. No `conversations` collection.

## 6. Cryptography

### 6.1 Primitives and parameters (all in `src/lib/crypto.ts`)
| Purpose | Primitive | Parameters |
|---|---|---|
| Identity key pair | ECDH | P-256; generated once per user (extractable only long enough to wrap it) |
| Password → wrapping key | PBKDF2 | SHA-256, ≥600,000 iterations, 16-byte random salt, output AES-GCM 256, non-extractable |
| Wrapping the private key | AES-GCM | 12-byte random IV, AAD = `userId`, plaintext = PKCS#8 export |
| Shared secret | ECDH `deriveBits` (256) → HKDF-SHA-256 | salt = empty, info = `"chat-e2ee-v1:" + conversationId`, output AES-GCM 256, non-extractable |
| Message encryption | AES-GCM | 12-byte random IV per message (never reused), AAD = `${messageId}\|${conversationId}\|${senderId}` |
| Encoding | base64 | Stored payload: `v1.<iv>.<ciphertext+tag>` |

Public API of `crypto.ts` (no React, no Appwrite imports):
```ts
generateIdentity(): Promise<{ publicKey: string; privateKeyPkcs8: Uint8Array }>
wrapPrivateKey(pkcs8: Uint8Array, password: string, userId: string): Promise<VaultFields>
unwrapPrivateKey(vault: VaultFields, password: string, userId: string): Promise<CryptoKey> // non-extractable
deriveConversationKey(myPrivate: CryptoKey, theirPublic: string, conversationId: string): Promise<CryptoKey>
encryptMessage(key: CryptoKey, plaintext: string, aad: string): Promise<string>
decryptMessage(key: CryptoKey, payload: string, aad: string): Promise<string> // throws on tamper/wrong key
```
`unwrapPrivateKey` imports the PKCS#8 bytes with `extractable: false` and overwrites the byte buffer afterwards (best effort). The private key can therefore be used for `deriveBits` but never read out by JavaScript.

### 6.2 Local key cache (`keystore.ts`)
- IndexedDB database `chat-keys`, object store `keys`, record key `<myId>`, value `{ privateKey: CryptoKey, publicKey: string }` (structured clone stores the non-extractable key as-is).
- `saveKey`, `loadKey`, `deleteKey`. Wrapped in try/catch; failure means "locked" state, never a crash.
- Deleted on logout. Compared against the `publicKey` in the user's profile: a mismatch means the keys were reset on another device, so the local record is treated as stale (state `locked`).

### 6.3 Key states (`EncryptionContext`)
| State | Meaning | UI |
|---|---|---|
| `checking` | Looking for a valid local key | Spinner |
| `locked` | Session exists but no valid local key | `UnlockScreen` (password) |
| `needs-reset` | Password verified by Appwrite but the vault cannot be unwrapped | `KeyResetScreen` |
| `ready` | Private key available | Chat |

Context exposes `{ status, setupKeys(password), unlock(password), resetKeys(password), getConversationKey(otherProfile), encrypt, decrypt }`.

### 6.4 Key lifecycle flows
- **Setup (signup, or login when no vault exists):** `generateIdentity` → `wrapPrivateKey(password)` → `createDocument(keys, userId, {publicKey, salt, iv, wrappedPrivateKey, iterations}, [read(me), update(me)])` → `keystore.saveKey`.
- **Unlock (login, or `locked` screen):** `getDocument(keys, userId)` → `unwrapPrivateKey(vault, password)` → `keystore.saveKey`.
  - Failure right after a successful Appwrite login → state `needs-reset` (the password was verified, so the vault is stale, most likely because the password was reset).
  - Failure on the `locked` screen → "Couldn't unlock, check your password" (the password has not been verified by Appwrite in that flow; the user can also log out and log in again).
- **Reset (explicit confirmation + password re-entry):** `generateIdentity` → wrap → `updateDocument(keys, userId, …)` → save locally → profile `publicKey` updated during bootstrap (6.6). Old messages become undecryptable.
- **Logout:** `deleteSession`, `keystore.deleteKey`, clear the in-memory conversation-key cache.

## 7. Key Flows

### 7.1 Auth and session
- `AuthContext` holds `{ user, loading, signup, login, logout, refresh }`; `EncryptionContext` holds the key state above.
- On mount: `account.get()` → user or null. Loading state prevents redirect flicker.
- **Signup:** `account.create(ID.unique(), email, password, name)` → `account.createEmailPasswordSession` → **`setupKeys(password)`** → if verification required, `account.createVerification(`${origin}/verify`)`.
- **Verify page:** reads `userId` and `secret` from the query string, calls `account.updateVerification(userId, secret)`, then redirects to `/chat`.
- **Login:** `createEmailPasswordSession` → **`unlock(password)`** (or `setupKeys` if no vault exists). **Logout:** see 6.4.
- **Guard:** `/chat` renders nothing until `loading` is false; redirects to `/login` if no user; shows the verify-email screen if verification is required and `user.emailVerification` is false; then renders by key state (spinner / `UnlockScreen` / `KeyResetScreen` / chat).
- Verify the exact method names (`createEmailPasswordSession` vs older `createEmailSession`) against the installed SDK.

### 7.2 Profile bootstrap
On entering `/chat` (after the auth guard passes and keys are `ready`): `getDocument(profiles, user.$id)`.
- 404 → `createDocument` with name, email and `publicKey` (from the local key record).
- Exists but `publicKey` differs from the local key record → `updateDocument` with the new public key (after a key reset). If the profile's key is *newer* than the local record (reset on another device) the state is `locked` instead (see 6.2).

### 7.3 Loading users
`listDocuments(profiles, [Query.notEqual("userId", me), Query.orderAsc("name"), Query.limit(100)])`. Optional: subscribe to the profiles channel so new users appear live and updated public keys are picked up.

### 7.4 Opening a conversation
1. `conversationId = getConversationId(me, other)`.
2. Refetch the other user's profile (`getDocument`) to get the current `publicKey`; derive the conversation key with `deriveConversationKey` and cache it in a `Map` keyed by `conversationId + publicKey`. Missing key → input disabled (E11).
3. `listDocuments(messages, [Query.equal("conversationId", id), Query.orderDesc("$createdAt"), Query.limit(50)])`, reversed for display. Decrypt each message with AAD `${$id}|${conversationId}|${senderId}`; a failure yields `{ text: null, decryptError: true }` for that message only. "Load earlier" uses `Query.cursorAfter(lastId)`.
4. Mark as read: set `lastRead` in localStorage and clear the unread count for that conversation.
5. Guard against races: ignore results whose `conversationId` no longer matches the currently selected one.

### 7.5 Realtime
- One subscription for the whole chat screen (not one per conversation), opened when `/chat` mounts and closed on unmount:
  `client.subscribe("databases.<db>.collections.<messages>.documents", cb)`.
- Handle only `…documents.*.create` events. Because of document permissions, the user only receives events for messages they can read.
- On event, payload `p`:
  - If `p.$id` already exists in state → replace status/timestamps only; keep the locally held plaintext (this is the optimistic message being confirmed; no re-decryption).
  - Else if `p.conversationId === activeConversationId` → decrypt, append, auto-scroll, update `lastRead`.
  - Else if `p.recipientId === me` → increment unread for `p.senderId`'s conversation (no decryption).
- On socket drop, the SDK reconnects; after reconnect, refetch the active conversation to fill any gap.

### 7.6 Sending with feedback and retry
1. Validate `text.trim().length > 0` and ≤ 2000.
2. Generate `id = ID.unique()` **on the client**. Encrypt **once**: `ciphertext = encryptMessage(convKey, trimmed, `${id}|${conversationId}|${me}`)`. Add an optimistic message `{ $id: id, text: trimmed (memory only), status: "sending", $createdAt: now }`; keep `ciphertext` in the pending record.
3. `createDocument(messages, id, { conversationId, senderId, senderName, recipientId, ciphertext }, [Permission.read(Role.user(me)), Permission.read(Role.user(other))])`.
4. On success → status `sent`. On failure → retry up to 3 times (1s, 2s, 4s backoff), reusing the same `id` **and the same ciphertext**. A `409 document already exists` response means an earlier attempt actually succeeded → treat as success. This is why retries cannot duplicate messages.
5. After the final failure → status `failed`; UI shows "Failed to send · Retry". Retry re-runs step 3 with the same `id` and ciphertext.
6. Do not retry on 401/403/validation (4xx other than 409/429): fail immediately.

### 7.7 Unread counts (localStorage)
- Keys are namespaced by user so accounts sharing a browser don't collide:
  - `chat:unread:<myId>` → `{ [otherUserId]: number }`
  - `chat:lastRead:<myId>` → `{ [otherUserId]: ISOString }`
- Live: increment on realtime events for non-open conversations (7.5).
- On page load: `listDocuments(messages, [Query.equal("recipientId", me), Query.orderDesc("$createdAt"), Query.limit(100)])`, count those newer than each sender's `lastRead` that are not in the active conversation. This covers messages that arrived while the tab was closed (bounded by the 100 most recent — acceptable). Counting needs metadata only, never decryption.
- Wrap all storage access in try/catch (private mode, SSR).

## 8. Security Model
| Threat | Mitigation |
|---|---|
| Secret leakage | No API keys used at all; only public IDs in `NEXT_PUBLIC_*`; `.env.local` git-ignored. |
| Project owner / console / DB export reading messages | Message text is AES-GCM ciphertext; keys never leave the browsers. |
| Reading others' messages via the API | Document-level read permissions limited to sender and recipient, enforced by Appwrite for REST and Realtime. |
| Other users downloading wrapped private keys | `keys` documents are readable only by their owner; kept out of `profiles`. |
| Offline password guessing against a stolen wrapped key | PBKDF2-SHA-256 with ≥600k iterations, random salt, 10-character minimum password. |
| Moving/replaying ciphertext between messages or conversations | AAD binds message id, conversation ID and sender ID. |
| IV reuse | Fresh `crypto.getRandomValues` 96-bit IV for every message. |
| Unauthenticated access | Collections require `users` role; no `any`/guest access. |
| Cross-origin abuse | Appwrite only accepts requests from registered Web platform hostnames (`localhost`). |
| XSS | Render message text as plain text via React (never `dangerouslySetInnerHTML`); private key is non-extractable. |
| Sender spoofing | **Accepted limitation** (client sets `senderId`; both participants share a key). Fix later with an Appwrite Function. |
| Public-key substitution by the project owner (active MITM) | **Accepted limitation**; would need safety-number verification. |
| Password reset | **Accepted limitation**; history is unrecoverable (see E7). |

## 9. Local Setup
1. Appwrite Cloud: create project, add a Web platform for `localhost`, enable Email/Password auth, create database + `profiles`, `keys`, `messages` collections with attributes, indexes and permissions (exact tables above; also written into the README).
2. Copy `.env.example` to `.env.local` and fill in the seven public values.
3. `npm install`, `npm run dev`, open `http://localhost:3000` (Web Crypto needs `localhost` or HTTPS).
4. Test with two browser profiles (or one normal + one incognito window).

## 10. Error Handling Matrix
| Situation | Behavior |
|---|---|
| Missing env var | Throw a clear startup error listing the variable. |
| Session expired | Redirect to `/login`. |
| Failed history load | Inline error with Retry button. |
| Realtime disconnect | Small "Reconnecting…" indicator; refetch on reconnect. |
| Send failure | See 7.6. |
| Verification link invalid/expired | Message plus "Resend verification email". |
| Web Crypto or IndexedDB unavailable | Blocking message explaining that a secure context / modern browser is required; no plaintext fallback, ever. |
| Wrong password on Unlock screen | Inline error; stays on the screen. |
| Vault cannot be unwrapped after login | `KeyResetScreen` with explicit confirmation. |
| Single message fails to decrypt | Placeholder bubble "Can't decrypt this message"; rest of the list unaffected. |
| Other user has no public key | Input disabled with explanatory text. |

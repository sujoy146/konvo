# PRD — Real-Time Chat App (End-to-End Encrypted)

## 1. Summary
A real-time one-to-one chat web app. Users sign up with email and password, see a list of other registered users, pick one, and exchange messages that appear instantly for both sides. Message text is **end-to-end encrypted in the browser**: Appwrite only ever stores and relays ciphertext.

**Stack (fixed):** Next.js (App Router) + TypeScript + Tailwind CSS · Appwrite Cloud (Free plan): Auth, Database, Realtime · Browser Web Crypto API for encryption. The app runs locally (`npm run dev`); hosting and deployment are out of scope.

## 2. Goals
- Working, demonstrably real-time chat between two logged-in users.
- Message contents are stored only as ciphertext: the project owner, anyone with Appwrite console access, or anyone holding a database export sees gibberish.
- Clean, responsive UI (mobile + desktop).
- No secret keys anywhere in the frontend or repo.
- Reproducible setup: a stranger can follow the README and get it running locally.

## 3. Non-Goals
- Group chats, media/file messages, message edit/delete, reactions.
- Push notifications, typing indicators, online/presence status.
- Server-side message validation (see Known Limitations).
- Phone/OAuth login.
- Deployment, hosting, CI/CD, GitHub publishing.
- Recovering messages after a password reset (by design, see E7).
- Key verification (safety numbers/QR), forward secrecy, key rotation, multi-recipient keys.
- Password change / password reset UI (if added later, it must re-wrap the private key; see Known Limitations).

## 4. Users and Core Flow
1. New user signs up (name, email, password). The browser generates their encryption keys. Email is verified (if enabled).
2. User logs in and lands on `/chat`.
3. User sees all other registered users, selects one.
4. Conversation opens with prior history (decrypted in the browser); user sends messages.
5. Recipient (in another browser) sees the message appear live, decrypted locally.
6. User switches to another conversation; unread badges show for conversations not open.
7. User logs out (local key cache is wiped).

## 5. Functional Requirements

### Authentication
| ID | Requirement |
|----|-------------|
| A1 | Signup with name + email + password (**min 10 chars**; the password also protects the encryption key). |
| A2 | Email verification via Appwrite's verification email. Controlled by `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION`; when `true`, unverified users cannot use `/chat` and see a "verify your email" screen with a resend button. |
| A3 | Login with email + password. |
| A4 | Logout ends the session, wipes the locally cached private key, and returns to `/login`. |
| A5 | `/chat` is protected: unauthenticated visitors are redirected to `/login`. Logged-in visitors on `/login` or `/signup` are redirected to `/chat`. |
| A6 | Friendly error messages (wrong password, email already registered, rate limit). |

### End-to-end encryption
| ID | Requirement |
|----|-------------|
| E1 | On signup the browser generates an ECDH P-256 key pair. The public key is published in the user's `profiles` document. The private key is encrypted (AES-GCM) with a key derived from the user's password (PBKDF2-SHA-256, ≥600,000 iterations, random salt) and stored in the owner-only `keys` collection, so it works on any browser. |
| E2 | On login in any browser the wrapped private key is fetched and unwrapped with the password, then cached in IndexedDB as a **non-extractable** `CryptoKey` so page reloads do not ask for the password again. The cache is deleted on logout. |
| E3 | Each conversation uses an AES-GCM 256 key derived from ECDH(my private key, their public key) via HKDF. Every message uses a fresh random 96-bit IV. The message id, conversation ID and sender ID are bound as AES-GCM additional authenticated data (AAD). |
| E4 | Only ciphertext is written to Appwrite (`ciphertext` attribute). Plaintext is never sent to Appwrite, logged, or written to localStorage/IndexedDB. |
| E5 | Sender ID, recipient ID, sender name and timestamps stay readable (metadata is not encrypted). |
| E6 | The signup screen states clearly: if you forget your password and reset it, old messages cannot be recovered. |
| E7 | If login succeeds but the stored key cannot be unwrapped with the password (e.g. the password was reset), the user sees a "Encryption keys need to be reset" screen and must explicitly confirm creating new keys. Old messages then show a "Can't decrypt this message" placeholder. Keys are never replaced silently. |
| E8 | A message that fails to decrypt renders a placeholder and never breaks the list. |
| E9 | The chat header shows an "End-to-end encrypted" indicator. |
| E10 | If a session exists but the local private key is missing or stale (cleared browser storage, or keys were reset on another device), the user is shown an "Unlock messages" screen that asks for the password. |
| E11 | If the selected user has no public key, the input is disabled with an explanatory message. |

### Users list
| ID | Requirement |
|----|-------------|
| U1 | Show all registered users except the current user, sorted by name. |
| U2 | Each user's profile (name, email, **public key**) is stored in a `profiles` collection, created on first entry to `/chat`. |
| U3 | The list updates when a new user joins (Realtime on `profiles`) — nice to have; a refresh must at least show them. |
| U4 | Client-side search/filter by name — optional. |

### Conversations and messages
| ID | Requirement |
|----|-------------|
| C1 | Selecting a user opens a one-to-one conversation. |
| C2 | Every message stores sender and recipient; a conversation shows only messages between the two participants. |
| C3 | Opening a conversation loads history (latest 50, older loaded on "Load earlier"), decrypted in the browser. |
| C4 | The selected conversation is visibly highlighted in the list and named in the chat header. |
| C5 | Switching conversations is instant and never mixes messages between conversations. |
| C6 | Each message shows sender name and timestamp. |
| C7 | Empty or whitespace-only messages cannot be sent (button disabled, Enter ignored). Max 2000 characters of plaintext. |
| C8 | Enter sends, Shift+Enter inserts a newline. |
| C9 | View auto-scrolls to the newest message on open, on send and on receive. If the user has scrolled up, show a "New messages" jump button instead of forcing scroll. |

### Real-time
| ID | Requirement |
|----|-------------|
| R1 | Messages are delivered via Appwrite Realtime (WebSocket subscription); no polling. |
| R2 | A message received for the open conversation is decrypted and appears immediately. |
| R3 | A message received for a different conversation increments its unread badge (no decryption needed). |
| R4 | The Realtime subscription is cleaned up on logout/unmount and re-established after a dropped connection. |

### Bonus features (in scope)
| ID | Requirement |
|----|-------------|
| B1 | **Unread counts:** badge on each user for messages received while that conversation was not open; cleared when opened. Stored in browser localStorage (per-device). Counts survive a page reload. |
| B2 | **Send feedback:** optimistic message appears immediately with a "sending" state. |
| B3 | **Failure handling:** on failure, retry automatically up to 3 times with backoff (1s, 2s, 4s); if still failing, mark "Failed to send" with a Retry button. Retries must never create duplicate messages. The message is encrypted once and retries reuse the same ciphertext and ID. |

### Responsive UI
- Desktop (≥768px): two panes — user list left, conversation right.
- Mobile (<768px): user list is a full screen; selecting a user opens the conversation full screen with a back button.

## 6. Non-Functional Requirements
- **Security:** no secret API keys in code or repo; only public Appwrite identifiers as `NEXT_PUBLIC_*`. Message documents readable only by sender and recipient (document-level permissions), and their content is ciphertext (defense in depth). The wrapped private key is readable only by its owner.
- **Cryptography:** only Web Crypto primitives (ECDH P-256, HKDF, AES-GCM, PBKDF2); no hand-rolled crypto and no third-party crypto libraries. Requires a secure context (HTTPS or `localhost`).
- **Performance:** first message render < 1s after selecting a conversation on a normal connection; realtime delivery typically < 1s. Password-based key derivation may take up to ~2s at login/signup (show a spinner).
- **Accessibility:** keyboard-usable, visible focus, labels on inputs, sufficient contrast.
- **Type safety:** TypeScript strict mode, no `any`.

## 7. Acceptance Criteria
- [ ] Two accounts (A and B) can sign up and log in from two different browsers/profiles.
- [ ] A sees B in the list, opens the conversation, sends "hi"; B sees it appear without refresh.
- [ ] B replies; A sees it live. Sender name and timestamp are correct on both sides.
- [ ] A third account C sees none of the A↔B messages, and A's conversation with C is empty.
- [ ] Refreshing loads history in correct order, with no password prompt.
- [ ] In the Appwrite console, a message document shows only unreadable `ciphertext`; the plaintext appears nowhere in the document.
- [ ] Logging in as A in a second browser decrypts the full history.
- [ ] After clearing site data for the app and reloading, the "Unlock messages" screen appears; the correct password restores access, a wrong one shows an error.
- [ ] After a password is changed outside the app (Appwrite console), login shows the key-reset screen; after resetting, new messages work both ways and old ones show the "Can't decrypt" placeholder.
- [ ] While B has C's conversation open, a message from A shows an unread badge on A; opening A's conversation clears it.
- [ ] Empty message cannot be sent.
- [ ] Turning off the network then sending shows retry attempts, then "Failed" with Retry; retrying after reconnect succeeds once (no duplicate).
- [ ] `/chat` redirects to `/login` when logged out.
- [ ] Layout works at 360px, 768px and 1280px widths.
- [ ] `npm run lint` and `npm run build` pass; the repo contains no secrets.

## 8. Known Limitations (accepted)
- Sender identity and name are set by the client. Appwrite document permissions control who can *read* a message, not who can claim to be the sender. Also, both participants share the same conversation key, so encryption gives confidentiality but not proof of authorship. Hardening (an Appwrite Function creating messages server-side) is out of scope.
- **Password reset loses history.** The private key is locked with a key derived from the password. If the password is reset, the old key cannot be unwrapped; a new key pair is created and old messages (both directions) cannot be recovered.
- **No key verification.** Public keys are fetched from the `profiles` collection. Someone with write access to the project (the project owner) could swap a user's public key and mount an active man-in-the-middle attack. Encryption protects against reading stored data (console, exports, leaks), not against an active attacker who controls the project.
- **Password is a single point of protection.** The wrapped private key is offline-guessable by anyone who can read the `keys` collection (project owner/console). A weak password weakens the encryption; hence the 10-character minimum. Appwrite Auth also receives the same password at login.
- Metadata (who talks to whom, when, message length approximately) is visible to Appwrite. No forward secrecy.
- Route protection is client-side: the Appwrite web SDK keeps the session in the browser, so Next.js middleware cannot see it. Data remains protected by Appwrite permissions regardless.
- Unread counts are per-device (localStorage).
- A script injected into the page (XSS) could use the non-extractable key while the page is open, though it cannot export it.
- Free-plan quotas (bandwidth, realtime connections, email sending) apply.

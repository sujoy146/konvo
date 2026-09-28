# Tasks

Work top to bottom. Tick a task only when its acceptance check passes. Read `rules.md` §9 (Definition of Done) before ticking.

## Phase 0 — Verify assumptions (before coding)
- [ ] **T0.1** Check the current Appwrite docs for the SDK version you install: Databases vs TablesDB naming, `createEmailPasswordSession` method name, and the exact Realtime channel string for document events. Update `system-architecture.md` if it differs.
  *Accept:* channel string and method names noted in `memory.md`.
- [ ] **T0.2** Confirm on your Appwrite Cloud project that verification emails arrive (send one to a real inbox; check spam). If not workable, set `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false` and log it in `memory.md`.
- [ ] **T0.3** Confirm in a browser console on `http://localhost:3000` that `crypto.subtle` exists, ECDH P-256, HKDF, AES-GCM and PBKDF2 work, and a non-extractable `CryptoKey` can be stored in and read back from IndexedDB. Time PBKDF2 at 600,000 iterations.
  *Accept:* results and timing noted in `memory.md`.

## Phase 1 — Appwrite project setup
- [ ] **T1.1** Create an Appwrite Cloud project. Note endpoint (with region) and project ID.
- [ ] **T1.2** Auth → enable Email/Password.
- [ ] **T1.3** Add Web platform `localhost`.
- [ ] **T1.4** Create database; note database ID.
- [ ] **T1.5** Create `profiles` collection: attributes `userId`, `name`, `email`, `publicKey` (string 200); unique index on `userId`; Document security ON; collection permissions Create = users, Read = users.
- [ ] **T1.6** Create `keys` collection: attributes `publicKey` (200), `salt` (64), `iv` (64), `wrappedPrivateKey` (1000), `iterations` (integer); Document security ON; collection permissions Create = users only (no Read/Update at collection level).
- [ ] **T1.7** Create `messages` collection: attributes `conversationId`, `senderId`, `senderName`, `recipientId`, `ciphertext` (string 10000); indexes on `conversationId` and `recipientId`; Document security ON; collection permissions Create = users only.
  *Accept (Phase 1):* all IDs recorded in `memory.md`; attribute status is "available" in the console.

## Phase 2 — Project scaffold
- [ ] **T2.1** `create-next-app` with TypeScript, Tailwind, ESLint, App Router, `src/` dir.
- [ ] **T2.2** Install `appwrite` and pin its version.
- [ ] **T2.3** Add `.env.example` (7 variables, placeholders) and `.env.local` (real values, git-ignored). Confirm `.gitignore` covers `.env*` except `.env.example`.
- [ ] **T2.4** `src/lib/config.ts` (typed env, throws on missing) and `src/lib/appwrite.ts` (client singletons).
- [ ] **T2.5** `src/types/index.ts` and `src/lib/conversation.ts` (`getConversationId`).
- [ ] **T2.6** Initialize git and make the first commit (local only).
  *Accept:* `npm run dev` starts; `npm run build` passes.

## Phase 3 — Authentication
- [ ] **T3.1** `AuthContext` (`user`, `loading`, `signup`, `login`, `logout`, `refresh`).
- [ ] **T3.2** `/signup` page (name, email, password ≥ 10) with inline errors and the password-reset warning box (`design.md` §3.1).
- [ ] **T3.3** `/login` page.
- [ ] **T3.4** Email verification: send on signup, `/verify` page, "check your inbox" screen with Resend, gated by `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION`.
- [ ] **T3.5** Logout button.
- [ ] **T3.6** Route guard: `/chat` → `/login` when logged out; `/login` and `/signup` → `/chat` when logged in; no flicker while loading.
  *Accept (encryption hooks added in Phase 4):* create an account, verify, log in, log out, reload while logged in stays logged in, direct visit to `/chat` while logged out redirects.

## Phase 4 — End-to-end encryption
- [ ] **T4.1** `src/lib/crypto.ts`: `generateIdentity`, `wrapPrivateKey`, `unwrapPrivateKey` (non-extractable), `deriveConversationKey`, `encryptMessage`, `decryptMessage`, with the parameters in `system-architecture.md` §6.1. Add types for `VaultFields`.
  *Accept:* a throwaway test (script or temporary page, not committed) shows that two identities derive the same conversation key, a round trip works, a wrong AAD or altered ciphertext throws, and a wrong password fails to unwrap.
- [ ] **T4.2** `src/lib/keystore.ts`: IndexedDB `saveKey` / `loadKey` / `deleteKey` for `{ privateKey, publicKey }`, all in try/catch.
- [ ] **T4.3** `EncryptionContext`: states `checking | locked | needs-reset | ready`; `setupKeys`, `unlock`, `resetKeys`, `getConversationKey`.
- [ ] **T4.4** Wire into auth: `setupKeys(password)` on signup; `unlock(password)` on login (or `setupKeys` if no vault exists); `deleteKey` and cache clear on logout.
- [ ] **T4.5** `UnlockScreen` and `KeyResetScreen` (`design.md` §3.1a/3.1b); `/chat` renders by key state.
- [ ] **T4.6** Blocking message when Web Crypto or IndexedDB is unavailable.
  *Accept:* after signup a `keys` document exists, readable only by its owner; reload keeps you unlocked; login on a second browser unwraps the key; clearing site data shows the Unlock screen and the right password restores access; changing the password in the Appwrite console then logging in shows the key-reset screen.

## Phase 5 — Users list
- [ ] **T5.1** Profile bootstrap on entering `/chat` (get; create on 404 with `publicKey`; update `publicKey` if it differs from the local key record).
- [ ] **T5.2** `useProfiles` hook and `UserList` / `UserListItem` components (initials avatar, sorted, excludes self).
- [ ] **T5.3** Empty and loading states.
  *Accept:* two accounts each see the other, and not themselves; each profile document contains a `publicKey`.

## Phase 6 — Conversations and messaging
- [ ] **T6.1** Selected-user state; highlight in list; header shows the other user's name and the lock indicator.
- [ ] **T6.2** `useMessages`: refetch the other user's public key, derive and cache the conversation key, load latest 50 for `conversationId`, decrypt (per-message failure → placeholder), ordered oldest→newest; ignore stale responses when switching.
- [ ] **T6.3** `MessageList` + `MessageBubble` (sender name, timestamp, own vs other styling, grouping, undecryptable variant).
- [ ] **T6.4** `MessageInput` (trim, disable when empty or no key, Enter / Shift+Enter, 2000-char limit).
- [ ] **T6.5** Send: `ID.unique()`, encrypt once with AAD, document permissions `Read: sender + recipient`, store only `ciphertext`.
- [ ] **T6.6** "Load earlier" pagination with `cursorAfter`.
- [ ] **T6.7** Auto-scroll: on open/send/receive; "↓ New messages" pill when scrolled up.
  *Accept:* A sends to B, refresh both, history loads and decrypts in order; the Appwrite console shows only ciphertext; account C sees nothing from A↔B; switching A between B and C never mixes messages.

## Phase 7 — Realtime
- [ ] **T7.1** Single subscription on the messages channel in the chat screen; cleanup on unmount/logout.
- [ ] **T7.2** Handle `create` events: replace optimistic message by `$id` (keep local plaintext), decrypt and append if active conversation, otherwise increment unread.
- [ ] **T7.3** Reconnect handling: "Reconnecting…" banner and refetch of the active conversation.
- [ ] **T7.4** (Optional) Subscribe to `profiles` so new users appear live and changed public keys are picked up.
  *Accept:* with two browsers, messages appear decrypted on the other side within ~1s without refresh; no duplicate bubbles for the sender.

## Phase 8 — Bonus: unread counts
- [ ] **T8.1** `storage.ts` safe localStorage helpers (try/catch, per-user keys).
- [ ] **T8.2** `useUnread`: counts and `lastRead`, increment on non-active realtime events, clear on open.
- [ ] **T8.3** Initial computation on load from the latest 100 messages where `recipientId = me` (metadata only, no decryption).
- [ ] **T8.4** Badge in `UserListItem` (99+ cap, accessible label).
  *Accept:* unread count survives reload, clears when the conversation is opened, and never counts the open conversation.

## Phase 9 — Bonus: send feedback and failure handling
- [ ] **T9.1** Optimistic message with `sending` status.
- [ ] **T9.2** Auto-retry ×3 with 1s/2s/4s backoff; same message ID and same ciphertext reused; 409 treated as success; no retry on non-retryable 4xx.
- [ ] **T9.3** `failed` state UI with Retry button; retry re-sends with same ID and ciphertext.
  *Accept:* set the browser offline, send → retries, then "Failed to send · Retry"; go online, Retry → delivered exactly once and readable by the recipient.

## Phase 10 — Responsive polish
- [ ] **T10.1** Desktop two-pane layout; mobile list ↔ conversation views with Back.
- [ ] **T10.2** `h-dvh` layout, safe-area padding, keyboard-friendly input bar.
- [ ] **T10.3** Accessibility pass (labels, focus ring, `role="log"`, aria labels, lock icon label).
- [ ] **T10.4** Test at 360, 768, 1280 px.

## Phase 11 — Docs and final verification
- [ ] **T11.1** README: overview, features, how the encryption works and its limits (password reset loses history, no key verification), Appwrite setup (every step of Phase 1 with the exact attribute tables, indexes, permissions), local run, env var table, two-user test script, known limitations.
- [ ] **T11.2** Final `npm run lint` and `npm run build`; grep the repo for secrets and for any plaintext-message logging.
- [ ] **T11.3** Run the full acceptance list from `prd.md` §7 locally using two browser profiles (or one normal + one incognito window).
  *Accept:* every box in `prd.md` §7 is ticked.

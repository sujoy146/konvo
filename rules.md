# Rules

Engineering rules for building this project. Follow them for every change (human or AI).

## 1. Scope
- Build only what `prd.md` lists. Extras (typing, presence, groups, file upload, deployment/hosting) are out of scope.
- If a requirement is unclear, check `prd.md`, `system-architecture.md` and `memory.md` first, then ask.

## 2. Security and Encryption (non-negotiable)

### Secrets and access
1. **Never** use, create or commit an Appwrite API key. The app runs on the client SDK only.
2. Only these may be `NEXT_PUBLIC_*`: endpoint, project ID, database ID, collection IDs (profiles, keys, messages), the verification flag.
3. `.env.local` is git-ignored. `.env.example` has placeholder values only.
4. Before every commit, confirm `git status` shows no `.env*` file other than `.env.example`.
5. Never render user text with `dangerouslySetInnerHTML`.
6. Every message is created with document permissions `Read: user(sender), user(recipient)` and nothing broader. Never grant `any` or `users` read on messages.
7. Every `keys` document is created with `Read: user(owner)` and `Update: user(owner)` only. Never put wrapped private keys in `profiles`.
8. Never log passwords, session secrets, keys, plaintext or ciphertext of messages.

### Cryptography
9. All crypto lives in `src/lib/crypto.ts` (and IndexedDB access in `src/lib/keystore.ts`). Components and hooks call its functions; they never touch `crypto.subtle` directly.
10. Use only Web Crypto primitives with the parameters in `system-architecture.md` §6.1. No hand-rolled crypto, no third-party crypto libraries, no downgrade to weaker parameters.
11. A fresh random 12-byte IV (`crypto.getRandomValues`) for every AES-GCM encryption. Never derive, reuse or hard-code IVs.
12. Always pass the AAD (`messageId|conversationId|senderId` for messages, `userId` for the vault). Decryption failures are handled per message; never swallow them silently and never show partial plaintext.
13. The private key is `extractable: false` everywhere except the brief moment it is generated and wrapped. Never store it, or the password, in localStorage, sessionStorage, cookies, Appwrite, or React state that persists.
14. Plaintext message text is never sent to Appwrite and never persisted anywhere (Appwrite, localStorage, IndexedDB). It lives in memory only.
15. No fallback to unencrypted messages if Web Crypto or IndexedDB is unavailable: block with a clear message instead.
16. Key replacement (reset) only happens after explicit user confirmation and password re-entry. Never overwrite a vault automatically.
17. Encrypt a message once; retries reuse the same message ID and ciphertext.

## 3. TypeScript
- `strict: true`. No `any`; use `unknown` and narrow.
- Model Appwrite documents with explicit types in `src/types` (extend `Models.Document`).
- Components and hooks have explicit prop and return types.
- No unused variables or imports (ESLint clean, `next build` passes).

## 4. Next.js and React
- App Router. Components that use hooks, browser APIs, or the Appwrite SDK start with `"use client"`.
- Appwrite `Client`, `Account`, `Databases` are created **once** in `src/lib/appwrite.ts` and imported everywhere. No `new Client()` elsewhere.
- All env access goes through `src/lib/config.ts`; no direct `process.env` reads in components.
- Realtime subscriptions are created in an effect and **always** unsubscribed in the cleanup function.
- Effects must handle stale async results (check the active conversation ID before setting state).
- No polling for messages. Realtime only (a refetch on reconnect is allowed).
- Keep state local to the smallest component that needs it; only auth and encryption key state live in context.
- Web Crypto and IndexedDB are browser-only: touch them in effects or event handlers, never during server rendering.

## 5. Data rules
- Conversation ID comes only from `getConversationId()`; never build it inline.
- Timestamps come from `$createdAt` (server), not client clocks, except for the temporary optimistic value.
- Message IDs for sends are generated on the client with `ID.unique()` and reused on retries.
- Validate before sending: `text.trim()` non-empty, ≤ 2000 chars. Encrypt the trimmed text.
- The `messages` collection has a `ciphertext` attribute only; there is no plaintext `text` attribute.
- Query with explicit `Query.limit` and ordering; never fetch unbounded lists.
- Do not change attribute names/types after creation without updating `system-architecture.md`, the README setup steps, and `memory.md`.

## 6. UI/UX
- Mobile-first Tailwind; test at 360, 768, 1280 px.
- Every async action has loading and error feedback (buttons disabled while submitting, inline errors). Password-based key derivation shows a spinner.
- The selected conversation is always visible (highlight in list + name in header).
- Respect the design tokens in `design.md`; no ad-hoc colors.
- Interactive elements are real `<button>`/`<a>`/`<input>` with labels; visible focus ring.
- Users are told about the password-reset consequence at signup and on the key-reset screen, in plain language.

## 7. Code style
- Small files: components < ~150 lines, hooks focused on one concern.
- Names: `PascalCase` components, `camelCase` functions, `kebab-case` not used for source files except routes.
- No dead code, no commented-out blocks, no `console.log` in committed code (use `console.error` in catch blocks only where useful, and never with keys or message data).
- Comments explain *why*, not *what*. Every crypto parameter choice has a one-line comment referencing `system-architecture.md` §6.1.

## 8. Git
- Small, focused commits with clear messages (`feat: unread badge`, `fix: dedupe realtime echo`).
- Work on `main` via short-lived feature branches.
- Never commit `node_modules`, `.next`, `.env.local`.

## 9. Definition of Done (per task)
- [ ] Meets its acceptance criteria in `tasks.md`.
- [ ] `npm run lint` and `npm run build` pass.
- [ ] Tested manually with two accounts in two browser profiles when it touches messaging or keys.
- [ ] When it touches messaging, a message document in the Appwrite console shows only ciphertext.
- [ ] No secrets in the diff.
- [ ] Docs updated if the schema, env vars, crypto parameters, or setup steps changed.
- [ ] `memory.md` status/decisions updated.

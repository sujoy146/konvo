# Design

## 1. Principles
- Calm, readable, chat-first. The conversation is the hero; chrome is minimal.
- Always answer "who am I talking to?" and "what state is my message in?"
- Encryption is quiet but honest: a small lock indicator, plain-language warnings only where the user must decide something.
- Mobile-first; desktop is the same UI given more room.

## 2. Design Tokens (Tailwind)
| Token | Value | Use |
|---|---|---|
| Primary | `indigo-600` (hover `indigo-700`) | Buttons, own message bubbles, selected accent |
| Primary soft | `indigo-50` | Selected conversation background |
| Surface | `white` / page `slate-50` | Panels / app background |
| Border | `slate-200` | Dividers |
| Text | `slate-900` primary, `slate-500` secondary | |
| Other's bubble | `slate-100` with `slate-900` text | Received messages |
| Own bubble | `indigo-600` with `white` text | Sent messages |
| Success/Sending/Error | `slate-400` (sending) / `red-600` (failed) | Status text |
| Warning | `amber-50` background, `amber-800` text, `amber-200` border | Password-reset notice, key-reset screen |
| Undecryptable bubble | `slate-50` background, `slate-500` italic text, `slate-200` dashed border | "Can't decrypt this message" |
| Encryption indicator | `slate-500` lock icon + text | Chat header |
| Unread badge | `bg-indigo-600 text-white`, rounded-full | Count |
| Radius | `rounded-2xl` bubbles, `rounded-lg` inputs/buttons | |
| Font | System UI stack (Tailwind default `font-sans`) | |
| Dark mode | Out of scope | |

Contrast: all text/background pairs meet WCAG AA (verify white on `indigo-600` and `amber-800` on `amber-50`).

## 3. Screens

### 3.1 Login / Signup / Verify
Centered card (`max-w-sm`) on `slate-50`.
- App name/logo at top.
- Fields: Name (signup only), Email, Password (show/hide toggle). Labels above inputs.
- Signup only: helper text under the password field: "Minimum 10 characters."
- Signup only: **warning box** (Warning tokens) above the button: "Your password also protects your message encryption key. If you forget it and reset it, your old messages can't be recovered."
- Primary full-width button; spinner and disabled while submitting (key generation and derivation can take ~1–2 s, so label it "Setting up encryption…" / "Unlocking…" during that step).
- Inline error area (red text) above the button.
- Link to the other screen ("Already have an account? Log in").
- **Verify state:** after signup with verification on, show "Check your inbox" with the email address, **Resend email** button, and **Log out** link. `/verify` shows success ("Email verified → Go to chat") or failure ("Link invalid or expired → Resend").

### 3.1a Unlock messages (state `locked`)
Same centered card. Title "Unlock your messages". Text: "Enter your password to unlock your encryption key on this device." Password field, **Unlock** button (spinner while working), inline error "Couldn't unlock. Check your password.", and a **Log out** link.

### 3.1b Reset encryption keys (state `needs-reset`)
Centered card with a Warning box: "We couldn't unlock your encryption keys with this password. This usually means your password was reset. You can create new keys, but messages sent before now won't be readable, by you or the people you talked to." Password field, **Create new keys** button (primary), **Log out** link. Requires explicit click; never automatic.

### 3.2 Chat — Desktop (≥768px)
```
┌───────────────┬───────────────────────────────────────┐
│ Chats     [⎋] │  ◉ Priya Sen        🔒 End-to-end enc.│
│ ┌───────────┐ │───────────────────────────────────────│
│ │ 🔍 Search │ │        Priya Sen · 10:32 AM           │
│ └───────────┘ │       ┌─────────────────┐             │
│ ▌◉ Priya  (2) │       │ hey, are you in?│             │
│  ◉ Rahul      │       └─────────────────┘             │
│  ◉ Ananya     │  You · 10:33 AM                       │
│               │            ┌──────────────────────┐   │
│               │            │ yes, just pushed it  │   │
│               │            └──────────────────────┘   │
│ Signed in as  │                          Sent ✓       │
│ Sujoy         │───────────────────────────────────────│
│               │ [ Type a message…            ] [Send] │
└───────────────┴───────────────────────────────────────┘
```
- Sidebar width `w-80`, fixed; conversation area flexes.
- Full viewport height (`h-dvh`), only the message list scrolls.

### 3.3 Chat — Mobile (<768px)
- **List view:** header "Chats" + logout icon; scrollable user list.
- **Conversation view:** header with **← Back**, avatar and name, and a lock icon (text label hidden; icon has an `aria-label` and tooltip); messages; input bar pinned to bottom.
- Selecting a user slides to the conversation; Back returns to the list. Only one view visible at a time.
- Use `h-dvh` and safe-area padding so the input isn't hidden by the mobile keyboard/browser bars.

### 3.4 Empty and loading states
| State | UI |
|---|---|
| No conversation selected (desktop) | Centered "Select a user to start chatting". |
| No other users yet | "No other users yet. Invite someone to sign up." |
| Loading users / history | Skeleton rows / spinner. |
| Checking encryption keys | Full-screen spinner "Preparing secure chat…". |
| Conversation with no messages | "No messages yet. Say hi 👋". |
| Load error | Message + Retry button. |
| Realtime reconnecting | Thin banner "Reconnecting…" at top of conversation. |
| Other user has no public key | Input disabled, notice "This user hasn't set up encryption yet." |
| Web Crypto / IndexedDB unavailable | Blocking card: "Secure messaging needs a modern browser on HTTPS or localhost." |

## 4. Components

### UserListItem
- Avatar circle with initials (color derived from user ID, from a small fixed palette) + name.
- **Selected:** `bg-indigo-50`, 4px `indigo-600` left border, `font-semibold`.
- **Unread:** pill badge with count (`99+` cap) on the right; name in `font-semibold`.
- Hover: `bg-slate-50`. Whole row is a `<button>`.

### ChatWindow header
Avatar + full name of the selected user (this is the clear "who am I talking to" indicator), and on the right the lock indicator "End-to-end encrypted". Back button on mobile only.

### MessageBubble
- Own messages: right-aligned, `indigo-600`. Others: left-aligned, `slate-100`.
- Above/below each bubble group: **sender name** and **time** (`10:33 AM`; prefix the date, e.g. `28 Sep, 10:33 AM`, when not today). Consecutive messages from the same sender within ~2 minutes group under one header.
- Max width ~75% of the pane; `whitespace-pre-wrap`, `break-words`.
- Status line for own messages:
  - `Sending…` (slate-400, bubble at 70% opacity)
  - `Sent` (subtle)
  - `Failed to send · Retry` (red-600, Retry is a button, bubble gets a red outline)
- **Undecryptable variant** (either side): Undecryptable bubble tokens, text "🔒 Can't decrypt this message", still shows sender name and time.

### MessageInput
- Auto-growing textarea (1–5 lines), placeholder "Type a message…", `maxLength` 2000.
- Send button disabled when the trimmed text is empty (or when the conversation key is unavailable); Enter sends, Shift+Enter newline.
- Keeps focus after sending. Input clears immediately on send (optimistic).

### Scroll behavior
- On open / send / receive: scroll to bottom (smooth for live events, instant on first load).
- If the user has scrolled up more than ~100px from the bottom, don't force-scroll on incoming messages; show a floating **↓ New messages** pill that jumps to the bottom.

## 5. Interaction and Motion
- Transitions ≤ 150ms (`transition-colors`); mobile panel switch may slide (200ms).
- Respect `prefers-reduced-motion`.
- Buttons show a spinner while pending and are disabled to prevent double submits.

## 6. Accessibility
- Inputs have `<label>` (visually hidden where the design omits it).
- Visible focus ring (`focus-visible:ring-2 ring-indigo-500`).
- Message list has `role="log"` and `aria-live="polite"`.
- Unread badge has an accessible name ("2 unread messages").
- Icon-only buttons (logout, back) and the mobile lock icon have `aria-label` ("End-to-end encrypted").
- Warning boxes use `role="alert"` only when they appear as a result of an action (key reset screen); the signup notice is plain text so it is read in order.
- Tap targets ≥ 44px on mobile.

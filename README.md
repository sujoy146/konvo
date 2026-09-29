# [Konvo](https://konvo-talk.vercel.app/)

Konvo is a one-to-one chat app built with Next.js, Appwrite Auth, Appwrite TablesDB, Appwrite Functions, and Appwrite Realtime. Messages are stored as **plain text** in the Appwrite messages table; this version does not provide end-to-end encryption.

This guide covers setting up a fresh Appwrite project, configuring the database tables, deploying the message-sending Function, and connecting the web app.

## Requirements

- Node.js and npm
- An Appwrite Cloud account
- A Git repository and hosting account (for example, Vercel) if deploying the web app
- Two Appwrite user accounts to check messaging between users

## 1. Create an Appwrite project

1. Sign in to the [Appwrite Console](https://cloud.appwrite.io/).
2. Create an organization if needed, then create a project named **Konvo**.
3. Open **Overview** or **Settings** and copy the project ID.
4. Open **Auth** and enable email/password authentication.
5. In **Platforms**, add a **Web** platform:
   - For local development, use hostname `localhost`.
   - Before production, add your deployed hostname too, such as `your-app.vercel.app`.
   - Enter only the hostname: no `https://`, path, or trailing slash.
6. If email verification is enabled, make sure the app's hostname is an allowed platform. Konvo sends verification links to `/verify` on the current site.

The Appwrite project endpoint is the regional URL shown in the console, for example `https://<REGION>.cloud.appwrite.io/v1`. Use your own region's endpoint.

## 2. Create the database and tables

In the project, open **Databases** and create a database. Copy its ID; you will use it as `NEXT_PUBLIC_APPWRITE_DATABASE_ID`.

For each table below, enable **Row-Level Security (RLS)**. Table IDs can be any valid IDs; use the IDs you create in the environment variables.

### Profiles table

Create a table named `profiles` with these columns:

| Column | Type | Size | Required | Index |
| --- | --- | ---: | --- | --- |
| `userId` | String | 36 | Yes | Key |
| `name` | String | 128 | Yes | Key |
| `email` | Email (or String) | 320 | Yes | — |
| `publicKey` | String | 1000 | Yes | — |

The app creates each profile with the Appwrite user ID as both the row ID and `userId`. It reads the profiles table to show registered users and sorts by `name`.

**Table permissions:** allow authenticated users (`Users`) to create rows. Leave table-level Read, Update, and Delete disabled so access is controlled by each row's permissions.

When the app creates a profile, it gives all signed-in users Read permission and gives that user Update permission. RLS must be enabled so these row permissions apply.

> Profile rows include email addresses and are readable by signed-in users because the current user directory loads every profile.

### Messages table

Create a table named `messages` with these columns:

| Column | Type | Size | Required | Index |
| --- | --- | ---: | --- | --- |
| `conversationId` | String | 100 | Yes | Key |
| `senderId` | String | 36 | Yes | — |
| `senderName` | String | 128 | Yes | — |
| `recipientId` | String | 36 | Yes | Key |
| `content` | String | 10000 | Yes | — |

Create a **Key** index on `conversationId` (and on `recipientId` if you want to filter or inspect messages by recipient in the console). The app queries conversations by `conversationId` and sorts them by Appwrite's built-in `$createdAt` field.

**Table permissions:** leave table-level Create, Read, Update, and Delete disabled. The Function creates each row and grants Read permission only to the sender and recipient. RLS must be enabled.

Do not create a `ciphertext` column for this plaintext version. The Function and web app use `content`.

### Keys table

The current plaintext chat flow does not read or write a keys table. The environment config still contains a legacy keys-table variable, but you can leave it blank. You do not need to create a keys table for messaging.

## 3. Configure local environment variables

At the project root, create `.env.local` (or copy `.env.example` if one exists) and set:

```dotenv
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://<REGION>.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<APPWRITE_PROJECT_ID>
NEXT_PUBLIC_APPWRITE_DATABASE_ID=<DATABASE_ID>
NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID=<PROFILES_TABLE_ID>
NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID=<MESSAGES_TABLE_ID>
NEXT_PUBLIC_APPWRITE_SEND_MESSAGE_FUNCTION_ID=<FUNCTION_ID>
NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true
```

Despite the variable names ending in `COLLECTION_ID`, these values are **TablesDB table IDs**.

`NEXT_PUBLIC_APPWRITE_KEYS_COLLECTION_ID` is a legacy setting and can be blank for the current plaintext app. Never put an Appwrite API key or other secret in a `NEXT_PUBLIC_...` variable. Keep `.env.local` out of Git; `.gitignore` already ignores `.env*`.

Restart the Next.js dev server after changing environment variables:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 4. Create and deploy the send-message Function

The app sends messages through an Appwrite Function so the browser cannot directly create arbitrary message rows.

1. In Appwrite, open **Functions** and create a Function named `send-message`.
2. Choose a supported **Node.js** runtime (Node.js 22 is a suitable current runtime).
3. Enable the **HTTP** trigger.
4. Set the entrypoint to `src/main.js`.
5. Deploy the contents of this repository's `functions/send-message` directory as the Function source. The directory includes its own `package.json`, which installs `node-appwrite`.
6. In the Function's **Variables** settings, add:

   | Variable | Value |
   | --- | --- |
   | `APPWRITE_DATABASE_ID` | Your database ID |
   | `APPWRITE_PROFILES_TABLE_ID` | Profiles table ID |
   | `APPWRITE_MESSAGES_TABLE_ID` | Messages table ID |

   Appwrite supplies `APPWRITE_FUNCTION_API_ENDPOINT`, `APPWRITE_FUNCTION_PROJECT_ID`, the per-execution `x-appwrite-key`, and (for signed-in callers) `x-appwrite-user-jwt`. **Do not create or paste a server API key for this Function.**

7. In **Settings → Scopes**, grant the ephemeral key only:
   - `rows.read`
   - `rows.write`

   The Function uses these scopes to find the recipient's profile and create the message row.
8. In **Settings → Security**, permit authenticated users (`Users`) to execute the Function. The app calls it while signed in. The Function still checks the caller's user JWT and validates that the recipient, conversation, and message content are valid.
9. Wait until the Function deployment is active and copy the Function ID into `NEXT_PUBLIC_APPWRITE_SEND_MESSAGE_FUNCTION_ID` in `.env.local`.
10. Redeploy the Function after changing its source or variables.

The Function derives the sender from the authenticated session; the browser does not choose the sender ID or message permissions.

## 5. Try the app locally

1. Start the app with `npm run dev`.
2. Sign up with a name, email, and password of at least 8 characters.
3. If `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true`, open the verification email in the same browser and complete verification at `/verify`.
4. Create a second account in another browser profile or private window.
5. Open a conversation, send a message, and confirm it appears in the other account. Refresh the conversation and check that history loads.

## 6. Deploy the web app

For a Vercel deployment:

1. Push the repository to GitHub and import it into Vercel as a Next.js project.
2. Add the same `NEXT_PUBLIC_...` variables from `.env.local` in Vercel's **Production** environment. Do not include the angle brackets from the examples.
3. Add the deployed hostname to Appwrite under **Platforms → Web**.
4. Deploy the app.
5. Test signup, verification, login, sending and receiving messages, and Realtime using two accounts on the deployed URL.

Whenever an environment variable changes in Vercel, create a new deployment for the change to take effect.

## Troubleshooting

- **Message says “Sign in again to send messages.”** The Function execution did not include a valid signed-in user's JWT. Confirm the app is signed in, Function execution is allowed for authenticated users, and you are testing in the same browser session.
- **Message says “Message could not be saved.”** Check the Function execution logs and confirm the Function has the `rows.read` and `rows.write` scopes, all three Function variables are correct, and the messages table has the required columns with the exact names above.
- **Appwrite reports a missing column or invalid row.** The plaintext schema requires `content`, not `ciphertext`. Ensure all required columns exist and the string sizes are large enough.
- **Profiles do not load.** Confirm the profile table's `userId` and `name` columns and indexes, table ID, database ID, and RLS permissions.
- **Verification email or link fails.** Confirm email/password auth is enabled and the current hostname is registered as a Web platform. Check spam as well.
- **Messages save but live updates pause.** Realtime uses a WebSocket and can reconnect after a network interruption. Confirm the table row grants Read permission to both participants; reload the conversation to fetch stored history while investigating persistent reconnect errors.

## Data and security notes

- Message content is stored as plain text in Appwrite. Anyone with database-level administrative access can read it.
- Do not expose an Appwrite server API key in the browser, source code, or a `NEXT_PUBLIC_...` variable.
- The Function's ephemeral key is provided by Appwrite at runtime. Limit its scopes to the two row scopes listed above.
- Table and row permissions are part of the app's security model. Review them again before using real user data.
"# konvo" 

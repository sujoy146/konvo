export interface VaultFields {
  publicKey: string;
  salt: string;
  iv: string;
  wrappedPrivateKey: string;
  iterations: number;
}

// Convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Uint8Array with explicit ArrayBuffer backing
export function base64ToBuffer(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buf = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

// Ensure a Uint8Array has a plain ArrayBuffer (not SharedArrayBuffer)
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  if (u8.buffer instanceof SharedArrayBuffer) {
    return (u8.buffer as unknown as ArrayBuffer).slice(0);
  }
  return u8.buffer as ArrayBuffer;
}

const ITERATIONS = 600000;

export async function generateIdentity(): Promise<{ publicKey: string; privateKeyPkcs8: Uint8Array<ArrayBuffer> }> {
  // P-256 ECDH as per system-architecture.md §6.1
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const rawPub = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const pkcs8Priv = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  return {
    publicKey: bufferToBase64(rawPub),
    privateKeyPkcs8: new Uint8Array(pkcs8Priv) as Uint8Array<ArrayBuffer>,
  };
}

async function getPasswordKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // PBKDF2-SHA-256 as per system-architecture.md §6.1
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function wrapPrivateKey(pkcs8: Uint8Array<ArrayBuffer>, password: string, userId: string): Promise<VaultFields> {
  const saltArr = new ArrayBuffer(16);
  crypto.getRandomValues(new Uint8Array(saltArr));
  const ivArr = new ArrayBuffer(12);
  crypto.getRandomValues(new Uint8Array(ivArr));

  const salt = new Uint8Array(saltArr) as Uint8Array<ArrayBuffer>;
  const iv = new Uint8Array(ivArr) as Uint8Array<ArrayBuffer>;

  const wrappingKey = await getPasswordKey(password, salt, ITERATIONS);
  const enc = new TextEncoder();

  // AES-GCM with AAD=userId as per system-architecture.md §6.1
  const wrapped = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: enc.encode(userId),
    },
    wrappingKey,
    pkcs8
  );

  return {
    publicKey: "", // filled by caller
    salt: bufferToBase64(saltArr),
    iv: bufferToBase64(ivArr),
    wrappedPrivateKey: bufferToBase64(wrapped),
    iterations: ITERATIONS,
  };
}

export async function unwrapPrivateKey(vault: VaultFields, password: string, userId: string): Promise<CryptoKey> {
  const salt = base64ToBuffer(vault.salt);
  const iv = base64ToBuffer(vault.iv);
  const wrapped = base64ToBuffer(vault.wrappedPrivateKey);

  const wrappingKey = await getPasswordKey(password, salt, vault.iterations);
  const enc = new TextEncoder();

  let pkcs8: ArrayBuffer;
  try {
    pkcs8 = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: enc.encode(userId),
      },
      wrappingKey,
      toArrayBuffer(wrapped)
    );
  } catch {
    throw new Error("Failed to unwrap key. Incorrect password or tampered vault.");
  }

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDH", namedCurve: "P-256" },
    false, // non-extractable, as per system-architecture.md §6.2
    ["deriveKey", "deriveBits"]
  );

  // Best-effort zeroing of the PKCS8 bytes
  const arr = new Uint8Array(pkcs8);
  for (let i = 0; i < arr.length; i++) arr[i] = 0;

  return privateKey;
}

export async function deriveConversationKey(myPrivate: CryptoKey, theirPublicBase64: string, conversationId: string): Promise<CryptoKey> {
  const rawPub = base64ToBuffer(theirPublicBase64);
  const theirPublic = await crypto.subtle.importKey(
    "raw",
    rawPub,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH → HKDF-SHA-256 as per system-architecture.md §6.1
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: theirPublic },
    myPrivate,
    256
  );

  const hkdfKeyMaterial = await crypto.subtle.importKey(
    "raw",
    sharedBits,
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );

  const enc = new TextEncoder();
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: enc.encode("chat-e2ee-v1:" + conversationId),
    },
    hkdfKeyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(key: CryptoKey, plaintext: string, aad: string): Promise<string> {
  const ivArr = new ArrayBuffer(12);
  crypto.getRandomValues(new Uint8Array(ivArr));
  const iv = new Uint8Array(ivArr) as Uint8Array<ArrayBuffer>;

  const enc = new TextEncoder();
  // Fresh random IV per message as per system-architecture.md §6.1
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: enc.encode(aad),
    },
    key,
    enc.encode(plaintext)
  );

  return `v1.${bufferToBase64(ivArr)}.${bufferToBase64(ciphertext)}`;
}

export async function decryptMessage(key: CryptoKey, payload: string, aad: string): Promise<string> {
  const parts = payload.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new Error("Invalid message format");
  }

  const iv = base64ToBuffer(parts[1]);
  const ciphertext = base64ToBuffer(parts[2]);
  const enc = new TextEncoder();

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: enc.encode(aad),
    },
    key,
    toArrayBuffer(ciphertext)
  );

  return new TextDecoder().decode(plaintext);
}

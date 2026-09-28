"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ID, Permission, Role } from "appwrite";
import { tablesDb } from "@/lib/appwrite";
import { config } from "@/lib/config";
import { useAuth } from "./AuthContext";
import {
  generateIdentity,
  wrapPrivateKey,
  unwrapPrivateKey,
  deriveConversationKey,
  encryptMessage as encryptMsg,
  decryptMessage as decryptMsg,
  VaultFields,
} from "@/lib/crypto";
import { saveKey, loadKey, deleteKey } from "@/lib/keystore";
import { Profile, KeyVault } from "@/types";

type EncryptionStatus = "checking" | "locked" | "needs-reset" | "ready";

interface EncryptionContextType {
  status: EncryptionStatus;
  setupKeys: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  resetKeys: (password: string) => Promise<void>;
  getConversationKey: (otherProfile: Profile) => Promise<CryptoKey>;
  encrypt: (key: CryptoKey, plaintext: string, messageId: string, conversationId: string, senderId: string) => Promise<string>;
  decrypt: (key: CryptoKey, ciphertext: string, messageId: string, conversationId: string, senderId: string) => Promise<string>;
}

const EncryptionContext = createContext<EncryptionContextType | null>(null);

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const { user, pendingPassword, clearPendingPassword } = useAuth();
  const [status, setStatus] = useState<EncryptionStatus>("checking");
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [convKeys] = useState(() => new Map<string, CryptoKey>());

  const setupKeys = useCallback(async (password: string) => {
    if (!user) throw new Error("Not authenticated");

    const { publicKey, privateKeyPkcs8 } = await generateIdentity();
    const vault = await wrapPrivateKey(privateKeyPkcs8, password, user.$id);
    vault.publicKey = publicKey;

    await tablesDb.createRow(
      config.appwriteDatabaseId,
      config.appwriteKeysCollectionId,
      user.$id,
      vault,
      [Permission.read(Role.user(user.$id)), Permission.update(Role.user(user.$id))]
    );

    const pk = await unwrapPrivateKey(vault, password, user.$id);
    await saveKey(user.$id, { privateKey: pk, publicKey });
    setPrivateKey(pk);
    setStatus("ready");
  }, [user]);

  const unlock = useCallback(async (password: string) => {
    if (!user) throw new Error("Not authenticated");

    try {
      const vaultDoc = await tablesDb.getRow<KeyVault>(
        config.appwriteDatabaseId,
        config.appwriteKeysCollectionId,
        user.$id
      );

      const vault: VaultFields = {
        publicKey: vaultDoc.publicKey,
        salt: vaultDoc.salt,
        iv: vaultDoc.iv,
        wrappedPrivateKey: vaultDoc.wrappedPrivateKey,
        iterations: vaultDoc.iterations,
      };

      const pk = await unwrapPrivateKey(vault, password, user.$id);
      await saveKey(user.$id, { privateKey: pk, publicKey: vault.publicKey });
      setPrivateKey(pk);
      setStatus("ready");
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code === 404) {
        // No vault yet — first login, set up keys now
        await setupKeys(password);
      } else if ((err as Error).message?.includes("Failed to unwrap")) {
        setStatus("needs-reset");
        throw err;
      } else {
        throw err;
      }
    }
  }, [user, setupKeys]);

  // Auto-unlock when user logs in and password is available
  useEffect(() => {
    if (!user || !pendingPassword || status === "ready") return;

    unlock(pendingPassword)
      .catch(() => { /* handled inside unlock */ })
      .finally(() => clearPendingPassword());
  }, [user, pendingPassword, status, unlock, clearPendingPassword]);

  // Load from IndexedDB on mount / user change
  useEffect(() => {
    if (!user) {
      setPrivateKey(null);
      convKeys.clear();
      setStatus("checking");
      return;
    }

    // If we have a pending password, let the auto-unlock effect handle it
    if (pendingPassword) return;

    const init = async () => {
      setStatus("checking");
      try {
        const record = await loadKey(user.$id);
        if (record) {
          setPrivateKey(record.privateKey);
          setStatus("ready");
        } else {
          setStatus("locked");
        }
      } catch {
        setStatus("locked");
      }
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const resetKeys = useCallback(async (password: string) => {
    if (!user) throw new Error("Not authenticated");

    const { publicKey, privateKeyPkcs8 } = await generateIdentity();
    const vault = await wrapPrivateKey(privateKeyPkcs8, password, user.$id);
    vault.publicKey = publicKey;

    await tablesDb.updateRow(
      config.appwriteDatabaseId,
      config.appwriteKeysCollectionId,
      user.$id,
      vault,
      [Permission.read(Role.user(user.$id)), Permission.update(Role.user(user.$id))]
    );

    const pk = await unwrapPrivateKey(vault, password, user.$id);
    await saveKey(user.$id, { privateKey: pk, publicKey });
    setPrivateKey(pk);
    setStatus("ready");
  }, [user]);

  const getConversationKey = useCallback(async (otherProfile: Profile): Promise<CryptoKey> => {
    if (!privateKey) throw new Error("Keys not ready");
    if (!otherProfile.publicKey) throw new Error("Other user has no public key");

    const convId = [user!.$id, otherProfile.userId].sort().join("_");
    const cacheKey = `${convId}-${otherProfile.publicKey}`;

    if (convKeys.has(cacheKey)) return convKeys.get(cacheKey)!;

    const ck = await deriveConversationKey(privateKey, otherProfile.publicKey, convId);
    convKeys.set(cacheKey, ck);
    return ck;
  }, [privateKey, user, convKeys]);

  const encrypt = useCallback(async (
    key: CryptoKey, plaintext: string,
    messageId: string, conversationId: string, senderId: string
  ) => {
    return encryptMsg(key, plaintext, `${messageId}|${conversationId}|${senderId}`);
  }, []);

  const decrypt = useCallback(async (
    key: CryptoKey, ciphertext: string,
    messageId: string, conversationId: string, senderId: string
  ) => {
    return decryptMsg(key, ciphertext, `${messageId}|${conversationId}|${senderId}`);
  }, []);

  return (
    <EncryptionContext.Provider value={{ status, setupKeys, unlock, resetKeys, getConversationKey, encrypt, decrypt }}>
      {children}
    </EncryptionContext.Provider>
  );
}

export const useEncryption = () => {
  const ctx = useContext(EncryptionContext);
  if (!ctx) throw new Error("useEncryption must be used within EncryptionProvider");
  return ctx;
};

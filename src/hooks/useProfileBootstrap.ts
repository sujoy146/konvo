"use client";

import { useEffect, useState } from "react";
import { AppwriteException, Permission, Role } from "appwrite";
import { tablesDb } from "@/lib/appwrite";
import { config } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import { loadKey } from "@/lib/keystore";

export function useProfileBootstrap() {
  const { user } = useAuth();
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (!user) return;

    const bootstrap = async () => {
      try {
        const localKey = await loadKey(user.$id);
        if (!localKey) return; // Wait for encryption context to unlock

        try {
          const profile = await tablesDb.getRow(
            config.appwriteDatabaseId,
            config.appwriteProfilesCollectionId,
            user.$id
          );

          // T5.1: If publicKey differs, update it (happens after key reset)
          if (profile.publicKey !== localKey.publicKey) {
            await tablesDb.updateRow(
              config.appwriteDatabaseId,
              config.appwriteProfilesCollectionId,
              user.$id,
              { publicKey: localKey.publicKey }
            );
          }
        } catch (err: any) {
          if (err.code === 404) {
            // T5.1: Create profile if 404
            await tablesDb.createRow(
              config.appwriteDatabaseId,
              config.appwriteProfilesCollectionId,
              user.$id,
              {
                userId: user.$id,
                name: user.name,
                email: user.email,
                publicKey: localKey.publicKey,
              },
              [Permission.read(Role.users()), Permission.update(Role.user(user.$id))]
            );
          } else {
            console.error("Failed to bootstrap profile", err);
          }
        }
      } catch (err) {
        console.error("Profile bootstrap error", err);
      } finally {
        setBootstrapped(true);
      }
    };

    bootstrap();
  }, [user]);

  return bootstrapped;
}

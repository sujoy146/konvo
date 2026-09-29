"use client";

import { useEffect, useState } from "react";
import { Permission, Role } from "appwrite";
import { tablesDb } from "@/lib/appwrite";
import { config } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";

export function useProfileBootstrap() {
  const { user } = useAuth();
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (!user || (config.requireEmailVerification && !user.emailVerification)) return;

    const bootstrap = async () => {
      try {
        try {
          await tablesDb.getRow(
            config.appwriteDatabaseId,
            config.appwriteProfilesCollectionId,
            user.$id
          );
        } catch (err: unknown) {
          if ((err as { code?: number }).code === 404) {
            await tablesDb.createRow(
              config.appwriteDatabaseId,
              config.appwriteProfilesCollectionId,
              user.$id,
              {
                userId: user.$id,
                name: user.name,
                email: user.email,
                publicKey: "",
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

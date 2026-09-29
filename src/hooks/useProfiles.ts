"use client";

import { useState, useEffect } from "react";
import { Query } from "appwrite";
import { tablesDb } from "@/lib/appwrite";
import { config } from "@/lib/config";
import { Profile } from "@/types";

export function useProfiles(currentUserId: string | undefined) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUserId) return;

    const fetchProfiles = async () => {
      try {
        setLoading(true);
        // Exclude self, sort by name
        const response = await tablesDb.listRows<Profile>(
          config.appwriteDatabaseId,
          config.appwriteProfilesCollectionId,
          [
            Query.notEqual("userId", currentUserId),
            Query.orderAsc("name"),
            Query.limit(100)
          ]
        );
        setProfiles(response.rows);
      } catch (err: unknown) {
        console.error("Failed to fetch profiles", err);
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [currentUserId]);

  return { profiles, loading, error };
}

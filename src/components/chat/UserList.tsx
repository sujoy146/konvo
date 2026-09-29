import { useMemo } from "react";
import { Profile } from "@/types";
import { UserListItem } from "./UserListItem";
import { Spinner } from "../ui/Spinner";

interface UserListProps {
  profiles: Profile[];
  loading: boolean;
  error: string;
  selectedUserId: string | null;
  onSelectUser: (profile: Profile) => void;
  unreadCounts: Record<string, number>;
  latestMsgTime: Record<string, string>;
}

export function UserList({
  profiles,
  loading,
  error,
  selectedUserId,
  onSelectUser,
  unreadCounts,
  latestMsgTime,
}: UserListProps) {
  // Sort: profiles with unread messages first (by newest unread msg),
  // then the rest by latest message time, then alphabetically.
  const sorted = useMemo(() => {
    return [...profiles].sort((a, b) => {
      const aUnread = (unreadCounts[a.userId] ?? 0) > 0;
      const bUnread = (unreadCounts[b.userId] ?? 0) > 0;

      if (aUnread && !bUnread) return -1;
      if (!aUnread && bUnread) return 1;

      const aTime = latestMsgTime[a.userId] ?? "";
      const bTime = latestMsgTime[b.userId] ?? "";
      if (aTime > bTime) return -1;
      if (aTime < bTime) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [profiles, unreadCounts, latestMsgTime]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full p-4">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-500 text-center">
        {error}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 text-center">
        No other users found. Invite some friends!
      </div>
    );
  }

  return (
    <ul className="overflow-y-auto h-full flex flex-col divide-y divide-white/20">
      {sorted.map((profile) => (
        <UserListItem
          key={profile.userId}
          profile={profile}
          isSelected={selectedUserId === profile.userId}
          unreadCount={unreadCounts[profile.userId] ?? 0}
          onClick={() => onSelectUser(profile)}
        />
      ))}
    </ul>
  );
}

import { Profile } from "@/types";
import { UserListItem } from "./UserListItem";
import { Spinner } from "../ui/Spinner";

interface UserListProps {
  profiles: Profile[];
  loading: boolean;
  error: string;
  selectedUserId: string | null;
  onSelectUser: (profile: Profile) => void;
}

export function UserList({ profiles, loading, error, selectedUserId, onSelectUser }: UserListProps) {
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

  if (profiles.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 text-center">
        No other users found. Invite some friends!
      </div>
    );
  }

  return (
    <ul className="overflow-y-auto h-full flex flex-col divide-y divide-gray-100">
      {profiles.map((profile) => (
        <UserListItem
          key={profile.userId}
          profile={profile}
          isSelected={selectedUserId === profile.userId}
          onClick={() => onSelectUser(profile)}
        />
      ))}
    </ul>
  );
}

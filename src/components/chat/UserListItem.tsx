import { Profile } from "@/types";

interface UserListItemProps {
  profile: Profile;
  isSelected: boolean;
  onClick: () => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

export function UserListItem({ profile, isSelected, onClick }: UserListItemProps) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left p-4 flex items-center space-x-3 transition-colors hover:bg-gray-50 focus:outline-none focus:bg-gray-50 ${
          isSelected ? "bg-blue-50 hover:bg-blue-50 border-l-4 border-blue-600" : "border-l-4 border-transparent"
        }`}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
          {getInitials(profile.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{profile.name}</p>
          <p className="text-xs text-gray-500 truncate">{profile.email}</p>
        </div>
        {/* Unread badge will go here in Phase 8 */}
      </button>
    </li>
  );
}

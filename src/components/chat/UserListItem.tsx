import { Profile } from "@/types";

interface UserListItemProps {
  profile: Profile;
  isSelected: boolean;
  unreadCount: number;
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

export function UserListItem({ profile, isSelected, unreadCount, onClick }: UserListItemProps) {
  const hasUnread = unreadCount > 0;

  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left p-4 flex items-center space-x-3 transition-colors hover:bg-white/40 focus:outline-none focus:bg-white/40 ${
          isSelected ? "bg-white/50 border-l-4 border-blue-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]" : "border-l-4 border-transparent"
        }`}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
            {getInitials(profile.name)}
          </div>
          {/* Unread dot on avatar */}
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white" />
          )}
        </div>

        {/* Name / email */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${hasUnread ? "font-semibold text-black" : "font-medium text-black"}`}>
            {profile.name}
          </p>
          <p className="text-xs text-gray-500 truncate">{profile.email}</p>
        </div>

        {/* Unread count badge */}
        {hasUnread && (
          <span className="ml-2 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-semibold px-1.5 shrink-0">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </li>
  );
}

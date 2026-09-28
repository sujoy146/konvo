"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useEncryption } from "@/context/EncryptionContext";
import { useProfileBootstrap } from "@/hooks/useProfileBootstrap";
import { useProfiles } from "@/hooks/useProfiles";
import { Spinner } from "@/components/ui/Spinner";
import { UnlockScreen } from "@/components/auth/UnlockScreen";
import { KeyResetScreen } from "@/components/auth/KeyResetScreen";
import { UserList } from "@/components/chat/UserList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { Profile } from "@/types";

export default function ChatPage() {
  const { user, logout } = useAuth();
  const { status } = useEncryption();

  useProfileBootstrap();

  const { profiles, loading: profilesLoading, error: profilesError } = useProfiles(user?.$id);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <Spinner className="w-10 h-10" />
      </main>
    );
  }

  if (status === "locked") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <UnlockScreen />
      </main>
    );
  }

  if (status === "needs-reset") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <KeyResetScreen />
      </main>
    );
  }

  return (
    <main className="flex h-dvh bg-white overflow-hidden">
      {/* Sidebar */}
      <div className={`w-full md:w-80 border-r border-gray-200 flex flex-col shrink-0 ${selectedUser ? "hidden md:flex" : "flex"}`}>
        {/* Sidebar header */}
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">Konvo</h1>
            <p className="text-xs text-gray-500 truncate">{user?.name}</p>
          </div>
          <button
            onClick={logout}
            aria-label="Log out"
            className="ml-2 p-2 text-gray-400 hover:text-red-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
            title="Log out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-hidden">
          <UserList
            profiles={profiles}
            loading={profilesLoading}
            error={profilesError}
            selectedUserId={selectedUser?.userId ?? null}
            onSelectUser={(p) => setSelectedUser(p)}
          />
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 overflow-hidden ${!selectedUser ? "hidden md:flex" : "flex"} flex-col`}>
        {selectedUser ? (
          <ChatWindow
            otherUser={selectedUser}
            onBack={() => setSelectedUser(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
            <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm mt-1">Choose someone from the list to start chatting</p>
          </div>
        )}
      </div>
    </main>
  );
}

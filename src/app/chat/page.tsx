"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProfileBootstrap } from "@/hooks/useProfileBootstrap";
import { useProfiles } from "@/hooks/useProfiles";
import { usePageRealtime } from "@/hooks/usePageRealtime";
import { UserList } from "@/components/chat/UserList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ProfilePanel } from "@/components/chat/ProfilePanel";
import { Profile } from "@/types";
import { config } from "@/lib/config";
import { Spinner } from "@/components/ui/Spinner";
import {
  getUnreadCounts,
  setUnreadCounts,
  getLastRead,
  setLastRead,
} from "@/lib/storage";

export default function ChatPage() {
  const { user, logout } = useAuth();

  useProfileBootstrap();

  const verificationPending =
    config.requireEmailVerification && !!user && !user.emailVerification;

  const { profiles, loading: profilesLoading, error: profilesError } = useProfiles(
    verificationPending ? undefined : user?.$id
  );

  // ── Conversation selection ──────────────────────────────────────────────────
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  // Ref so the page-level realtime callback can read it without stale closures
  const selectedUserRef = useRef<Profile | null>(null);
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  // ── Unread counts (per senderId) ────────────────────────────────────────────
  // Initialised lazily from localStorage once we know the user id.
  const [unreadCounts, setUnreadCountsState] = useState<Record<string, number>>({});
  const unreadInitialisedRef = useRef(false);
  useEffect(() => {
    if (!user || unreadInitialisedRef.current) return;
    unreadInitialisedRef.current = true;
    setUnreadCountsState(getUnreadCounts(user.$id));
  }, [user]);

  // ── Latest-message timestamp per senderId (for sort order) ─────────────────
  const [latestMsgTime, setLatestMsgTime] = useState<Record<string, string>>({});

  // ── Ids of messages that were unread when the current conversation opened ───
  // Used to highlight those bubbles; cleared once the user has seen them.
  const [openedUnreadIds, setOpenedUnreadIds] = useState<Set<string>>(new Set());

  // ── Panels ──────────────────────────────────────────────────────────────────
  const [profileOpen, setProfileOpen] = useState(false);

  // ── Page-level realtime: fires for every incoming message to me ─────────────
  const handleIncoming = useCallback(
    (senderId: string, messageId: string, createdAt: string) => {
      if (!user) return;

      setUnreadCountsState((prev) => {
        const next = { ...prev, [senderId]: (prev[senderId] ?? 0) + 1 };
        setUnreadCounts(user.$id, next);
        return next;
      });

      setLatestMsgTime((prev) => {
        const existing = prev[senderId];
        if (existing && existing >= createdAt) return prev;
        return { ...prev, [senderId]: createdAt };
      });
    },
    [user]
  );

  usePageRealtime({
    myId: user?.$id ?? "",
    isConversationOpen: useCallback(
      (senderId: string) => selectedUserRef.current?.userId === senderId,
      []
    ),
    onIncoming: handleIncoming,
  });

  // ── Open a conversation ─────────────────────────────────────────────────────
  const handleSelectUser = useCallback(
    (profile: Profile) => {
      const senderId = profile.userId;
      // Snapshot the currently-unread message IDs for this sender so
      // MessageList can highlight them. We don't have the ids here (only the
      // count), so we pass the count instead and let useMessages tag them.
      // (We clear the count from state right away so the badge disappears
      //  instantly when the conversation opens.)
      setSelectedUser(profile);

      // Clear unread badge for this user immediately
      if (unreadCounts[senderId]) {
        setUnreadCountsState((prev) => {
          const next = { ...prev };
          delete next[senderId];
          setUnreadCounts(user?.$id ?? "", next);
          return next;
        });
      }

      // Clear openedUnreadIds (will be repopulated by ChatWindow/useMessages)
      setOpenedUnreadIds(new Set());
    },
    [unreadCounts, user]
  );

  // Called by ChatWindow/useMessages after messages are loaded and rendered.
  // We receive the IDs of messages that were unread when the conversation opened.
  const handleConversationViewed = useCallback(
    (unreadIds: string[], senderId: string) => {
      if (!user) return;
      // Advance lastRead
      const lr = getLastRead(user.$id);
      lr[senderId] = new Date().toISOString();
      setLastRead(user.$id, lr);

      setOpenedUnreadIds(new Set(unreadIds));
    },
    [user]
  );

  // When closing a conversation, clear highlights
  const handleBack = useCallback(() => {
    setSelectedUser(null);
    setOpenedUnreadIds(new Set());
  }, []);

  // ── Header unread-chats count ───────────────────────────────────────────────
  const unreadChatCount = Object.values(unreadCounts).filter((n) => n > 0).length;

  // ── Initials for avatar button ──────────────────────────────────────────────
  const initials = (user?.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // ── Guard: verification pending ─────────────────────────────────────────────
  if (verificationPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent p-4">
        <div className="text-center bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-xl p-8 max-w-md w-full">
          <Spinner className="w-10 h-10 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Please verify your email before opening chat.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      {profileOpen && (
        <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />
      )}

      <main className="flex h-dvh min-h-0 overflow-hidden p-0 sm:p-4 md:p-8 bg-transparent">
        <div className="flex w-full h-full min-h-0 max-w-7xl mx-auto overflow-hidden bg-white/40 backdrop-blur-xl border-0 sm:border border-white/50 rounded-none sm:rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]">
          {/* Sidebar */}
          <div
            className={`w-full md:w-80 border-r border-white/30 flex flex-col shrink-0 ${
              selectedUser ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Sidebar header */}
            <div className="p-4 border-b border-white/30 bg-white/30 flex items-center justify-between shrink-0">
            <div className="min-w-0">
              <h1 className="amarante-regular text-2xl text-black">
                Konvo
              </h1>
              <p className="text-xs text-black truncate">
                {unreadChatCount > 0 ? (
                  <>Unread <span className="font-semibold text-blue-600">{unreadChatCount}</span></>
                ) : (
                  "Unread"
                )}
              </p>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {/* Profile avatar button */}
              <button
                id="open-profile-btn"
                onClick={() => setProfileOpen(true)}
                aria-label="Open profile"
                title="My profile"
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-400 select-none"
              >
                {initials}
              </button>
              {/* Logout button */}
              <button
                onClick={logout}
                aria-label="Log out"
                className="p-2 text-gray-400 hover:text-red-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                title="Log out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* User list */}
          <div className="flex-1 overflow-hidden">
            <UserList
              profiles={profiles}
              loading={profilesLoading}
              error={profilesError}
              selectedUserId={selectedUser?.userId ?? null}
              onSelectUser={handleSelectUser}
              unreadCounts={unreadCounts}
              latestMsgTime={latestMsgTime}
            />
          </div>
        </div>

        {/* Chat area */}
        <div
          className={`flex-1 min-w-0 min-h-0 overflow-hidden ${!selectedUser ? "hidden md:flex" : "flex"} flex-col`}
        >
          {selectedUser ? (
            <ChatWindow
              otherUser={selectedUser}
              onBack={handleBack}
              openedUnreadIds={openedUnreadIds}
              onConversationViewed={handleConversationViewed}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-black p-8 text-center">
              <svg
                className="w-16 h-16 mb-4 opacity-30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose someone from the list to start chatting</p>
            </div>
          )}
        </div>
        </div>
      </main>
    </>
  );
}

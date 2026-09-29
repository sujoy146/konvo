"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";

interface ProfilePanelProps {
  open: boolean;
  onClose: () => void;
}

export function ProfilePanel({ open, onClose }: ProfilePanelProps) {
  const { user, updateName } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync name when user changes
  useEffect(() => {
    setNameValue(user?.name ?? "");
  }, [user?.name]);

  // Focus input when editing starts
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSave = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) { setError("Name cannot be empty."); return; }
    if (trimmed === user?.name) { setEditing(false); return; }
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await updateName(trimmed);
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update name.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNameValue(user?.name ?? "");
    setEditing(false);
    setError("");
  };

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Unmount the overlay completely when closed so it cannot cover the chat
  // or intercept taps on mobile, even if a transform transition is interrupted.
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close profile panel"
        className="fixed inset-0 z-40 cursor-default bg-black/50 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profile"
        className="fixed inset-y-0 right-0 z-50 flex h-dvh w-screen flex-col bg-white shadow-2xl sm:w-96"
      >
        {/* Header */}
        <div className="flex min-h-16 items-center justify-between border-b border-gray-100 px-5 py-2">
          <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile panel"
            className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg select-none">
              {initials}
            </div>
          </div>

          {/* Name field */}
          <div className="space-y-1 mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Display Name
            </label>
            {editing ? (
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  id="profile-name-input"
                  type="text"
                  value={nameValue}
                  onChange={(e) => { setNameValue(e.target.value); setError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
                  className="flex-1 px-3 py-2 border border-blue-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={64}
                  disabled={saving}
                />
                {saving ? (
                  <Spinner className="w-5 h-5 text-blue-500 shrink-0" />
                ) : (
                  <>
                    <button
                      id="profile-save-btn"
                      onClick={handleSave}
                      className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Save
                    </button>
                    <button
                      id="profile-cancel-btn"
                      onClick={handleCancel}
                      className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <span className="text-gray-900 text-sm font-medium flex-1 truncate">{user?.name ?? "—"}</span>
                <button
                  id="profile-edit-btn"
                  onClick={() => { setEditing(true); setSuccess(false); }}
                  aria-label="Edit name"
                  className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            )}
            {error && <p className="text-red-500 text-xs mt-1" role="alert">{error}</p>}
            {success && <p className="text-green-600 text-xs mt-1" role="status">Name updated!</p>}
          </div>

          {/* Email field */}
          <div className="space-y-1 mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Email
            </label>
            <p className="text-gray-900 text-sm font-medium truncate">{user?.email ?? "—"}</p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 my-4" />

          {/* Account info */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Email Verified
            </label>
            <p className={`text-sm font-medium ${user?.emailVerification ? "text-green-600" : "text-amber-500"}`}>
              {user?.emailVerification ? "Verified ✓" : "Not verified"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

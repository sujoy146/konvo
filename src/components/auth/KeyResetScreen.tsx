"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useEncryption } from "@/context/EncryptionContext";

export function KeyResetScreen() {
  const { resetKeys } = useEncryption();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      setError("You must confirm you understand that old messages will be lost.");
      return;
    }
    
    setError("");
    setLoading(true);

    try {
      await resetKeys(password);
    } catch (err: any) {
      setError(err.message || "Failed to reset keys.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-xl shadow-md p-8 text-center mx-auto mt-12">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Encryption keys need to be reset</h1>
      <p className="text-gray-600 mb-4 text-sm text-left">
        Your stored private key cannot be unlocked with your current password. This usually happens if you reset your password.
      </p>
      
      <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-100 text-left">
        <h3 className="font-semibold text-red-900 text-sm mb-1">Warning: Data Loss</h3>
        <p className="text-xs text-red-800">
          Generating new keys will restore your ability to send and receive new messages, but 
          <strong> all your previous messages will remain unreadable forever.</strong>
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <label className="flex items-start space-x-3 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>I understand that my old messages cannot be recovered.</span>
        </label>
        
        <Input
          type="password"
          label="Verify your new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          required
        />
        
        <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 focus:ring-red-500" isLoading={loading}>
          Create New Keys
        </Button>
      </form>
    </div>
  );
}

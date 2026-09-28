"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useEncryption } from "@/context/EncryptionContext";

export function UnlockScreen() {
  const { unlock } = useEncryption();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await unlock(password);
    } catch (err: any) {
      if (err.message.includes("Failed to unwrap")) {
        // Will transition to "needs-reset" automatically
      } else {
        setError("Couldn't unlock, check your password");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-xl shadow-md p-8 text-center mx-auto mt-12">
      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Unlock messages</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Enter your password to unlock your private encryption key on this device.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your account password"
          required
        />
        <Button type="submit" className="w-full" isLoading={loading}>
          Unlock
        </Button>
      </form>
    </div>
  );
}

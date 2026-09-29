"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { account } from "@/lib/appwrite";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refresh, resendVerification, logout } = useAuth();
  const [status, setStatus] = useState<"verifying" | "pending" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [goingBack, setGoingBack] = useState(false);
  const handledVerification = useRef<string | null>(null);

  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");

  useEffect(() => {
    if (authLoading) return;

    if (!userId || !secret) {
      const timer = setTimeout(() => setStatus(user?.emailVerification ? "success" : "pending"), 0);
      return () => clearTimeout(timer);
    }

    if (!user) {
      const timer = setTimeout(() => {
        setStatus("error");
        setErrorMsg("Sign in to the account you are verifying, then reopen the link or request a new email.");
      }, 0);
      return () => clearTimeout(timer);
    }

    if (user.$id !== userId) {
      const timer = setTimeout(() => {
        setStatus("error");
        setErrorMsg("This verification link belongs to a different account. Sign in to that account and reopen the link.");
      }, 0);
      return () => clearTimeout(timer);
    }

    if (user.emailVerification) {
      router.replace("/chat");
      return;
    }

    const verificationKey = `${userId}:${secret}`;
    if (handledVerification.current === verificationKey) return;
    handledVerification.current = verificationKey;

    let cancelled = false;
    const verify = async () => {
      try {
        await account.updateVerification(userId, secret);
        await refresh();
        if (!cancelled) {
          setStatus("success");
          router.replace("/chat");
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to verify email.");
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, userId, secret, refresh, router]);

  const handleResend = async () => {
    setResending(true);
    setResendMessage("");
    setErrorMsg("");
    try {
      await resendVerification();
      setResendMessage("A new verification email has been sent. Check your inbox and spam folder.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Could not send the verification email.");
    } finally {
      setResending(false);
    }
  };

  // Logs out first so the route guard allows navigating back to /signup
  const handleGoToSignup = async () => {
    setGoingBack(true);
    try {
      await logout();
    } catch {
      // logout navigates on its own; ignore errors
    }
  };

  if (authLoading) {
    return (
      <div className="w-full max-w-md bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-8 text-center">
        <Spinner className="w-12 h-12 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900">Checking your account…</h1>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-8 text-center">
      {status === "verifying" && (
        <>
          <Spinner className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Verifying your email...</h1>
          <p className="text-gray-500 mt-2">Please wait.</p>
        </>
      )}

      {status === "pending" && (
        <>
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4 text-blue-600 text-xl">
            @
          </div>
          <h1 className="text-xl font-bold text-gray-900">Check your inbox</h1>
          <p className="text-gray-600 mt-2">
            We sent a verification link{user?.email ? <> to <strong>{user.email}</strong></> : " to your email address"}. Open it in this browser to verify your account.
          </p>
          {user ? (
            <Button className="mt-6 w-full" onClick={handleResend} isLoading={resending}>
              Resend verification email
            </Button>
          ) : (
            <Link href="/login" className="block mt-6 text-sm text-blue-600 hover:underline">
              Sign in to resend the verification email
            </Link>
          )}
          {resendMessage && <p className="text-green-700 text-sm mt-3" role="status">{resendMessage}</p>}
          {errorMsg && <p className="text-red-500 text-sm mt-3" role="alert">{errorMsg}</p>}
          <p className="text-gray-500 text-xs mt-4">If you don&apos;t see it, check your spam folder.</p>
          <button
            id="go-back-to-signup"
            onClick={handleGoToSignup}
            disabled={goingBack}
            className="block w-full mt-4 text-sm text-gray-500 hover:text-gray-700 hover:underline disabled:opacity-60 transition-colors cursor-pointer"
          >
            {goingBack ? "Going back…" : "Wrong email address? Go back to sign up"}
          </button>
        </>
      )}

      {status === "success" && (
        <>
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Email verified!</h1>
          <p className="text-gray-500 mt-2">Redirecting you to the chat...</p>
        </>
      )}

      {status === "error" && (
        <>
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Verification failed</h1>
          <p className="text-red-500 mt-2 text-sm">{errorMsg}</p>
          {user && !user.emailVerification && (
            <Button className="mt-6 w-full" onClick={handleResend} isLoading={resending}>
              Resend verification email
            </Button>
          )}
          <Link href="/login" className="block mt-5 text-sm text-blue-600 hover:underline">
            Back to login
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-transparent p-4">
      <Suspense fallback={<Spinner className="w-10 h-10" />}>
        <VerifyContent />
      </Suspense>
    </main>
  );
}

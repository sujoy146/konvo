"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { account } from "@/lib/appwrite";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");

  useEffect(() => {
    if (!userId || !secret) {
      setStatus("error");
      setErrorMsg("Missing verification parameters in the URL.");
      return;
    }

    account.updateVerification(userId, secret)
      .then(() => {
        setStatus("success");
        setTimeout(() => {
          router.push("/chat");
        }, 2000);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err.message || "Failed to verify email.");
      });
  }, [userId, secret, router]);

  return (
    <div className="w-full max-w-md bg-white rounded-xl shadow-md p-8 text-center">
      {status === "verifying" && (
        <>
          <Spinner className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Verifying your email...</h1>
          <p className="text-gray-500 mt-2">Please wait.</p>
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
          <Button className="mt-6 w-full" onClick={() => router.push("/login")}>
            Back to Login
          </Button>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <Suspense fallback={<Spinner className="w-10 h-10" />}>
        <VerifyContent />
      </Suspense>
    </main>
  );
}

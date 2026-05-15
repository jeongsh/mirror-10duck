"use client";

import { useState, useEffect, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (event) => {
    event.preventDefault();

    if (password !== confirm) {
      setMessage("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (password.length < 6) {
      setMessage("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("비밀번호가 변경되었습니다. 로그인 페이지로 이동합니다.");
      setTimeout(() => router.push("/auth"), 2000);
    }
  };

  if (!ready) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="border border-dashed border-gray-500 bg-white/70 p-4 text-sm text-gray-600">
          비밀번호 재설정 링크를 확인하는 중입니다...
          <br />
          이메일의 링크를 통해 접속하지 않으셨다면{" "}
          <a href="/auth" className="underline">
            로그인 페이지
          </a>
          로 이동해주세요.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <h1 className="text-lg font-bold">새 비밀번호 설정</h1>
        <p className="mt-2 text-sm text-gray-600">변경할 비밀번호를 입력해주세요.</p>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 border border-dashed border-gray-500 bg-white/70 p-4"
      >
        <label className="text-sm">
          새 비밀번호
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
            placeholder="6자 이상"
          />
        </label>

        <label className="text-sm">
          새 비밀번호 확인
          <input
            type="password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
            placeholder="비밀번호 재입력"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "처리 중..." : "비밀번호 변경"}
        </button>
      </form>

      {message && (
        <p className="border border-dashed border-gray-500 bg-white/70 p-3 text-sm">
          {message}
        </p>
      )}
    </main>
  );
}

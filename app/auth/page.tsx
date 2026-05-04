"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  const authUser = useAuthUser();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const currentEmail = authUser?.email ?? null;

  const buttonLabel = useMemo(
    () => (mode === "login" ? "로그인" : "회원가입"),
    [mode],
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const action =
      mode === "login"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await action;

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
        mode === "login"
          ? "로그인 성공. 채널 목록에서 글을 작성해 보세요."
          : "회원가입 성공. 메일 인증이 켜져 있으면 받은 메일함을 확인해 주세요.",
      );
    }

    setLoading(false);
  };

  const onSignOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    setLoading(false);
    setMessage(error ? error.message : "로그아웃 완료.");
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 p-6">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <h1 className="text-lg font-bold">Supabase 인증</h1>
        <p className="mt-2 text-sm text-gray-600">
          로그인, 회원가입, 로그아웃을 처리합니다.
        </p>
      </header>

      <div className="flex gap-2 text-sm">
        <button
          type="button"
          className={`border border-dashed px-3 py-2 ${mode === "login" ? "bg-gray-200" : "bg-white"}`}
          onClick={() => setMode("login")}
        >
          로그인
        </button>
        <button
          type="button"
          className={`border border-dashed px-3 py-2 ${mode === "signup" ? "bg-gray-200" : "bg-white"}`}
          onClick={() => setMode("signup")}
        >
          회원가입
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 border border-dashed border-gray-500 bg-white/70 p-4"
      >
        <label className="text-sm">
          이메일
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
            placeholder="duck@example.com"
          />
        </label>

        <label className="text-sm">
          비밀번호
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
            placeholder="6자 이상"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="border border-dashed border-gray-500 bg-gray-200 px-3 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "처리 중..." : buttonLabel}
        </button>
      </form>

      <section className="border border-dashed border-gray-500 bg-white/70 p-4 text-sm">
        <p>현재 로그인 계정: {currentEmail ?? "없음"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || !currentEmail}
            onClick={onSignOut}
            className="border border-dashed border-gray-500 bg-white px-3 py-2 disabled:opacity-50"
          >
            로그아웃
          </button>
          <Link
            href="/board"
            className="border border-dashed border-gray-500 bg-white px-3 py-2"
          >
            채널 목록 보기
          </Link>
        </div>
      </section>

      {message ? (
        <p className="border border-dashed border-gray-500 bg-white/70 p-3 text-sm">
          {message}
        </p>
      ) : null}
    </main>
  );
}

"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { checkHandleAvailability } from "@/lib/supabase/profiles";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  const authUser = useAuthUser();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginId, setLoginId] = useState("");
  const [handle, setHandle] = useState("");
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

    if (mode === "signup") {
      if (!handle.trim()) {
        setMessage("아이디를 입력해주세요.");
        setLoading(false);
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(handle)) {
        setMessage("아이디는 영문, 숫자, 언더바(_)만 사용하여 3~20자로 입력해주세요.");
        setLoading(false);
        return;
      }
      const isAvailable = await checkHandleAvailability(handle);
      if (!isAvailable) {
        setMessage("이미 사용 중인 아이디입니다.");
        setLoading(false);
        return;
      }

      if (!loginId.includes("@")) {
        setMessage("회원가입 시에는 이메일을 입력해야 합니다.");
        setLoading(false);
        return;
      }
      
      const { error } = await supabase.auth.signUp({ 
        email: loginId, 
        password,
        options: {
          data: {
            handle,
            nickname: handle
          }
        }
      });
      
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("회원가입 성공. 메일 인증이 켜져 있으면 받은 메일함을 확인해 주세요.");
      }
    } else {
      let targetEmail = loginId;
      if (!loginId.includes("@")) {
        const { data, error } = await supabase.rpc("get_email_by_handle", { p_handle: loginId });
        if (error || !data) {
          setMessage("해당 아이디를 가진 사용자를 찾을 수 없습니다.");
          setLoading(false);
          return;
        }
        targetEmail = data as string;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: targetEmail, password });
      
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("로그인 성공. 채널 목록에서 글을 작성해 보세요.");
      }
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
        {mode === "signup" && (
          <label className="text-sm">
            아이디
            <div className="flex mt-1 border border-dashed border-gray-500 bg-white overflow-hidden">
              <span className="flex items-center px-3 text-gray-500 font-bold bg-gray-50 border-r border-dashed border-gray-400">@</span>
              <input
                type="text"
                required={mode === "signup"}
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                className="w-full bg-transparent px-3 py-2 outline-none"
                placeholder="영문, 숫자, 언더바 3~20자"
              />
            </div>
          </label>
        )}

        <label className="text-sm">
          {mode === "login" ? "아이디 또는 이메일" : "이메일"}
          <input
            type={mode === "login" ? "text" : "email"}
            required
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
            placeholder={mode === "login" ? "아이디 혹은 이메일 입력" : "duck@example.com"}
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

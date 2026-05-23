"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ComponentProps } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/supabase/useAuthUser";
import { checkHandleAvailability } from "@/lib/supabase/profiles";

type AuthMode = "login" | "signup" | "findHandle" | "findPassword";

export default function AuthPage() {
  const router = useRouter();
  const authUser = useAuthUser();
  const [mode, setMode] = useState<AuthMode>("login");

  // login / signup
  const [loginId, setLoginId] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");

  // find handle / find password
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryHandle, setRecoveryHandle] = useState("");
  const [foundHandle, setFoundHandle] = useState<string | null>(null);
  const [passwordVerified, setPasswordVerified] = useState(false);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const currentEmail = authUser?.email ?? null;

  const buttonLabel = useMemo(() => {
    if (mode === "login") return "로그인";
    if (mode === "signup") return "회원가입";
    if (mode === "findHandle") return "아이디 찾기";
    return passwordVerified ? "재설정 메일 발송" : "확인";
  }, [mode, passwordVerified]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setMessage("");
    setFoundHandle(null);
    setRecoveryHandle("");
    setRecoveryEmail("");
    setPasswordVerified(false);
  };

  const onSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setFoundHandle(null);

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
            nickname: handle,
          },
        },
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("회원가입 성공. 메일 인증이 켜져 있으면 받은 메일함을 확인해 주세요.");
      }
    } else if (mode === "login") {
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

      const { data, error } = await supabase.auth.signInWithPassword({ email: targetEmail, password });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("로그인 성공. 홈으로 이동합니다.");
        setLoading(false);
        router.push("/");
        router.refresh();
        return;
      }
    } else if (mode === "findHandle") {
      if (!recoveryEmail.includes("@")) {
        setMessage("올바른 이메일을 입력해주세요.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/auth/find-handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoveryEmail }),
      });
      const json = await res.json() as { handle: string | null; error?: string };

      if (!res.ok || json.error) {
        setMessage(json.error ?? "서버 오류가 발생했습니다.");
      } else if (!json.handle) {
        setMessage("해당 이메일로 가입된 아이디를 찾을 수 없습니다.");
      } else {
        setFoundHandle(json.handle);
      }
    } else if (mode === "findPassword") {
      if (!passwordVerified) {
        if (!recoveryHandle.trim()) {
          setMessage("아이디를 입력해주세요.");
          setLoading(false);
          return;
        }
        if (!recoveryEmail.includes("@")) {
          setMessage("올바른 이메일을 입력해주세요.");
          setLoading(false);
          return;
        }

        const { data: emailForHandle, error: rpcError } = await supabase.rpc("get_email_by_handle", {
          p_handle: recoveryHandle.trim(),
        });

        if (rpcError) {
          setMessage(`서버 오류: ${rpcError.message}`);
          setLoading(false);
          return;
        }
        if (!emailForHandle) {
          setMessage("존재하지 않는 아이디입니다.");
          setLoading(false);
          return;
        }
        if (emailForHandle.trim().toLowerCase() !== recoveryEmail.trim().toLowerCase()) {
          setMessage("아이디와 이메일이 일치하지 않습니다.");
          setLoading(false);
          return;
        }

        setPasswordVerified(true);
        setMessage("확인되었습니다. 아래 버튼을 눌러 재설정 메일을 발송하세요.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });

        if (error) {
          setMessage(error.message);
        } else {
          setMessage("비밀번호 재설정 메일을 발송했습니다. 받은 메일함을 확인해 주세요.");
        }
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

  const TAB_LABELS: { key: AuthMode; label: string }[] = [
    { key: "login", label: "로그인" },
    { key: "signup", label: "회원가입" },
    { key: "findHandle", label: "아이디 찾기" },
    { key: "findPassword", label: "비밀번호 찾기" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header className="border border-dashed border-gray-500 bg-white/70 p-4">
        <h1 className="text-lg font-bold">Supabase 인증</h1>
        <p className="mt-2 text-sm text-gray-600">
          로그인, 회원가입, 아이디/비밀번호 찾기를 처리합니다.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`border border-dashed px-3 py-2 ${mode === key ? "bg-gray-200" : "bg-white"}`}
            onClick={() => switchMode(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 border border-dashed border-gray-500 bg-white/70 p-4"
      >
        {/* 회원가입: 아이디 */}
        {mode === "signup" && (
          <label className="text-sm">
            아이디
            <div className="mt-1 flex overflow-hidden border border-dashed border-gray-500 bg-white">
              <span className="flex items-center border-r border-dashed border-gray-400 bg-gray-50 px-3 font-bold text-gray-500">
                @
              </span>
              <input
                type="text"
                required={mode === "signup"}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full bg-transparent px-3 py-2 outline-none"
                placeholder="영문, 숫자, 언더바 3~20자"
              />
            </div>
          </label>
        )}

        {/* 로그인/회원가입: 이메일 or 아이디 */}
        {(mode === "login" || mode === "signup") && (
          <label className="text-sm">
            {mode === "login" ? "아이디 또는 이메일" : "이메일"}
            <input
              type={mode === "login" ? "text" : "email"}
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2"
              placeholder={mode === "login" ? "아이디 혹은 이메일 입력" : "duck@example.com"}
            />
          </label>
        )}

        {/* 로그인/회원가입: 비밀번호 */}
        {(mode === "login" || mode === "signup") && (
          <label className="text-sm">
            비밀번호
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
        )}

        {/* 비밀번호 찾기: 아이디 */}
        {mode === "findPassword" && (
          <label className="text-sm">
            아이디
            <div className={`mt-1 flex overflow-hidden border border-dashed border-gray-500 bg-white ${passwordVerified ? "opacity-60" : ""}`}>
              <span className="flex items-center border-r border-dashed border-gray-400 bg-gray-50 px-3 font-bold text-gray-500">
                @
              </span>
              <input
                type="text"
                required
                readOnly={passwordVerified}
                value={recoveryHandle}
                onChange={(e) => setRecoveryHandle(e.target.value)}
                className="w-full bg-transparent px-3 py-2 outline-none"
                placeholder="가입 시 사용한 아이디"
              />
            </div>
          </label>
        )}

        {/* 아이디 찾기 / 비밀번호 찾기: 이메일 */}
        {(mode === "findHandle" || mode === "findPassword") && (
          <label className="text-sm">
            가입 시 사용한 이메일
            <input
              type="email"
              required
              readOnly={mode === "findPassword" && passwordVerified}
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              className={`mt-1 w-full border border-dashed border-gray-500 bg-white px-3 py-2 ${mode === "findPassword" && passwordVerified ? "opacity-60" : ""}`}
              placeholder="duck@example.com"
            />
          </label>
        )}

        {/* 아이디 찾기 결과 */}
        {mode === "findHandle" && foundHandle && (
          <div className="border border-dashed border-gray-400 bg-gray-50 p-3 text-sm">
            <p className="text-gray-500">찾은 아이디</p>
            <p className="mt-1 font-bold">@{foundHandle}</p>
          </div>
        )}

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

      {message && (
        <p className="border border-dashed border-gray-500 bg-white/70 p-3 text-sm">
          {message}
        </p>
      )}
    </main>
  );
}

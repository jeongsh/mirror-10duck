"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchUserNotificationSettings,
  upsertUserNotificationSettings,
  type UserNotificationSettings,
} from "@/lib/community/notifications";
import { useAuthUser } from "@/lib/supabase/useAuthUser";

export default function NotificationSettingsPage() {
  const authUser = useAuthUser();
  const userId = authUser?.id ?? null;
  const [settings, setSettings] = useState<UserNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof UserNotificationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const next = await fetchUserNotificationSettings(userId);
        if (!cancelled) setSettings(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "설정을 불러오지 못했어요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function toggle(key: keyof UserNotificationSettings) {
    if (!userId || !settings) return;
    setSaving(key);
    setError(null);
    try {
      const next = await upsertUserNotificationSettings(userId, {
        [key]: !settings[key],
      });
      setSettings(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했어요.");
    } finally {
      setSaving(null);
    }
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold">알림 설정</h1>
        <p className="mt-4 text-sm text-gray-500">
          로그인하면 알림 설정을 변경할 수 있어요.{" "}
          <Link href="/login" className="text-pink-600 underline">
            로그인
          </Link>
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold">알림 설정</h1>
        <p className="mt-4 text-sm text-gray-500">설정을 불러오는 중이에요.</p>
      </main>
    );
  }

  const current = settings ?? { notifications_enabled: true, live2d_bubble_enabled: true };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">알림 설정</h1>
        <Link href="/notifications" className="text-xs text-gray-500 underline">
          알림 목록
        </Link>
      </div>

      <section className="space-y-3">
        <SettingRow
          title="전체 알림"
          description="알림 목록, GNB 배지, Live2D 말풍선까지 모두 켜고 끕니다."
          enabled={current.notifications_enabled}
          busy={saving === "notifications_enabled"}
          onToggle={() => toggle("notifications_enabled")}
        />
        <SettingRow
          title="Live2D 말풍선"
          description="목록과 배지는 유지하고 캐릭터 말풍선만 끕니다."
          enabled={current.live2d_bubble_enabled}
          busy={saving === "live2d_bubble_enabled"}
          onToggle={() => toggle("live2d_bubble_enabled")}
          disabled={!current.notifications_enabled}
        />
      </section>

      {error && (
        <p className="mt-4 text-sm text-red-500">{error}</p>
      )}

      <p className="mt-6 text-xs text-gray-400">
        알림 종류별 켜기/끄기는 곧 별도 화면으로 제공할 예정입니다.
      </p>
    </main>
  );
}

function SettingRow({
  title,
  description,
  enabled,
  busy,
  onToggle,
  disabled,
}: {
  title: string;
  description: string;
  enabled: boolean;
  busy: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const isDisabled = busy || disabled;
  return (
    <div className="flex items-center justify-between gap-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        disabled={isDisabled}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          enabled && !disabled ? "bg-pink-500" : "bg-gray-300"
        } ${isDisabled ? "opacity-60" : ""}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

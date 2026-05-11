"use client";

import { useEffect, useState } from "react";
import { fetchModel3HitAreas, type ModelHitAreaEntry } from "@/lib/live2d/model3HitAreas";

export function ModelHitAreasDevPanel({
  profileId,
  modelPath,
  hitAreaMap,
}: {
  profileId: string;
  modelPath: string | null;
  hitAreaMap: { hitAreaId: string }[];
}) {
  const [modelHitAreas, setModelHitAreas] = useState<ModelHitAreaEntry[] | null>(null);
  const [modelHitAreasStatus, setModelHitAreasStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [modelHitAreasError, setModelHitAreasError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!modelPath) {
      setModelHitAreas(null);
      setModelHitAreasStatus("idle");
      setModelHitAreasError(null);
      return;
    }

    setModelHitAreasStatus("loading");
    setModelHitAreasError(null);
    void fetchModel3HitAreas(modelPath)
      .then((areas) => {
        if (!cancelled) {
          setModelHitAreas(areas);
          setModelHitAreasStatus("idle");
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setModelHitAreas(null);
          setModelHitAreasStatus("error");
          setModelHitAreasError(e instanceof Error ? e.message : String(e));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profileId, modelPath]);

  const modelHitAreaIds = new Set((modelHitAreas ?? []).map((h) => h.id));
  const orphanMappedHitIds = hitAreaMap
    .map((m) => m.hitAreaId)
    .filter((id) => modelHitAreas !== null && !modelHitAreaIds.has(id));

  return (
    <div className="border border-dotted border-amber-400/80 bg-amber-50/50 p-2 space-y-1.5">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-amber-900/80">
        [모델 원본 HitAreas · 개발용]
      </div>
      {!modelPath && (
        <div className="text-[11px] text-amber-900/70">modelPath 가 없어 원본을 읽을 수 없습니다.</div>
      )}
      {modelHitAreasStatus === "loading" && (
        <div className="text-[11px] text-amber-900/70">model3.json 불러오는 중…</div>
      )}
      {modelHitAreasStatus === "error" && (
        <div className="text-[11px] text-red-700">
          원본 목록을 읽지 못했습니다. {modelHitAreasError}
        </div>
      )}
      {modelHitAreasStatus !== "loading" && modelHitAreasStatus !== "error" && modelHitAreas && (
        <>
          <div className="text-[11px] text-amber-900/80">
            {modelHitAreas.length === 0 ? (
              <>
                HitAreas 가 없습니다. 런타임에서는{" "}
                <span className="font-semibold">전체 캔버스 클릭 폴백</span>으로 동작합니다.
              </>
            ) : (
              <>
                총 <span className="font-mono font-semibold">{modelHitAreas.length}</span>개 (히트
                영역 클릭 사용 가능)
              </>
            )}
          </div>
          {modelHitAreas.length > 0 && (
            <ul className="max-h-36 overflow-y-auto border border-dashed border-amber-300/60 bg-white/70 p-1.5 text-[10px] font-mono leading-relaxed text-gray-800">
              {modelHitAreas.map((h) => {
                const mapped = hitAreaMap.some((m) => m.hitAreaId === h.id);
                return (
                  <li key={h.id} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="text-gray-900">{h.id}</span>
                    {h.name !== h.id && (
                      <span className="text-gray-500 normal-case">({h.name})</span>
                    )}
                    <span
                      className={
                        mapped
                          ? "rounded bg-emerald-100 px-1 text-[9px] font-sans font-semibold uppercase text-emerald-800"
                          : "rounded bg-gray-200 px-1 text-[9px] font-sans font-semibold uppercase text-gray-600"
                      }
                    >
                      {mapped ? "매핑됨" : "미매핑"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      {orphanMappedHitIds.length > 0 && (
        <div className="text-[10px] text-red-700">
          프로필에만 있고 model3 에 없는 ID:{" "}
          <span className="font-mono">{orphanMappedHitIds.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

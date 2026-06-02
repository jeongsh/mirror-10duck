"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Film,
  HeartPulse,
  Leaf,
  PawPrint,
  Pill,
  Stethoscope,
} from "lucide-react";
import { resolveImageSrc } from "@/lib/imageDataUrl";
import type { ClinicCopyResult, DepartmentInfo, Diagnosis, Prescription } from "@/lib/clinic/types";

function PrescriptionCover({
  title,
  coverUrl,
  imageDataUrls,
  className = "",
}: {
  title: string;
  coverUrl?: string;
  imageDataUrls: Record<string, string>;
  className?: string;
}) {
  const src = resolveImageSrc(coverUrl, imageDataUrls);

  return (
    <div className={`overflow-hidden bg-gray-100 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} draggable={false} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Film className="h-7 w-7 text-gray-400" />
        </div>
      )}
    </div>
  );
}

function ClinicStamp() {
  return (
    <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-indigo-300 text-indigo-400">
      <div className="flex flex-col items-center justify-center text-center leading-none">
        <span className="text-[7px] font-black tracking-tight">과몰입 클리닉</span>
        <PawPrint className="my-1 h-5 w-5" />
        <span className="text-[7px] font-black tracking-tight">처방 완료</span>
      </div>
    </div>
  );
}

export default function PrescriptionResultCard({
  cardRef,
  department,
  diagnosis,
  prescriptions,
  keywords,
  immersionScore,
  avoidText,
  copyResult,
  coverByTitle,
  imageDataUrls,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  department: DepartmentInfo;
  diagnosis: Diagnosis;
  prescriptions: Prescription[];
  keywords: string[];
  immersionScore: number;
  avoidText: string;
  copyResult: ClinicCopyResult | null;
  coverByTitle: Record<string, string>;
  imageDataUrls: Record<string, string>;
}) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prescriptionDate = `${now.getFullYear()}.${mm}.${dd}`;
  const prescriptionNo = `A-${yy}${mm}${dd}`;
  const opinion = copyResult?.opinion ?? diagnosis.opinion;
  const warnings = copyResult?.warnings ?? [];

  return (
    <div
      ref={cardRef}
      className="w-full max-w-[580px] overflow-hidden rounded-[28px] border border-indigo-100 shadow-[0_18px_50px_rgba(99,102,241,0.18)]"
      style={{
        background:
          "radial-gradient(120% 60% at 80% -10%, #e6ebff 0%, transparent 55%), linear-gradient(180deg, #eef1fe 0%, #f6f4ff 38%, #ffffff 100%)",
      }}
    >
      <div className="border-b border-indigo-100/80 px-5 py-2 text-center">
        <p className="text-[10px] font-black tracking-widest text-indigo-400">과몰입 클리닉 처방전</p>
        <p className="text-[9px] font-bold text-gray-400">엔터테인먼트용 취향 진단 결과 · 실제 의료 조언이 아닙니다</p>
      </div>

      <div className="relative px-5 pt-5 pb-3">
        <div className="absolute right-4 top-4 h-24 w-24 rounded-full bg-indigo-200/40 blur-2xl" aria-hidden />
        <div className="relative flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white px-3 py-1 text-[11px] font-black text-indigo-500 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" />
              진단 완료!
            </span>
            <p className="mt-3 text-[13px] font-black text-gray-500">당신의 진단 결과</p>
            <h2 className="mt-1 text-2xl font-black leading-8 text-indigo-600">“{diagnosis.name}”</h2>
            <p className="mt-2 text-[12px] font-bold text-indigo-400">
              과몰입 수치 {immersionScore} / 100
            </p>
            <p className="mt-2 text-[13px] font-bold leading-6 text-gray-600">{diagnosis.summary}</p>
          </div>

          <div className="relative hidden h-[150px] w-[120px] shrink-0 sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/play/clinic-bg.png"
              alt=""
              aria-hidden
              className="pointer-events-none absolute -right-2 bottom-0 h-[130px] w-[110px] object-cover object-top opacity-90"
            />
            <div className="absolute bottom-0 left-0 w-[88px] rotate-[-6deg] rounded-xl border border-indigo-100 bg-white/95 p-2 shadow-sm">
              <p className="text-[11px] font-black text-indigo-500">Rx</p>
              <p className="mt-0.5 text-[9px] font-bold leading-3 text-gray-500">
                나루 원장
                <br />
                처방 완료
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-indigo-100 bg-white/80 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400">진단 소견</p>
          <p className="mt-1.5 whitespace-pre-line text-[12px] font-bold leading-6 text-gray-600">
            {opinion}
          </p>
        </div>

        {keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full border border-indigo-100 bg-white px-2.5 py-0.5 text-[10px] font-black text-indigo-500"
              >
                #{keyword}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mx-4 mb-4 rounded-3xl border border-indigo-100 bg-white px-4 py-5 shadow-sm">
        <div className="flex items-center justify-center gap-2">
          <Leaf className="h-4 w-4 -scale-x-100 text-indigo-300" />
          <h3 className="text-xl font-black tracking-[0.12em] text-indigo-600">애니 처방전</h3>
          <Leaf className="h-4 w-4 text-indigo-300" />
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-indigo-50/60 p-3">
          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 text-[11px] font-bold text-gray-600">
            <p>
              <span className="mr-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-500">
                환자명
              </span>
              익명의 시청자
            </p>
            <p>
              <span className="mr-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-500">
                진료 과목
              </span>
              {department.name}
            </p>
            <p>
              <span className="mr-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-500">
                진단명
              </span>
              {diagnosis.name}
            </p>
            <p>
              <span className="mr-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-500">
                처방 일자
              </span>
              {prescriptionDate}
            </p>
            <p className="col-span-2">
              <span className="mr-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-500">
                처방 번호
              </span>
              {prescriptionNo}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed border-indigo-200 text-indigo-300">
            <Stethoscope className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          {prescriptions.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-indigo-50 bg-white p-2.5 shadow-[0_2px_8px_rgba(99,102,241,0.06)]"
            >
              <div className="flex gap-2.5">
                <PrescriptionCover
                  title={item.title}
                  coverUrl={coverByTitle[item.title]}
                  imageDataUrls={imageDataUrls}
                  className="h-[68px] w-[52px] shrink-0 rounded-lg border border-indigo-100"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-indigo-500">
                    {item.slot} · {item.category}
                  </p>
                  <h4 className="mt-0.5 text-[15px] font-black text-gray-900">{item.title}</h4>
                  {item.matchedTags.length > 0 && (
                    <p className="mt-0.5 text-[10px] font-bold text-indigo-400">
                      {item.matchedTags.slice(0, 3).join(" · ")}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] font-bold leading-[1.45] text-gray-600">{item.effect}</p>
                  {item.warning && (
                    <p className="mt-1 text-[10px] font-black leading-4 text-amber-700">{item.warning}</p>
                  )}
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-2.5 py-2">
                  <p className="flex items-center gap-1 text-[10px] font-black text-indigo-500">
                    <Pill className="h-3 w-3 shrink-0" />
                    복용법
                  </p>
                  <p className="mt-1 text-[10px] font-bold leading-[1.45] text-gray-600">{item.dosage}</p>
                </div>
                <div className="rounded-xl border border-rose-100 bg-rose-50/50 px-2.5 py-2">
                  <p className="text-[10px] font-black text-rose-400">부작용</p>
                  <p className="mt-1 text-[10px] font-bold leading-[1.45] text-gray-600">{item.sideEffect}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {warnings
            .filter((w) => w.type === "금지약")
            .map((w) => (
              <p
                key={w.text}
                className="flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold leading-5 text-rose-700"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                금지약: {w.text}
              </p>
            ))}
          <p className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-5 text-amber-800">
            <HeartPulse className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            주의사항: {avoidText}
          </p>
          {warnings
            .filter((w) => w.type === "주의약" && !w.text.includes(avoidText.slice(0, 12)))
            .slice(0, 2)
            .map((w) => (
              <p
                key={w.text}
                className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-[11px] font-bold leading-5 text-indigo-700"
              >
                주의약: {w.text}
              </p>
            ))}
        </div>

        <div className="mt-4 flex items-end justify-end gap-3">
          <div className="flex shrink-0 flex-col items-center gap-1">
            <ClinicStamp />
            <span className="text-[13px] italic text-indigo-400" style={{ fontFamily: "cursive" }}>
              나루
            </span>
          </div>
        </div>
      </div>

      <div className="mx-4 mb-3 grid grid-cols-4 gap-2 rounded-2xl border border-indigo-100 bg-white px-2 py-3 shadow-sm">
        {[
          { Icon: Clock, label: "총 추천 시간", value: "약 34시간" },
          { Icon: HeartPulse, label: "몰입도", value: `${immersionScore}%` },
          { Icon: Pill, label: "처방 애니", value: `${prescriptions.length}종` },
          { Icon: ClipboardList, label: "맞춤 처방", value: "GOOD!" },
        ].map(({ Icon, label, value }) => (
          <div key={label} className="flex min-w-0 flex-col items-center gap-1 text-center">
            <Icon className="h-4 w-4 text-indigo-400" />
            <p className="text-[9px] font-black leading-3 text-gray-400">{label}</p>
            <p className="text-[11px] font-black text-indigo-500">{value}</p>
          </div>
        ))}
      </div>

      <p className="px-5 pb-5 text-center text-[11px] font-bold text-gray-400">
        나만의 애니 처방전, 소중한 사람에게도 공유해보세요 ✨
      </p>
    </div>
  );
}

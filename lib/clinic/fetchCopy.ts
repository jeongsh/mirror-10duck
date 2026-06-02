import type { ClinicCopyResult, DepartmentId, Diagnosis, Prescription } from "./types";

type ClinicCopyRequest = {
  departmentName: string;
  diagnosis: Diagnosis;
  prescriptions: Prescription[];
  allergies: string[];
  keywords: string[];
  immersionScore: number;
};

export async function fetchClinicCopy(body: ClinicCopyRequest): Promise<ClinicCopyResult | null> {
  try {
    const res = await fetch("/api/play/clinic-copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as ClinicCopyResult;
  } catch {
    return null;
  }
}

export type { ClinicCopyRequest, DepartmentId };

import { invoke } from "@tauri-apps/api/core";

export interface StudentOdRecord {
  slNo: number;
  odType: string;
  reason: string;
  basis: string;
  date: string;
  time: string;
  remarks: string;
}

export interface StudentOdDetails {
  totalCount: number;
  records: StudentOdRecord[];
  semesterId: string;
}

export interface OdResponse {
  success: boolean;
  data?: StudentOdDetails;
  error?: string;
}

export async function getStudentOdDetails(semesterSubId?: string): Promise<OdResponse> {
  try {
    return await invoke<OdResponse>("od_get_student_details", {
      semesterSubId,
    });
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

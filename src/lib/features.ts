import { invoke } from "@tauri-apps/api/core";

export type AssessmentMark = {
  slNo: number;
  markTitle: string;
  maxMark: number;
  weightagePercent: number;
  status: string;
  scoredMark: number;
  weightageMark: number;
  classAverage: string;
  remark: string;
};

export type StudentMarkEntry = {
  slNo: number;
  classNumber: string;
  courseCode: string;
  courseTitle: string;
  courseType: string;
  courseSystem: string;
  faculty: string;
  slot: string;
  courseMode: string;
  assessments: AssessmentMark[];
};

export type CalendarMonthOption = {
  label: string;
  dateValue: string;
};

export type CalendarDay = {
  date: number;
  content: string[];
};

export type MonthlySchedule = {
  month: string;
  days: CalendarDay[];
};

export type MessType =
  | "Veg-mens"
  | "Non-Veg-mens"
  | "Special-mens"
  | "Veg-womens"
  | "Non-Veg-womens"
  | "Special-womens";

export type LaundryBlock = "A" | "B" | "CB" | "CG" | "D1" | "D2" | "E";

export type MessMenuItem = {
  id: number;
  day: string;
  breakfast: string;
  lunch: string;
  snacks: string;
  dinner: string;
};

export type LaundryEntry = {
  id: number;
  date: string;
  roomNumber: string | null;
};

export type TimetableCourseCredits = {
    lecture: number;
    tutorial: number;
    practical: number;
    project: number;
    total: number;
};

export type TimetableCourse = {
  slNo: number;
  classGroup: string;
  code: string;
  title: string;
  courseType: string;
  credits: TimetableCourseCredits;
  category: string;
  registrationOption: string;
  classId: string;
  slot: string;
  venue: string;
  faculty: { name: string; school: string };
  registrationDate: string;
  status: string;
};

export type ScheduleEntry = {
    day: string;
    startTime: string;
    endTime: string;
    courseCode: string;
    courseTitle: string;
    courseType: string;
    slot: string;
    venue: string;
    faculty: string;
};

export type WeeklySchedule = {
    monday: ScheduleEntry[];
    tuesday: ScheduleEntry[];
    wednesday: ScheduleEntry[];
    thursday: ScheduleEntry[];
    friday: ScheduleEntry[];
    saturday: ScheduleEntry[];
    sunday: ScheduleEntry[];
};

export type ContactDetail = {
  department: string;
  description: string;
  email: string;
};

export type Receipt = {
  receiptNumber: string;
  date: string;
  amount: number;
  campusCode: string;
  receiptId: string;
  applNo: string;
  regNo: string;
};

export type CurriculumCategory = {
  code: string;
  name: string;
  credits: number;
  maxCredits: number;
};

export type CurriculumCourse = {
  serialNo: number;
  code: string;
  title: string;
  courseType: string;
  credits: number;
};

export type StudentDetails = {
    name: string;
    registerNumber: string;
    applicationNumber: string;
    program: string;
    dob: string;
    gender: string;
    mobile: string;
    vitEmail: string;
    personalEmail: string;
    photoUrl: string;
};

export type ProctorDetails = {
    facultyId: string;
    name: string;
    designation: string;
    school: string;
    cabin: string;
    mobile: string;
    email: string;
    photoUrl: string;
};

export type HostelDetails = {
    blockName: string;
    roomNumber: string;
    bedType: string;
    messType: string;
};

export type ProfileData = {
    student: StudentDetails;
    proctor: ProctorDetails;
    hostel: HostelDetails;
};

export type StudentProfile = {
    regNo: string;
    name: string;
    programme: string;
    gender: string;
    yearJoined: string;
    school: string;
    campus: string;
};

export type CourseGrade = {
    slNo: number;
    courseCode: string;
    courseTitle: string;
    courseType: string;
    credits: number;
    grade: string;
    examMonth: string;
    resultDeclared: string;
    courseDistribution: string;
};

export type CurriculumCategoryGrade = {
    category: string;
    creditsRequired: number;
    creditsEarned: number;
    completionStatus: string;
};

export type GradeDistribution = {
    s: number;
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
    n: number;
};

export type CGPADetails = {
    creditsRegistered: number;
    creditsEarned: number;
    cgpa: number;
    gradeDistribution: GradeDistribution;
};

export type StudentHistoryData = {
    profile: StudentProfile;
    grades: CourseGrade[];
    curriculum: {
        details: CurriculumCategoryGrade[];
        summary: {
            totalRequired: number;
            totalEarned: number;
        };
    };
    cgpa: CGPADetails;
};

export type FeedbackStatus = {
    type: string;
    midSemester: string;
    teeSemester: string;
};

type ApiResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getFeedbackStatus(): Promise<ApiResult<FeedbackStatus[]>> {
    try {
        return await invoke<ApiResult<FeedbackStatus[]>>("feedback_get_status");
    } catch (err: unknown) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export async function getMarks(
  semesterSubId?: string,
): Promise<ApiResult<StudentMarkEntry[]>> {
  try {
    return await invoke<ApiResult<StudentMarkEntry[]>>(
      "marks_get_student_mark_view",
      {
        semesterSubId,
      },
    );
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getAcademicCalendarOptions(): Promise<
  ApiResult<CalendarMonthOption[]>
> {
  try {
    return await invoke<ApiResult<CalendarMonthOption[]>>(
      "academic_calendar_get",
    );
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getAcademicCalendarView(
  calDate: string,
): Promise<ApiResult<MonthlySchedule>> {
  try {
    return await invoke<ApiResult<MonthlySchedule>>(
      "academic_calendar_get_view",
      { calDate },
    );
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getMessMenu(
  messType: MessType,
): Promise<ApiResult<MessMenuItem[]>> {
  try {
    return await invoke<ApiResult<MessMenuItem[]>>("mess_get_menu", {
      messType,
    });
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getLaundrySchedule(
  block: LaundryBlock,
): Promise<ApiResult<LaundryEntry[]>> {
  try {
    return await invoke<ApiResult<LaundryEntry[]>>("laundry_get_schedule", {
      block,
    });
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getTimetableCourses(
  semesterSubId?: string,
): Promise<ApiResult<TimetableCourse[]>> {
  try {
    return await invoke<ApiResult<TimetableCourse[]>>("timetable_get_courses", {
      semesterSubId,
    });
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getTimetableWeekly(
    semesterSubId?: string,
): Promise<ApiResult<WeeklySchedule>> {
    try {
        return await invoke<ApiResult<WeeklySchedule>>("timetable_get_weekly", {
            semesterSubId,
        });
    } catch (err: unknown) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export async function getContactInfo(): Promise<ApiResult<ContactDetail[]>> {
  try {
    return await invoke<ApiResult<ContactDetail[]>>("contact_info_get");
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getPaymentReceipts(): Promise<ApiResult<Receipt[]>> {
  try {
    return await invoke<ApiResult<Receipt[]>>("payment_receipts_get");
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getCurriculumCategories(): Promise<
  ApiResult<CurriculumCategory[]>
> {
  try {
    return await invoke<ApiResult<CurriculumCategory[]>>("curriculum_get");
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getCurriculumCategoryCourses(
  categoryId: string,
): Promise<ApiResult<CurriculumCourse[]>> {
  try {
    return await invoke<ApiResult<CurriculumCourse[]>>(
      "curriculum_get_category_view",
      {
        categoryId,
      },
    );
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getStudentProfile(): Promise<ApiResult<ProfileData>> {
    try {
        return await invoke<ApiResult<ProfileData>>("profile_get_student_profile");
    } catch (err: unknown) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export async function getGradesHistory(): Promise<ApiResult<StudentHistoryData>> {
    try {
        return await invoke<ApiResult<StudentHistoryData>>("grades_get_history");
    } catch (err: unknown) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export interface SyllabusData {
  filename: string;
  savePath: string;
  contentBase64?: string;
}

export type SyllabusResponse = ApiResult<SyllabusData>;

export async function downloadCurriculumSyllabus(
  courseCode: string,
): Promise<SyllabusResponse> {
  try {
    return await invoke<SyllabusResponse>("curriculum_download_syllabus", {
      courseCode,
    });
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}


export interface HodDeanDetail {
  role: string;
  name: string;
  school: string;
  cabin: string;
  email: string;
  intercom: string;
  photo: string;
}

export async function getHodDeanDetails(): Promise<ApiResult<HodDeanDetail[]>> {
  try {
    return await invoke<ApiResult<HodDeanDetail[]>>("hod_dean_details_get");
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type SemesterGradeEntry = {
  slNo: number;
  courseCode: string;
  courseTitle: string;
  courseType: string;
  credits: {
    l: number;
    p: number;
    j: number;
    c: number;
  };
  gradingType: string;
  grandTotal?: number;
  grade: string;
  courseId?: string;
};

export type SemesterOption = {
  id: string;
  name: string;
};

export type SemesterGradeViewData = {
  semesterSubId: string;
  semesters: SemesterOption[];
  gpa?: number;
  grades: SemesterGradeEntry[];
};

export async function getStudentGradeView(
  semesterSubId?: string
): Promise<ApiResult<SemesterGradeViewData>> {
  try {
    return await invoke<ApiResult<SemesterGradeViewData>>("grades_get_student_grade_view", {
      semesterSubId: semesterSubId || null,
    });
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}


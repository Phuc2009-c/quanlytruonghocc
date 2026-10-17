"use server";

import prisma from "@/lib/prisma";
import { aiChatCompletion } from "@/lib/ai-provider";
import { getTenantContext } from "@/lib/tenant";

// Get daily summary stats for a specific date (scoped to tenant school)
export async function getDailySummaryStats(date: string) {
  const ctx = await getTenantContext();
  const schoolId = ctx.schoolId;

  const dateObj = new Date(date);
  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateObj);
  endOfDay.setHours(23, 59, 59, 999);

  // Total students for this school
  const totalStudents = await prisma.student.count({
    where: {
      status: "STUDYING",
      ...(schoolId ? { classRoom: { schoolId } } : {}),
    },
  });

  // Attendance stats (distinct students per day within this school)
  const absentExcusedList = await prisma.attendance.findMany({
    where: {
      date: { gte: startOfDay, lte: endOfDay },
      status: "ABSENT_EXCUSED",
      ...(schoolId ? { classRoom: { schoolId } } : {}),
    },
    select: { studentId: true },
    distinct: ["studentId"],
  });

  const absentUnexcusedList = await prisma.attendance.findMany({
    where: {
      date: { gte: startOfDay, lte: endOfDay },
      status: "ABSENT_UNEXCUSED",
      ...(schoolId ? { classRoom: { schoolId } } : {}),
    },
    select: { studentId: true },
    distinct: ["studentId"],
  });

  const absentExcused = absentExcusedList.length;
  const absentUnexcused = absentUnexcusedList.length;
  const totalAbsent = absentExcused + absentUnexcused;

  // Teacher substitute assignments
  const substitutes = await prisma.substituteAssignment.findMany({
    where: {
      date: { gte: startOfDay, lte: endOfDay },
    },
  });
  const teacherAbsences = substitutes.length;
  const approvedSubs = substitutes.filter((s) => s.status === "APPROVED" || s.status === "COMPLETED").length;

  return {
    date: dateObj.toLocaleDateString("vi-VN"),
    totalStudents,
    totalAbsent,
    absentWithReason: absentExcused,
    absentNoReason: absentUnexcused,
    teacherAbsences,
    substituteFulfilled: `${approvedSubs}/${teacherAbsences} (${teacherAbsences > 0 ? Math.round((approvedSubs / teacherAbsences) * 100) : 100}%)`,
  };
}

// Get school point stats for a specific date (scoped to tenant school)
export async function getSchoolPointStats(date: string) {
  const ctx = await getTenantContext();
  const schoolId = ctx.schoolId;

  const dateObj = new Date(date);
  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateObj);
  endOfDay.setHours(23, 59, 59, 999);

  const schoolPoints = await prisma.schoolPoint.findMany({
    where: schoolId ? { campus: { schoolId } } : {},
    include: {
      campus: true,
      classRooms: {
        include: {
          students: { where: { status: "STUDYING" } },
          attendances: { where: { date: { gte: startOfDay, lte: endOfDay } } },
          incidents: { where: { date: { gte: startOfDay, lte: endOfDay } } },
        },
      },
    },
    orderBy: { distanceKm: "asc" },
  });

  // Get substitute assignments for each school point
  const substitutes = await prisma.substituteAssignment.findMany({
    where: { date: { gte: startOfDay, lte: endOfDay } },
  });

  return await Promise.all(
    schoolPoints.map(async (sp) => {
      const totalStudents = sp.classRooms.reduce((sum, c) => sum + c.students.length, 0);
      const spClassIds = sp.classRooms.map((c) => c.id);

      const absentStudentsInSp = await prisma.attendance.findMany({
        where: {
          classId: { in: spClassIds },
          date: { gte: startOfDay, lte: endOfDay },
          status: { in: ["ABSENT_EXCUSED", "ABSENT_UNEXCUSED"] },
        },
        select: { studentId: true },
        distinct: ["studentId"],
      });

      const absent = absentStudentsInSp.length;
      const present = Math.max(0, totalStudents - absent);
      const presentRate = totalStudents > 0 ? ((present / totalStudents) * 100).toFixed(1) + "%" : "N/A";

      const incidents = sp.classRooms.reduce((sum, c) => sum + c.incidents.length, 0);

      const pointSubs = substitutes.filter((s) => s.schoolPointName === sp.name);
      const subNote = pointSubs.length > 0
        ? `${pointSubs.filter((s) => s.status === "APPROVED" || s.status === "COMPLETED").length}/${pointSubs.length} ca`
        : "Không có";

      return {
        id: sp.id,
        name: sp.name,
        campusName: sp.campus.name,
        distanceKm: sp.distanceKm ?? 0,
        manager: sp.managerName || "Chưa phân công",
        managerName: sp.managerName || "Chưa phân công",
        phone: sp.phone || "N/A",
        classesCount: sp.classRooms.length,
        studentsCount: totalStudents,
        presentCount: present,
        absentCount: absent,
        presentRate,
        incidents,
        weatherStatus: sp.distanceKm && sp.distanceKm > 10 ? "Sương mù / Mưa nhẹ" : "Bình thường",
        substituteNote: subNote,
        note: sp.distanceKm && sp.distanceKm > 10 ? "Lưu ý an toàn đường đèo dốc mùa mưa lũ" : "",
      };
    })
  );
}

// Generate AI briefing for a specific phase
export async function generateAIBriefing(date: string, phase: "MORNING" | "MIDDAY" | "EVENING") {
  const stats = await getDailySummaryStats(date);
  const pointStats = await getSchoolPointStats(date);

  const pointContext = pointStats.map((p) =>
    `- Điểm ${p.name} [id=${p.id}] (${p.distanceKm}km): ${p.studentsCount} HS, tỷ lệ hiện diện ${p.presentRate}, ${p.incidents} sự cố, dạy thay: ${p.substituteNote}`
  ).join("\n");

  const phaseLabels = {
    MORNING: "Pha 1 - Đầu ca Sáng (07:30): Điểm danh, chuyên cần, điều chuyển dạy thay",
    MIDDAY: "Pha 2 - Giữa ngày (11:30): Tiến độ bài học, sổ đầu bài điện tử, sự cố",
    EVENING: "Pha 3 - Báo cáo điều hành cuối ngày Ban Giám hiệu: Tổng kết toàn diện các điểm trường",
  };

  const prompt = `Bạn là trợ lý AI tổng hợp báo cáo điều hành cho Hiệu trưởng trường phổ thông đa phân hiệu / điểm trường.

NGÀY BÁO CÁO: ${stats.date}
PHA BÁO CÁO: ${phaseLabels[phase]}

TỔNG QUAN:
- Tổng học sinh: ${stats.totalStudents}
- Vắng mặt: ${stats.totalAbsent} (có phép: ${stats.absentWithReason}, không phép: ${stats.absentNoReason})
- GV vắng & điều chuyển: ${stats.teacherAbsences} GV, hoàn thành: ${stats.substituteFulfilled}

CHI TIẾT TỪNG ĐIỂM TRƯỜNG:
${pointContext}

YÊU CẦU:
1. Viết báo cáo theo đúng phong cách hành chính giáo dục Việt Nam, ngắn gọn, súc tích (dưới 400 từ).
2. Nêu rõ nhận định dựa trên số liệu thực tế, viện dẫn tên và mã điểm trường khi đánh giá.
3. Nếu điểm trường nào có tỷ lệ vắng cao hoặc sự cố, hãy cảnh báo cụ thể.`;

  const aiRes = await aiChatCompletion({ prompt, max_tokens: 1500 });
  if (!aiRes.success) {
    return { success: false, text: null, error: aiRes.error };
  }
  return { success: true, text: aiRes.text, error: null };
}

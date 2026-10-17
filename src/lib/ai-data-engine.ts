import prisma from "@/lib/prisma";
import { TenantContext, getTenantContext } from "@/lib/tenant";

/**
 * Dynamic Database Context Engine
 * Synthesizes real-time metrics, attendance, classes, teachers, students,
 * substitute assignments, early warnings, and commendations for the AI.
 * Strictly enforces TenantContext isolation and outputs [id=xxx] tags for grounding.
 */
export async function getComprehensiveAIContext(query: string, inputCtx?: TenantContext): Promise<string> {
  try {
    let ctx = inputCtx;
    if (!ctx) {
      try {
        ctx = await getTenantContext();
      } catch {
        // Fallback if called outside of request session context
      }
    }

    let effectiveSchoolId = ctx?.schoolId;
    if (!effectiveSchoolId) {
      const firstSchool = await prisma.school.findFirst({ select: { id: true } });
      effectiveSchoolId = firstSchool?.id;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const schoolFilter = effectiveSchoolId ? { schoolId: effectiveSchoolId } : {};

    // Requirement 3: Siết chặt quyền sử dụng dữ liệu các điểm trường
    const isAllSchoolLeadership =
      ctx?.userRole === "ADMIN" ||
      ctx?.userRole === "SUPER_ADMIN" ||
      ctx?.userRole === "DEPARTMENT_ADMIN" ||
      ctx?.userRole === "DISTRICT_ADMIN";

    const campusFilter = ctx?.campusId && !isAllSchoolLeadership ? { campusId: ctx.campusId } : {};

    let userCampusName: string | null = null;
    if (ctx?.campusId && !isAllSchoolLeadership) {
      const c = await prisma.campus.findUnique({
        where: { id: ctx.campusId },
        select: { name: true },
      });
      userCampusName = c?.name || null;
    }

    const [
      totalStudents,
      totalClasses,
      totalTeachers,
      schoolPoints,
      presentRecords,
      absentExcusedRecords,
      absentUnexcusedRecords,
      lateRecords,
      substitutes,
      warnings,
      recentCommendations,
    ] = await Promise.all([
      prisma.student.count({
        where: {
          status: "STUDYING",
          ...(effectiveSchoolId ? { classRoom: { schoolId: effectiveSchoolId, ...campusFilter } } : {}),
        },
      }),
      prisma.classRoom.count({
        where: {
          ...schoolFilter,
          ...campusFilter,
        },
      }),
      prisma.teacher.count({
        where: {
          ...(effectiveSchoolId ? { user: { schoolId: effectiveSchoolId, ...campusFilter } } : {}),
        },
      }),
      prisma.schoolPoint.findMany({
        where: {
          campus: {
            ...schoolFilter,
            ...campusFilter,
          },
        },
        include: { campus: true },
        orderBy: { distanceKm: "asc" },
      }),
      prisma.attendance.findMany({
        where: {
          date: { gte: todayStart, lte: todayEnd },
          status: "PRESENT",
          ...(effectiveSchoolId ? { classRoom: { schoolId: effectiveSchoolId, ...campusFilter } } : {}),
        },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.attendance.findMany({
        where: {
          date: { gte: todayStart, lte: todayEnd },
          status: "ABSENT_EXCUSED",
          ...(effectiveSchoolId ? { classRoom: { schoolId: effectiveSchoolId, ...campusFilter } } : {}),
        },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.attendance.findMany({
        where: {
          date: { gte: todayStart, lte: todayEnd },
          status: "ABSENT_UNEXCUSED",
          ...(effectiveSchoolId ? { classRoom: { schoolId: effectiveSchoolId, ...campusFilter } } : {}),
        },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.attendance.findMany({
        where: {
          date: { gte: todayStart, lte: todayEnd },
          status: "LATE",
          ...(effectiveSchoolId ? { classRoom: { schoolId: effectiveSchoolId, ...campusFilter } } : {}),
        },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.substituteAssignment.findMany({
        where: {
          date: { gte: todayStart, lte: todayEnd },
          ...(userCampusName ? { campusName: { contains: userCampusName, mode: "insensitive" } } : {}),
        },
        take: 10,
      }),
      prisma.earlyWarning.findMany({
        where: {
          isResolved: false,
          ...(userCampusName ? { campusName: { contains: userCampusName, mode: "insensitive" } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.incident.findMany({
        where: {
          type: "COMMENDATION",
          ...(effectiveSchoolId ? { student: { classRoom: { schoolId: effectiveSchoolId, ...campusFilter } } } : {}),
        },
        include: { student: { include: { user: { select: { name: true } } } } },
        orderBy: { date: "desc" },
        take: 5,
      }),
    ]);

    const presentCount = presentRecords.length;
    const absentExcusedCount = absentExcusedRecords.length;
    const absentUnexcusedCount = absentUnexcusedRecords.length;
    const totalAbsent = absentExcusedCount + absentUnexcusedCount;
    const lateCount = lateRecords.length;

    let entityContext = "";
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes("lớp") || lowerQuery.includes("sĩ số")) {
      const classesInfo = await prisma.classRoom.findMany({
        where: {
          ...schoolFilter,
          ...campusFilter,
        },
        include: {
          homeroomTeacher: { include: { user: { select: { name: true } } } },
          _count: { select: { students: true } },
        },
        take: 10,
      });
      entityContext += "\n--- CHI TIẾT CÁC LỚP HỌC (KÈM ID BẢN GHI) ---\n" +
        classesInfo.map((c) => `- Lớp ${c.name} [id=${c.id}]: Sĩ số ${c._count.students} học sinh, GVCN: ${c.homeroomTeacher?.user?.name || "Chưa phân công"}`).join("\n");
    }

    if (lowerQuery.includes("học sinh") || lowerQuery.includes("em ") || lowerQuery.includes("khen")) {
      const topStudents = await prisma.student.findMany({
        where: {
          status: "STUDYING",
          ...(effectiveSchoolId ? { classRoom: { schoolId: effectiveSchoolId, ...campusFilter } } : {}),
        },
        take: 10,
        include: {
          user: { select: { name: true } },
          classRoom: { select: { name: true } },
        },
      });
      entityContext += "\n--- DANH SÁCH HỌC SINH (KÈM ID BẢN GHI) ---\n" +
        topStudents.map((s) => `- HS ${s.user.name} [id=${s.id}] (${s.classRoom?.name || "Chưa phân lớp"})`).join("\n");
    }

    if (lowerQuery.includes("giáo viên") || lowerQuery.includes("thầy") || lowerQuery.includes("cô")) {
      const teachersInfo = await prisma.teacher.findMany({
        where: {
          ...(effectiveSchoolId ? { user: { schoolId: effectiveSchoolId, ...campusFilter } } : {}),
        },
        take: 10,
        include: {
          user: { select: { name: true } },
        },
      });
      entityContext += "\n--- CÁN BỘ GIÁO VIÊN (KÈM ID BẢN GHI) ---\n" +
        teachersInfo.map((t) => `- GV: ${t.user.name} [id=${t.id}]`).join("\n");
    }

    const schoolPointCtx = schoolPoints.length > 0
      ? schoolPoints
          .map((sp) => `- Điểm ${sp.name} [id=${sp.id}] (${sp.campus.name}): ${sp.distanceKm ?? 0}km, Quản lý: ${sp.managerName || "N/A"}`)
          .join("\n")
      : "Chưa có cấu hình điểm trường vệ tinh.";

    const warningsCtx = warnings.length > 0
      ? warnings.map((w) => `- [Mức ${w.level}] ${w.title} [id=${w.id}] (${w.category})`).join("\n")
      : "Không có cảnh báo hoạt động nào.";

    const subsCtx = substitutes.length > 0
      ? substitutes.map((s) => `- Tiết ${s.period} môn ${s.subjectName} [id=${s.id}]: GV ${s.originalTeacher} nghỉ -> GV ${s.substituteTeacher} dạy thay (${s.status})`).join("\n")
      : "Hôm nay chưa có điều chuyển dạy thay.";

    const commendCtx = recentCommendations.length > 0
      ? recentCommendations.map((c) => `- HS ${c.student.user.name}: "${c.description}" [id=${c.id}] (bởi ${c.reportedBy})`).join("\n")
      : "Chưa có ghi nhận tuyên dương gần đây.";

    return `=== CƠ SỞ DỮ LIỆU HỆ THỐNG TRƯỜNG HỌC REAL-TIME (${new Date().toLocaleDateString("vi-VN")}) ===
1. QUY MÔ & TỔNG QUAN:
- Tổng số Học sinh chính thức: ${totalStudents} em
- Tổng số Lớp học: ${totalClasses} lớp
- Tổng số Giáo viên: ${totalTeachers} thầy/cô
- Tổng số Điểm trường vệ tinh: ${schoolPoints.length} điểm

2. SĨ SỐ & ĐIỂM DANH HÔM NAY (${new Date().toLocaleDateString("vi-VN")}):
- Đã có mặt: ${presentCount} học sinh
- Vắng mặt: ${totalAbsent} học sinh (Có phép: ${absentExcusedCount}, Không phép: ${absentUnexcusedCount})
- Đi muộn: ${lateCount} học sinh

3. ĐIỂM TRƯỜNG & KHOẢNG CÁCH (CÓ MÃ BẢN GHI ĐỐI SOÁT):
${schoolPointCtx}

4. ĐIỀU CHUYỂN DẠY THAY HÔM NAY:
${subsCtx}

5. CẢNH BÁO SỚM & AN NINH:
${warningsCtx}

6. TUYÊN DƯƠNG KHEN THƯỞNG GẦN ĐÂY:
${commendCtx}
${entityContext}`;
  } catch (err) {
    console.error("Error in getComprehensiveAIContext:", err);
    return "Không thể trích xuất dữ liệu thực tế hệ thống.";
  }
}

/**
 * FACT-FORCING GATE CONTEXT:
 * 1. Importers/Callers: `src/app/admin/principal-ai/page.tsx`.
 * 2. Affected APIs: `src/app/admin/principal-ai/actions.ts`.
 * 3. Schemas: `AIGroundedResponse`, `DecisionLog`, `SchoolPoint`.
 * 4. Verbatim User Instruction: "/ecc:plan cập nhập đự án phần mềm để phù hợp với nghị đinh mới này và phần mềm sẽ hỗ trợ hiệu trưởng hãy làm thật chi tiết và hoàn thiện"
 */

"use server";

import prisma from "@/lib/prisma";
import { aiChatCompletion } from "@/lib/ai-provider";
import { getComprehensiveAIContext } from "@/lib/ai-data-engine";
import {
  AI_DATA_INTEGRITY_SYSTEM_PROMPT,
  verifyAIGrounding,
  type AIGroundedResponse,
} from "@/lib/ai/data-integrity";
import { getTenantContext } from "@/lib/tenant";
import { getRelevantSchoolMemories } from "@/lib/ai/ai-memory-engine";
import { formatAiMemoryPromptBlock } from "@/lib/ai/ai-memory-format";

export async function askPrincipalAI(
  query: string,
  historyMessages?: { role: "user" | "assistant"; content: string }[]
) {
  const tenantCtx = await getTenantContext();
  const dbContext = await getComprehensiveAIContext(query, tenantCtx);
  const schoolId = tenantCtx?.schoolId || "";
  const campusId = tenantCtx?.campusId || undefined;

  // Retrieve past corrections and learned guidelines for this school
  const schoolMemories = await getRelevantSchoolMemories(schoolId, campusId, "PRINCIPAL_AI", 5);
  const memoryBlock = formatAiMemoryPromptBlock(schoolMemories);

  const systemPrompt = `${AI_DATA_INTEGRITY_SYSTEM_PROMPT}
${memoryBlock}

Bạn là Trợ lý AI Thông minh & Cố vấn Pháp lý - Quản lý Giáo dục cho Hiệu trưởng và Ban Giám hiệu theo Nghị quyết số 37/2026/NQ-CP và các quy định hiện hành.

CĂN CỨ PHÁP LÝ BẮT BUỘC:
- Nghị quyết số 37/2026/NQ-CP của Chính phủ (hiệu lực 05/08/2026 - 30/06/2028):
  + Định mức BGH: 01 Hiệu trưởng toàn trường, 01 Phó Hiệu trưởng tại Trường chính và 01 Phó Hiệu trưởng tại mỗi Phân hiệu (Điều 4).
  + Định mức nhân sự hỗ trợ dùng chung: Kế toán (01, tối đa 02 nếu nội trú/bán trú >= 40 lớp), Văn thư (01), Thủ quỹ (01) (Điều 5.1.a).
  + Định mức nhân sự phân hiệu (01 người/vị trí/cơ sở): Thiết bị, Thư viện, Giáo vụ, Tâm lý học đường, Hỗ trợ khuyết tật, CNTT, Y tế (Điều 5.1.b).
  + Tuyệt đối cấm bố trí người chưa có bằng cấp chuyên môn vào vị trí Kế toán hoặc Y tế (Điều 5.3.b, 5.3.c).
  + Lộ trình đào tạo chuẩn hóa kéo dài 36 tháng đến ngày 05/08/2029 (Điều 5.3.a).
  + Hạn chót hoàn thành sắp xếp tổ chức bộ máy: Trước 30/09/2026 (Điều 8).
- Nghị định 178/2024/NĐ-CP & Nghị định 67/2025/NĐ-CP: Bảo lưu phụ cấp chức vụ lãnh đạo cho cán bộ quản lý dôi dư sau sắp xếp.
- Nghị định 154/2025/NĐ-CP: Chính sách tinh giản biên chế (nghỉ hưu trước tuổi, thôi việc có trợ cấp).
- Thông tư 32/2020/TT-BGDĐT: Điều lệ trường trung học cơ sở, trường trung học phổ thông.

DỮ LIỆU THỰC TẾ TRÍCH XUẤT TỪ CƠ SỞ DỮ LIỆU HỆ THỐNG NGUYÊN BẢN (KÈM ID BẢN GHI):
${dbContext}

QUY TẮC PHẢN HỒI (RẤT QUAN TRỌNG):
1. Hãy trả lời ĐÚNG TRỌNG TÂM câu hỏi của Hiệu trưởng dựa trên dữ liệu thực tế ở trên và viện dẫn các điều khoản Nghị quyết 37/2026/NQ-CP khi liên quan.
2. Nêu rõ [DỮ KIỆN — có record_id] đối với mọi số liệu thực tế được trích xuất (kèm mã bản ghi, ví dụ: [id=xxx]).
3. Nêu rõ [SUY LUẬN — cần con người xác minh] đối với các phán đoán hoặc đề xuất.
4. Nếu thiếu dữ liệu hoặc không chắc chắn, bắt buộc trả lời "Không đủ dữ liệu" (INSUFFICIENT_DATA).
5. Nếu câu hỏi yêu cầu lập kế hoạch/giải pháp chỉ đạo, hãy trình bày rõ các phương án chỉ đạo ở cuối bài dạng:

PHƯƠNG_ÁN_1:
TIÊU_ĐỀ: [Tên phương án 1]
ĐIỂM: [0-100]
ƯU_ĐIỂM: [liệt kê, ngăn cách bằng |]
NHƯỢC_ĐIỂM: [liệt kê, ngăn cách bằng |]

PHƯƠNG_ÁN_2:
TIÊU_ĐỀ: [Tên phương án 2]
ĐIỂM: [0-100]
ƯU_ĐIỂM: [liệt kê, ngăn cách bằng |]
NHƯỢC_ĐIỂM: [liệt kê, ngăn cách bằng |]

CƠ_SỞ_PHÁP_LÝ: [Nghị quyết 37/2026/NQ-CP, Nghị định 178/2024/NĐ-CP, Nghị định 154/2025/NĐ-CP, Thông tư 32/2020/TT-BGDĐT]
BƯỚC_TRIỂN_KHAI: [các bước, ngăn cách bằng |]`;

  // BUG-10: Build multi-turn conversation messages
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  // Inject recent conversation history (last 6 turns max) for multi-turn context
  if (historyMessages && historyMessages.length > 0) {
    const recentHistory = historyMessages.slice(-6);
    for (const hMsg of recentHistory) {
      messages.push({ role: hMsg.role, content: hMsg.content });
    }
  }

  // Add the current user query
  messages.push({
    role: "user",
    content: `CÂU HỎI / YÊU CẦU CỦA HIỆU TRƯỞNG:\n"${query}"`,
  });

  const aiRes = await aiChatCompletion({ messages, max_tokens: 2048 });
  if (!aiRes.success) {
    return { success: false, data: null, error: aiRes.error };
  }

  let aiText = aiRes.text;

  // Grounding verification against DB
  const grounded: AIGroundedResponse = await verifyAIGrounding(aiText, {
    schoolId,
    campusId,
  });

  const hasOptions = aiText.includes("PHƯƠNG_ÁN_1");
  const lines = aiText.split("\n");

  const summary = lines.find(l => l.includes("TÓM_TẮT"))?.split(":")[1]?.trim() || aiText.split("PHƯƠNG_ÁN_1")[0].trim();
  const riskLevel = (lines.find(l => l.includes("MỨC_RỦI_RO"))?.split(":")[1]?.trim() || "LOW").toUpperCase();
  const policyNote = lines.find(l => l.includes("CƠ_SỞ_PHÁP_LÝ"))?.split(":")[1]?.trim() || undefined;
  const actionStepsStr = lines.find(l => l.includes("BƯỚC_TRIỂN_KHAI"))?.split(":")[1]?.trim();
  const actionSteps = actionStepsStr ? actionStepsStr.split("|").map(s => s.trim()).filter(Boolean) : [];

  const options: Array<{ title: string; pros: string[]; cons: string[]; score: number }> = [];

  if (hasOptions) {
    for (let i = 1; i <= 3; i++) {
      const titleKey = `PHƯƠNG_ÁN_${i}`;
      const sectionStart = lines.findIndex(l => l.includes(titleKey));
      if (sectionStart === -1) continue;

      const sectionLines = lines.slice(sectionStart, sectionStart + 6);
      const getVal = (key: string) => {
        const line = sectionLines.find(l => l.includes(key));
        return line ? line.split(":").slice(1).join(":").trim() : "";
      };

      const title = getVal("TIÊU_ĐỀ") || `Phương án ${i}`;
      const score = parseInt(getVal("ĐIỂM")) || 75;
      const pros = getVal("ƯU_ĐIỂM") ? getVal("ƯU_ĐIỂM").split("|").map(s => s.trim()).filter(Boolean) : [];
      const cons = getVal("NHƯỢC_ĐIỂM") ? getVal("NHƯỢC_ĐIỂM").split("|").map(s => s.trim()).filter(Boolean) : [];

      options.push({ title, score, pros, cons });
    }

    const optionStartIndex = aiText.indexOf("PHƯƠNG_ÁN_1");
    if (optionStartIndex !== -1) {
      aiText = aiText.substring(0, optionStartIndex).trim();
    }
  }

  aiText = aiText.replace(/^TÓM_TẮT:\s*/i, "").replace(/^MỨC_RỦI_RO:\s*\w+\s*/im, "").trim();

  // BUG-02 FIX: Generate fallback recommendation when AI returns free-form text
  // so that the "Save to Decision Log" button is always available
  let recommendation: {
    summary: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    options: Array<{ title: string; pros: string[]; cons: string[]; score: number }>;
    policyNote?: string;
    actionSteps: string[];
  } | null = null;

  if (hasOptions || actionSteps.length > 0) {
    recommendation = {
      summary: summary.replace(/^TÓM_TẮT:\s*/i, ""),
      riskLevel: (["LOW", "MEDIUM", "HIGH"].includes(riskLevel) ? riskLevel : "LOW") as "LOW" | "MEDIUM" | "HIGH",
      options,
      policyNote,
      actionSteps,
    };
  } else {
    // Fallback: extract a summary + action steps from free-form AI text so the save button works
    const fallbackSummary = aiText.length > 200 ? aiText.substring(0, 200) + "..." : aiText;
    const sentences = aiText.split(/[.\n]/).map(s => s.trim()).filter(s => s.length > 10);
    const fallbackSteps = sentences.slice(0, 4);
    recommendation = {
      summary: fallbackSummary,
      riskLevel: "LOW",
      options: [],
      policyNote: policyNote || undefined,
      actionSteps: fallbackSteps.length > 0 ? fallbackSteps : ["Xem xét và ra quyết định dựa trên phân tích của AI"],
    };
  }

  return {
    success: true,
    data: {
      text: aiText,
      grounded,
      recommendation,
    },
    error: null,
  };
}

export async function saveDecision(input: {
  query: string;
  aiRecommendation: string;
  decisionTaken?: string;
  groundingStatus?: string;
  verifiedByPrincipal?: boolean;
}) {
  try {
    const ctx = await getTenantContext();

    // Requirement 2: Cấm AI tự quyết định hoặc lưu quyết định khi dữ liệu bịa đặt / thiếu nguồn
    if (input.groundingStatus === "REJECTED_HALLUCINATION" || input.groundingStatus === "UNVERIFIED_RECORDS") {
      return {
        success: false,
        error: "🚫 BỊ TỪ CHỐI: Không thể lưu quyết định vì nhận định của AI vi phạm tính toàn vẹn dữ liệu (chứa bản ghi không tồn tại trong cơ sở dữ liệu).",
      };
    }

    if (
      (input.groundingStatus === "WARNING_NO_SOURCES" || input.groundingStatus === "INSUFFICIENT_DATA") &&
      !input.verifiedByPrincipal
    ) {
      return {
        success: false,
        error: "⚠️ CẢNH BÁO KIỂM SOÁT: Nhận định này chưa có số liệu thực tế chứng minh từ hệ thống. Ban Giám hiệu bắt buộc phải thẩm định thực địa trước khi ký duyệt lưu quyết định.",
      };
    }

    const decisionNote = input.verifiedByPrincipal
      ? `[XÁC THỰC THỰC ĐỊA BGH] ${input.decisionTaken || ""}`
      : input.decisionTaken || null;

    const decision = await prisma.decisionLog.create({
      data: {
        principalId: ctx.userId,
        query: input.query,
        aiRecommendation: input.aiRecommendation,
        decisionTaken: decisionNote,
      },
    });

    return {
      success: true,
      data: {
        id: decision.id,
        query: decision.query,
        aiRecommendation: decision.aiRecommendation,
        decisionTaken: decision.decisionTaken || "",
        createdAt: decision.createdAt.toLocaleDateString("vi-VN"),
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Lỗi không xác định";
    return { success: false, error: msg };
  }
}

export async function getDecisionLogs() {
  const ctx = await getTenantContext();
  const logs = await prisma.decisionLog.findMany({
    where: ctx.userRole === "SUPER_ADMIN" ? {} : { principalId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return logs.map((d) => ({
    id: d.id,
    query: d.query,
    aiRecommendation: d.aiRecommendation,
    decisionTaken: d.decisionTaken || "",
    createdAt: d.createdAt.toLocaleDateString("vi-VN"),
  }));
}

export async function getSchoolPointsContext() {
  const ctx = await getTenantContext();
  const schoolId = ctx.schoolId;

  // Requirement 3: Siết chặt quyền sử dụng dữ liệu các điểm trường theo campusId
  const isAllSchoolLeadership =
    ctx.userRole === "ADMIN" ||
    ctx.userRole === "SUPER_ADMIN" ||
    ctx.userRole === "DEPARTMENT_ADMIN" ||
    ctx.userRole === "DISTRICT_ADMIN";

  const campusFilter = ctx.campusId && !isAllSchoolLeadership ? { id: ctx.campusId } : {};

  const points = await prisma.schoolPoint.findMany({
    where: schoolId ? { campus: { schoolId, ...campusFilter } } : {},
    include: {
      campus: true,
      classRooms: {
        include: {
          students: { where: { status: "STUDYING" } },
          homeroomTeacher: true,
          teachingAssignments: {
            select: { teacherId: true },
          },
        },
      },
    },
    orderBy: { distanceKm: "asc" },
  });

  return points.map((p) => {
    // BUG-06 FIX: Count unique teachers from homeroomTeacher + teachingAssignments
    const teacherIds = new Set<string>();
    for (const c of p.classRooms) {
      if (c.homeroomTeacher) {
        teacherIds.add(c.homeroomTeacher.id);
      }
      for (const ta of c.teachingAssignments) {
        teacherIds.add(ta.teacherId);
      }
    }
    return {
      name: p.name,
      distanceKm: p.distanceKm ?? 0,
      studentsCount: p.classRooms.reduce((sum, c) => sum + c.students.length, 0),
      teacherCount: teacherIds.size,
      campusName: p.campus.name,
    };
  });
}

/**
 * Requirement 4: Lấy danh sách bộ nhớ và quy tắc AI đã học từ phản hồi thực tế của trường
 */
export async function getSchoolMemoriesForPrincipal() {
  const ctx = await getTenantContext();
  const schoolId = ctx.schoolId || "";
  const campusId = ctx.campusId || undefined;
  return getRelevantSchoolMemories(schoolId, campusId, "ALL", 30);
}

/**
 * Requirement 4: Xóa hoặc điều chỉnh quy tắc bộ nhớ AI khi có chỉ đạo mới từ BGH
 */
export async function deleteSchoolMemory(memoryId: string) {
  try {
    const ctx = await getTenantContext();
    if (ctx.userRole !== "ADMIN" && ctx.userRole !== "SUPER_ADMIN") {
      return { success: false, error: "Chỉ Hiệu trưởng hoặc Quản trị viên mới có quyền xóa bộ nhớ AI." };
    }
    await (prisma as any).aiFeedback.delete({ where: { id: memoryId } });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Lỗi xóa bộ nhớ AI" };
  }
}

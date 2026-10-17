/**
 * AI MEMORY ENGINE (HỆ THỐNG BỘ NHỚ & TỰ HỌC TỪ PHẢN HỒI NGƯỜI DÙNG)
 * 
 * Hệ thống Bộ nhớ học tập và Đính chính thực địa (Tác giả: phucbtfhn):
 * - Ghi nhận phản hồi (+1 / -1), danh mục sai sót và đính chính thực tế từ Ban Giám hiệu & Giáo viên.
 * - Truy xuất bài học kinh nghiệm theo trường (schoolId) và phân hiệu (campusId).
 * - Inject khối Negative Constraints & Grounding Memory vào System Prompt để AI không lặp lại sai lầm.
 */

"use server";

import prisma from "@/lib/prisma";
import { getTenantContext, isSuperAdmin } from "@/lib/tenant";
import { recordAuditLog } from "@/lib/audit-logger";

export interface SubmitAiFeedbackInput {
  feature: string; // "PRINCIPAL_AI" | "DAILY_SUMMARY" | "SUBSTITUTE_DISPATCH" | "TESTING_SANDBOX" | "GENERAL_AI"
  query: string;
  aiResponseText: string;
  rating: number; // 1: Chính xác / Hài lòng, -1: Không chính xác / Cần đính chính
  feedbackCategory?: string; // "FACT_ERROR" | "REMOTE_POINT_UNFEASIBLE" | "REGULATION_MISMATCH" | "INCOMPLETE_CITATION" | "OTHER"
  correctionText?: string; // Nội dung người dùng đính chính / lưu ý thực tế
  schoolPointId?: string;
  campusId?: string;
}

/**
 * Server action to submit user feedback and real-world correction for an AI output.
 */
export async function submitAiFeedbackAction(input: SubmitAiFeedbackInput) {
  try {
    const ctx = await getTenantContext();
    if (!ctx.userId || !ctx.schoolId) {
      return { success: false, error: "Chưa xác thực danh tính trường học" };
    }

    const feedback = await (prisma as any).aiFeedback.create({
      data: {
        schoolId: ctx.schoolId,
        campusId: input.campusId || ctx.campusId || null,
        schoolPointId: input.schoolPointId || null,
        userId: ctx.userId,
        userRole: ctx.userRole as any,
        feature: input.feature,
        query: input.query,
        aiResponseText: input.aiResponseText,
        rating: input.rating,
        feedbackCategory: input.feedbackCategory || null,
        correctionText: input.correctionText?.trim() || null,
        isResolved: true,
      },
    });

    await recordAuditLog({
      userId: ctx.userId,
      action: "CREATE",
      entityName: "AiFeedback",
      entityId: feedback.id,
      description: `Đánh giá phản hồi AI [${input.feature}] với rating ${input.rating > 0 ? "+1 (Đúng)" : "-1 (Đính chính)"}`,
    });

    return {
      success: true,
      data: feedback,
      message: input.rating > 0
        ? "Cảm ơn bạn đã xác nhận phản hồi chính xác!"
        : "Hệ thống đã lưu đính chính của bạn vào Bộ nhớ học tập của nhà trường để cải thiện các lần tư vấn tiếp theo.",
    };
  } catch (error: any) {
    console.error("[AiMemoryEngine] submitAiFeedbackAction error:", error);
    return { success: false, error: error.message || "Lỗi lưu phản hồi AI" };
  }
}

/**
 * Retrieves past corrections and learned memory guidelines for a specific school.
 */
export async function getRelevantSchoolMemories(
  schoolId: string,
  campusId?: string,
  feature?: string,
  limit = 5
) {
  try {
    if (!schoolId) return [];

    const where: any = {
      schoolId,
      rating: -1,
      correctionText: { not: null },
    };

    if (feature && feature !== "ALL") {
      where.feature = feature;
    }

    if (campusId && campusId !== "ALL") {
      where.OR = [
        { campusId },
        { campusId: null },
      ];
    }

    const memories = await (prisma as any).aiFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        query: true,
        feedbackCategory: true,
        correctionText: true,
        userRole: true,
        createdAt: true,
      },
    });

    return memories.filter((m: any) => m.correctionText && m.correctionText.trim().length > 0);
  } catch (error) {
    console.error("[AiMemoryEngine] getRelevantSchoolMemories error:", error);
    return [];
  }
}


/**
 * Fetches feedback statistics and recent logs for the Testing Sandbox & Review Dashboard.
 */
export async function getAiFeedbackStats(schoolId?: string) {
  try {
    const ctx = await getTenantContext().catch(() => null);
    const superUser = ctx ? isSuperAdmin(ctx) : false;
    const targetSchoolId = !superUser && ctx?.schoolId ? ctx.schoolId : schoolId;

    const where: any = targetSchoolId ? { schoolId: targetSchoolId } : {};

    const [totalFeedbacks, positiveCount, negativeCount, recentLogs] = await Promise.all([
      (prisma as any).aiFeedback.count({ where }),
      (prisma as any).aiFeedback.count({ where: { ...where, rating: 1 } }),
      (prisma as any).aiFeedback.count({ where: { ...where, rating: -1 } }),
      (prisma as any).aiFeedback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { name: true, role: true } },
          campus: { select: { name: true } },
        },
      }),
    ]);

    const accuracyRate = totalFeedbacks > 0
      ? Math.round((positiveCount / totalFeedbacks) * 100)
      : 100;

    return {
      success: true,
      stats: {
        totalFeedbacks,
        positiveCount,
        negativeCount,
        accuracyRate,
      },
      recentLogs,
    };
  } catch (error: any) {
    console.error("[AiMemoryEngine] getAiFeedbackStats error:", error);
    return {
      success: false,
      error: error.message,
      stats: { totalFeedbacks: 0, positiveCount: 0, negativeCount: 0, accuracyRate: 100 },
      recentLogs: [],
    };
  }
}

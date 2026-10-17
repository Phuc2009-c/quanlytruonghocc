"use server";

import { aiChatCompletion } from "@/lib/ai-provider";
import { getComprehensiveAIContext } from "@/lib/ai-data-engine";
import { getTenantContext } from "@/lib/tenant";
import { verifyAIGrounding } from "@/lib/ai/data-integrity";
import { getRelevantSchoolMemories } from "@/lib/ai/ai-memory-engine";
import { formatAiMemoryPromptBlock } from "@/lib/ai/ai-memory-format";

export async function askGeneralAI(query: string, userRole?: string) {
  if (!query || !query.trim()) {
    return { success: false, text: "", error: "Câu hỏi không được để rỗng." };
  }

  let tenantCtx: any = null;
  try {
    tenantCtx = await getTenantContext();
  } catch {
    // Unauthenticated caller
  }

  const roleName = userRole || tenantCtx?.userRole || "USER";
  const dbContext = await getComprehensiveAIContext(query, tenantCtx || undefined);

  let memoryBlock = "";
  if (tenantCtx?.schoolId) {
    const memories = await getRelevantSchoolMemories(tenantCtx.schoolId, tenantCtx.campusId, "GENERAL_AI", 4);
    memoryBlock = formatAiMemoryPromptBlock(memories);
  }

  const prompt = `Bạn là Trợ lý AI Thông minh & Thân thiện cho Trường Học (Trợ lý Giáo dục & Quản lý).
Vai trò người dùng hiện tại: ${roleName}.

${memoryBlock}

DỮ LIỆU THỰC TẾ TRÍCH XUẤT TỪ CƠ SỞ DỮ LIỆU HỆ THỐNG:
${dbContext}

YÊU CẦU / CÂU HỎI CỦA NGƯỜI DÙNG:
"${query}"

QUY TẮC PHẢN HỒI (BẮT BUỘC TRÍCH NGUỒN):
1. Nếu câu hỏi liên quan đến dữ liệu trường (sĩ số, điểm danh, giáo viên, điểm trường, cảnh báo, tuyên dương), hãy trả lời CHÍNH XÁC dựa trên DỮ LIỆU THỰC TẾ ở trên kèm theo mã bản ghi [id=xxx] nếu có.
2. Nếu không đủ dữ liệu để trả lời, BẮT BUỘC phải nói rõ "Dữ liệu hiện tại chưa đủ cơ sở để kết luận" và nêu rõ thông tin cần bổ sung.
3. Trả lời bằng tiếng Việt chuyên nghiệp, ngắn gọn, nhiệt tình và hữu ích.`;

  const result = await aiChatCompletion({ prompt, max_tokens: 1500, temperature: 0.5 });
  
  if (result.success && result.text && tenantCtx?.schoolId) {
    const grounded = await verifyAIGrounding(result.text, {
      schoolId: tenantCtx.schoolId,
      campusId: tenantCtx.campusId,
    });
    return {
      ...result,
      grounded,
    };
  }

  return result;
}

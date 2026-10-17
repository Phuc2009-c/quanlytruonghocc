/**
 * Pure helper function to format AI memory into prompt blocks.
 * Separated from ai-memory-engine.ts so it is not treated as a Server Action.
 */

export function formatAiMemoryPromptBlock(memories: Array<{
  query: string;
  correctionText: string | null;
  feedbackCategory: string | null;
  userRole?: string;
  createdAt: Date;
}>): string {
  if (!memories || memories.length === 0) {
    return "";
  }

  const lines = [
    "\n=======================================================",
    "🧠 [BỘ NHỚ HỌC TẬP TỪ PHẢN HỒI BAN GIÁM HIỆU & GIÁO VIÊN TRONG QUÁ KHỨ]:",
    "LƯU Ý QUAN TRỌNG: Người dùng thực tế của nhà trường đã chỉ ra các sai sót và đính chính các điểm sau.",
    "AI TUYỆT ĐỐI KHÔNG lặp lại các nhận định sai lầm này:",
  ];

  memories.forEach((m, idx) => {
    const categoryTag = m.feedbackCategory ? `[${m.feedbackCategory}] ` : "";
    const dateStr = new Date(m.createdAt).toLocaleDateString("vi-VN");
    lines.push(
      `${idx + 1}. ${categoryTag}${m.correctionText}`,
      `   (Đính chính ngày ${dateStr} cho câu hỏi: "${m.query.slice(0, 80)}${m.query.length > 80 ? "..." : ""}")`
    );
  });

  lines.push("=======================================================\n");

  return lines.join("\n");
}

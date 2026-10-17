import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { getAiFeedbackStats } from "@/lib/ai/ai-memory-engine";
import { TestingSandboxClient } from "./TestingSandboxClient";

export const metadata: Metadata = {
  title: "Sandbox Thử Nghiệm AI Người Dùng Thật | Quản Trị Nhà Trường",
  description: "Môi trường thử nghiệm thực tế 5 kịch bản nghiệp vụ, thu thập đánh giá đa chiều và kiểm chứng bộ nhớ tự học AI.",
};

export default async function TestingSandboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const ctx = await getTenantContext().catch(() => null);
  const feedbackData = await getAiFeedbackStats(ctx?.schoolId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <TestingSandboxClient
        userRole={ctx?.userRole || session.user.role || "ADMIN"}
        userName={session.user.name || "Người dùng thử nghiệm"}
        schoolId={ctx?.schoolId || ""}
        campusId={ctx?.campusId || ""}
        initialStats={feedbackData.stats}
        initialLogs={feedbackData.recentLogs || []}
      />
    </div>
  );
}

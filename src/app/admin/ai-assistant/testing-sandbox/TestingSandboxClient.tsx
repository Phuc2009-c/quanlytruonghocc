"use client";

import React, { useState } from "react";
import {
  FlaskConical,
  Star,
  ShieldCheck,
  BrainCircuit,
  FileCheck,
  Send,
  RotateCcw,
  Sparkles,
  Download,
  AlertTriangle,
  MapPin,
  Users,
  CheckCircle2,
  Building2,
  TrendingUp,
  Scale,
  Loader2,
  Info,
} from "lucide-react";
import { askPrincipalAI } from "@/app/admin/principal-ai/actions";
import { GroundedResponseCard } from "@/components/ai/grounded-response-card";
import { submitAiFeedbackAction } from "@/lib/ai/ai-memory-engine";
import type { AIGroundedResponse } from "@/lib/ai/data-integrity";

interface Scenario {
  id: string;
  title: string;
  category: string;
  badge: string;
  query: string;
  expectedOutcome: string;
}

const BENCHMARK_SCENARIOS: Scenario[] = [
  {
    id: "sc_substitute",
    title: "1. Điều phối Giáo viên Dạy thay Liên Điểm trường",
    category: "Nhân sự & Điểm trường",
    badge: "NQ 37 & Địa hình",
    query: "Phân tích điều động giáo viên Tin học từ Điểm trường Trung tâm hỗ trợ dạy thay tại Phân hiệu Sơn Hải (cách 8km) trong 3 ngày tới, xét đến khoảng cách di chuyển và định mức tiết.",
    expectedOutcome: "AI phải trích dẫn mã điểm trường [id=...], tính toán km di chuyển thực tế, cảnh báo nếu trùng lịch và không được tự ý bố trí giáo viên quá định mức.",
  },
  {
    id: "sc_dropout",
    title: "2. Cảnh báo Nguy cơ Bỏ học & Chuyên cần Vùng cao",
    category: "Quản lý Học sinh",
    badge: "TT 32/2020",
    query: "Đánh giá nguy cơ học sinh vắng học kéo dài tại Điểm trường Sơn Hà 2 và đề xuất phương án vận động phụ huynh theo quy chế Thông tư 32/2020.",
    expectedOutcome: "AI phải trích dẫn mã bản ghi chuyên cần hoặc cảnh báo sớm [id=...], phân tích nguyên nhân địa bàn cư trú, đưa ra bước can thiệp khả thi.",
  },
  {
    id: "sc_briefing",
    title: "3. Báo cáo Giao ban Đầu giờ Sáng Toàn trường",
    category: "Điều hành Hiệu trưởng",
    badge: "Tổng hợp Đa cơ sở",
    query: "Lập báo cáo nhanh điều hành đầu giờ sáng cho Hiệu trưởng: Tổng hợp sĩ số hiện diện, sự vụ an toàn và tình hình hoạt động của 6 phân hiệu.",
    expectedOutcome: "AI tổng hợp số liệu có trích dẫn nguồn, phân chia rõ [DỮ KIỆN] vs [SUY LUẬN], chỉ ra điểm trường cần lưu ý đặc biệt.",
  },
  {
    id: "sc_tt15",
    title: "4. Thẩm định Tiêu chuẩn Trường học theo TT 15/2026",
    category: "Kiểm định Chất lượng",
    badge: "TT 15/2026/TT-BGDĐT",
    query: "Thẩm định mức độ đáp ứng tiêu chuẩn phòng học bộ môn và thiết bị số hóa của Điểm trường An Tiến theo quy định Thông tư 15/2026/TT-BGDĐT.",
    expectedOutcome: "AI đối chiếu tiêu chí TT 15, trích dẫn mã tiêu chí [id=...], nêu rõ điểm đạt và điểm chưa đạt để Ban Giám hiệu kiểm tra thực địa.",
  },
  {
    id: "sc_free",
    title: "5. Thử nghiệm Tự do & Đối soát Cơ sở Dữ liệu",
    category: "Kiểm thử Nghiệp vụ Tùy biến",
    badge: "Free Query",
    query: "Kiểm tra danh sách giáo viên có chứng chỉ chuẩn hóa đào tạo theo lộ trình 36 tháng của Nghị quyết số 37/2026/NQ-CP.",
    expectedOutcome: "AI phản hồi dựa trên dữ liệu hệ thống, cảnh báo nếu thiếu căn cứ và tuyệt đối không bịa số liệu.",
  },
];

interface TestingSandboxClientProps {
  userRole: string;
  userName: string;
  schoolId: string;
  campusId?: string;
  initialStats: {
    totalFeedbacks: number;
    positiveCount: number;
    negativeCount: number;
    accuracyRate: number;
  };
  initialLogs: any[];
}

export function TestingSandboxClient({
  userRole,
  userName,
  schoolId,
  campusId,
  initialStats,
  initialLogs,
}: TestingSandboxClientProps) {
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(BENCHMARK_SCENARIOS[0]);
  const [activeQuery, setActiveQuery] = useState(BENCHMARK_SCENARIOS[0].query);
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<{
    text: string;
    grounded?: AIGroundedResponse;
    recommendation?: any;
    runTimestamp: string;
  } | null>(null);

  // 4-Dimension Evaluation State
  const [accuracyScore, setAccuracyScore] = useState<number>(4);
  const [citationScore, setCitationScore] = useState<number>(4);
  const [feasibilityScore, setFeasibilityScore] = useState<number>(4);
  const [complianceScore, setComplianceScore] = useState<number>(4);
  const [correctionNote, setCorrectionNote] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("REMOTE_POINT_UNFEASIBLE");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Memory re-test indicator
  const [hasMemoryApplied, setHasMemoryApplied] = useState(false);

  const handleSelectScenario = (sc: Scenario) => {
    setSelectedScenario(sc);
    setActiveQuery(sc.query);
    setTestResult(null);
    setFeedbackSuccess(null);
    setCorrectionNote("");
    setHasMemoryApplied(false);
  };

  const handleRunTest = async (isReTestWithMemory = false) => {
    if (!activeQuery.trim() || isRunning) return;
    setIsRunning(true);
    setFeedbackSuccess(null);

    try {
      const res = await askPrincipalAI(activeQuery);
      if (res.success && res.data) {
        setTestResult({
          text: res.data.text || res.data.recommendation?.summary || "",
          grounded: res.data.grounded,
          recommendation: res.data.recommendation,
          runTimestamp: new Date().toLocaleTimeString("vi-VN"),
        });
        if (isReTestWithMemory) {
          setHasMemoryApplied(true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveEvaluation = async () => {
    if (!testResult) return;
    setIsSubmittingFeedback(true);
    try {
      const overallAvg = (accuracyScore + citationScore + feasibilityScore + complianceScore) / 4;
      const isPositive = overallAvg >= 3.5;

      const res = await submitAiFeedbackAction({
        feature: "TESTING_SANDBOX",
        query: activeQuery,
        aiResponseText: testResult.text,
        rating: isPositive ? 1 : -1,
        feedbackCategory: !isPositive ? feedbackCategory : undefined,
        correctionText: correctionNote.trim()
          ? `[Chấm điểm: ${overallAvg.toFixed(1)}/5] ${correctionNote.trim()}`
          : undefined,
        campusId,
      });

      if (res.success) {
        setFeedbackSuccess("✓ Đã lưu kết quả thử nghiệm và nạp bài học vào Bộ nhớ AI thành công!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleExportReport = () => {
    const reportContent = `# BÁO CÁO KẾT QUẢ THỬ NGHIỆM AI VỚI NGƯỜI DÙNG THỰC TẾ
Trường học: ${schoolId} | Người đánh giá: ${userName} (${userRole})
Thời gian: ${new Date().toLocaleString("vi-VN")}

## 1. TỔNG KẾT THỬ NGHIỆM
- Tổng số lượt thử nghiệm: ${initialStats.totalFeedbacks + (testResult ? 1 : 0)}
- Tỷ lệ hài lòng / độ chính xác: ${initialStats.accuracyRate}%
- Trạng thái xác thực trích dẫn CSDL: ${testResult?.grounded?.groundingStatus || "N/A"}

## 2. KỊCH BẢN ĐÃ THỬ NGHIỆM: ${selectedScenario.title}
- Yêu cầu: "${activeQuery}"
- Kết quả AI nhận định:
${testResult?.text || "Chưa chạy thử nghiệm"}

## 3. ĐIỂM ĐÁNH GIÁ 4 CHIỀU:
- Độ chính xác số liệu: ${accuracyScore}/5 sao
- Căn cứ nguồn trích dẫn đầy đủ: ${citationScore}/5 sao
- Tính khả thi thực tế điểm trường: ${feasibilityScore}/5 sao
- Tuân thủ quy định pháp lý: ${complianceScore}/5 sao
- Đính chính thực địa: ${correctionNote || "Không có góp ý thêm (Đạt yêu cầu)"}

*Báo cáo phục vụ hồ sơ nghiệm thu dự án - Tác giả: phucbtfhn*
`;
    const blob = new Blob([reportContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Bao_cao_thu_nghiem_AI_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
  };

  const StarRating = ({
    value,
    onChange,
    label,
  }: {
    value: number;
    onChange: (v: number) => void;
    label: string;
  }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-b-0 text-xs">
      <span className="font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`p-0.5 rounded transition ${
              star <= value ? "text-amber-500 hover:text-amber-600" : "text-slate-300 hover:text-slate-400"
            }`}
          >
            <Star className="w-4 h-4 fill-current" />
          </button>
        ))}
        <span className="ml-1.5 font-bold text-slate-700 w-4 text-center">{value}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ===== Header ===== */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 backdrop-blur-md flex items-center justify-center border border-indigo-400/30 shadow-inner shrink-0">
              <FlaskConical className="w-7 h-7 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight">
                  Sandbox Thử Nghiệm AI Với Người Dùng Thật
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Yêu cầu 5 & 4
                </span>
              </div>
              <p className="text-slate-300 text-sm mt-1">
                Môi trường kiểm nghiệm thực tế 5 kịch bản nghiệp vụ, thu thập đánh giá đa chiều và kiểm chứng cơ chế tự học từ bộ nhớ AI.
              </p>
            </div>
          </div>

          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold backdrop-blur-md transition shrink-0"
          >
            <Download className="w-4 h-4" />
            Xuất Báo cáo Nghiệm thu
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Tổng lượt thử nghiệm</span>
            <span className="text-lg font-bold text-white">{initialStats.totalFeedbacks} lượt</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Tỷ lệ hài lòng / Đúng</span>
            <span className="text-lg font-bold text-emerald-300">{initialStats.accuracyRate}%</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Số bài học đã nạp bộ nhớ</span>
            <span className="text-lg font-bold text-indigo-300">{initialStats.negativeCount} đính chính</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Người thử nghiệm</span>
            <span className="text-lg font-bold text-amber-300 truncate block">{userName}</span>
          </div>
        </div>
      </div>

      {/* ===== Main Grid ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 5 Benchmark Scenarios */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                5 Kịch bản Nghiệp vụ Chuẩn
              </h2>
              <span className="text-[11px] font-semibold text-slate-500">Benchmark</span>
            </div>

            <div className="space-y-2">
              {BENCHMARK_SCENARIOS.map((sc) => {
                const isSelected = selectedScenario.id === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => handleSelectScenario(sc)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      isSelected
                        ? "bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-200 shadow-sm"
                        : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                        {sc.badge}
                      </span>
                      <span className="text-[10px] text-slate-400">{sc.category}</span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 leading-snug">
                      {sc.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      {sc.expectedOutcome}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center & Right: Execution & Evaluation Studio */}
        <div className="lg:col-span-2 space-y-5">
          {/* Query Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600 flex items-center gap-1.5">
                <BrainCircuit className="w-4 h-4 text-indigo-600" />
                Nội dung Yêu cầu Thử nghiệm:
              </span>
              {hasMemoryApplied && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" /> Đã nạp Bộ nhớ học tập
                </span>
              )}
            </div>

            <textarea
              rows={3}
              value={activeQuery}
              onChange={(e) => setActiveQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Nhập yêu cầu kiểm thử AI..."
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Kỳ vọng: {selectedScenario.expectedOutcome}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRunTest(false)}
                  disabled={isRunning || !activeQuery.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md disabled:opacity-50 transition"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Đang xử lý & kiểm chứng DB...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Chạy Thử nghiệm AI
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Test Results Display */}
          {testResult && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Grounded Response Card */}
              {testResult.grounded && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                    <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Kết quả Kiểm chứng Toàn vẹn Dữ liệu (Fact-checking):
                    </span>
                    <span className="text-[11px] text-slate-400">Thời gian chạy: {testResult.runTimestamp}</span>
                  </div>
                  <GroundedResponseCard grounded={testResult.grounded} />
                </div>
              )}

              {/* 4-Dimension Evaluation Form (For Real Users) */}
              <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 shadow-md space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500 fill-current" />
                      Bảng Chấm Điểm Nghiệm Thu Thực Tế (4 Tiêu Chí)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Đánh giá từ người dùng thật để hoàn thiện độ chính xác và nạp bộ nhớ học tập cho AI.
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Điểm TB: {((accuracyScore + citationScore + feasibilityScore + complianceScore) / 4).toFixed(1)}/5
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <StarRating
                    label="1. Độ chính xác số liệu thực tế"
                    value={accuracyScore}
                    onChange={setAccuracyScore}
                  />
                  <StarRating
                    label="2. Mức độ đầy đủ của trích dẫn [id=...]"
                    value={citationScore}
                    onChange={setCitationScore}
                  />
                  <StarRating
                    label="3. Tính khả thi với điểm trường vùng cao"
                    value={feasibilityScore}
                    onChange={setFeasibilityScore}
                  />
                  <StarRating
                    label="4. Tuân thủ căn cứ pháp lý NQ 37 / TT 15"
                    value={complianceScore}
                    onChange={setComplianceScore}
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Phân loại đánh giá:
                      </label>
                      <select
                        value={feedbackCategory}
                        onChange={(e) => setFeedbackCategory(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="REMOTE_POINT_UNFEASIBLE">Chưa khả thi với điểm trường xa</option>
                        <option value="FACT_ERROR">Số liệu chưa sát thực tế</option>
                        <option value="REGULATION_MISMATCH">Cần bổ sung căn cứ pháp lý</option>
                        <option value="INCOMPLETE_CITATION">Cần trích dẫn thêm mã CSDL</option>
                        <option value="EXCELLENT">Hoàn toàn chính xác & xuất sắc</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Ý kiến đính chính thực tế (AI sẽ nạp vào Bộ nhớ học tập để không lặp lại sai lầm):
                      </label>
                      <input
                        type="text"
                        value={correctionNote}
                        onChange={(e) => setCorrectionNote(e.target.value)}
                        placeholder="VD: Điểm Sơn Hải có giáo viên Tin học hợp đồng tại chỗ, không cần điều chuyển giáo viên trung tâm..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => handleRunTest(true)}
                      disabled={isRunning}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold transition"
                      title="Kiểm chứng xem AI có tiếp thu đính chính và đưa ra phương án chuẩn hơn không"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                      Thử Lại Sau Khi Học (Memory Loop)
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {feedbackSuccess && (
                        <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {feedbackSuccess}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveEvaluation}
                        disabled={isSubmittingFeedback}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
                      >
                        {isSubmittingFeedback ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Đang lưu...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Lưu Kết Quả & Nạp Bộ Nhớ
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

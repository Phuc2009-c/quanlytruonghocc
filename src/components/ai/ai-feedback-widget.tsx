"use client";

import React, { useState } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  BrainCircuit,
  X,
  Send,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { submitAiFeedbackAction, type SubmitAiFeedbackInput } from "@/lib/ai/ai-memory-engine";

interface AiFeedbackWidgetProps {
  feature: string;
  query: string;
  aiResponseText: string;
  schoolPointId?: string;
  campusId?: string;
  className?: string;
}

export function AiFeedbackWidget({
  feature,
  query,
  aiResponseText,
  schoolPointId,
  campusId,
  className = "",
}: AiFeedbackWidgetProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState("REMOTE_POINT_UNFEASIBLE");
  const [correctionText, setCorrectionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  const handlePositiveFeedback = async () => {
    if (rating !== null || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await submitAiFeedbackAction({
        feature,
        query,
        aiResponseText,
        rating: 1,
        schoolPointId,
        campusId,
      });
      if (res.success) {
        setRating(1);
        setSubmittedMessage("Cảm ơn bạn! Đánh giá chính xác đã được ghi nhận.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenNegativeModal = () => {
    if (rating === 1 || isSubmitting) return;
    setIsModalOpen(true);
  };

  const handleSubmitNegativeCorrection = async () => {
    if (!correctionText.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await submitAiFeedbackAction({
        feature,
        query,
        aiResponseText,
        rating: -1,
        feedbackCategory: category,
        correctionText: correctionText.trim(),
        schoolPointId,
        campusId,
      });

      if (res.success) {
        setRating(-1);
        setIsModalOpen(false);
        setSubmittedMessage("🧠 Đã nạp đính chính vào Bộ nhớ AI của trường!");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <BrainCircuit className="w-3.5 h-3.5 text-indigo-500" />
          <span>Nhận định AI có hữu ích và chính xác?</span>
        </div>

        {rating === null && !submittedMessage && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePositiveFeedback}
              disabled={isSubmitting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors text-[11px]"
              title="Nhận định chính xác và hữu ích"
            >
              <ThumbsUp className="w-3 h-3 text-emerald-600" />
              <span>Đúng</span>
            </button>
            <button
              onClick={handleOpenNegativeModal}
              disabled={isSubmitting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 transition-colors text-[11px]"
              title="Có sai sót hoặc chưa phù hợp thực tế điểm trường"
            >
              <ThumbsDown className="w-3 h-3 text-rose-600" />
              <span>Cần sửa</span>
            </button>
          </div>
        )}

        {submittedMessage && (
          <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{submittedMessage}</span>
          </div>
        )}
      </div>

      {/* Negative Correction Form Modal / Expandable Panel */}
      {isModalOpen && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 text-xs text-slate-800">
          <div className="flex items-center justify-between font-semibold text-amber-950">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Góp ý & Nạp đính chính vào Bộ nhớ AI</span>
            </div>
            <button
              onClick={() => setIsModalOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-amber-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">
              Loại vấn đề phát hiện:
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="REMOTE_POINT_UNFEASIBLE">
                Không khả thi với điều kiện thực tế điểm trường lẻ (địa hình, cơ sở vật chất)
              </option>
              <option value="FACT_ERROR">
                Sai số liệu thực tế (sĩ số, giáo viên, điểm số)
              </option>
              <option value="REGULATION_MISMATCH">
                Chưa phù hợp quy định / Nghị quyết 37 / Thông tư 15
              </option>
              <option value="INCOMPLETE_CITATION">
                Trích dẫn thiếu hoặc không đúng mã bản ghi CSDL
              </option>
              <option value="OTHER">Lý do khác</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">
              Nội dung thực tế đúng (AI sẽ ghi nhớ quy tắc này cho các lần tư vấn sau):
            </label>
            <textarea
              rows={2}
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
              placeholder="VD: Điểm trường Bản Mó mùa mưa lũ đường đèo khó đi, ưu tiên giáo viên tại chỗ..."
              className="w-full bg-white border border-amber-200 rounded-lg p-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-medium"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmitNegativeCorrection}
              disabled={isSubmitting || !correctionText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang ghi nhớ...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Lưu vào Bộ nhớ AI
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

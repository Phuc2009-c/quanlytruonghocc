"use client";

import React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  FileSearch,
  Info,
  AlertTriangle,
} from "lucide-react";
import type { AIGroundedResponse } from "@/lib/ai/data-integrity";

interface GroundedResponseCardProps {
  grounded: AIGroundedResponse;
  className?: string;
}

export function GroundedResponseCard({
  grounded,
  className = "",
}: GroundedResponseCardProps) {
  // 0. Case: Warning - No Grounding Sources Cited (Examiner Priority Check)
  if (grounded.groundingStatus === "WARNING_NO_SOURCES") {
    return (
      <div
        className={`bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-5 space-y-4 shadow-sm ${className}`}
      >
        <div className="flex items-start gap-3.5 text-amber-900">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 mt-0.5 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
                CẢNH BÁO KIỂM SOÁT: THIẾU CĂN CỨ DỮ LIỆU CHỨNG MINH
              </h4>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                WARNING_NO_SOURCES
              </span>
            </div>
            <p className="text-xs text-amber-800 font-medium mt-1 leading-relaxed">
              {grounded.warningMessage ||
                "Nhận định này chưa có số liệu chứng minh từ hệ thống. Ban Giám hiệu KHÔNG ĐƯỢC TỰ Ý RA QUYẾT ĐỊNH mà cần thẩm định thực địa tại điểm trường!"}
            </p>
          </div>
        </div>

        <div className="bg-white/90 border border-amber-200 rounded-xl p-4 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap shadow-inner">
          <div className="font-semibold text-amber-900 mb-1.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-600" /> Nội dung AI nhận định (chưa qua kiểm chứng thực địa):
          </div>
          {grounded.rawText}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-amber-800 bg-amber-100/70 px-3.5 py-2 rounded-lg border border-amber-200 font-medium">
          <FileSearch className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>Quy tắc: AI chỉ được hỗ trợ ra quyết định khi trích dẫn mã bản ghi xác thực <code>[id=...]</code> từ cơ sở dữ liệu trường.</span>
        </div>
      </div>
    );
  }

  // 1. Case: Insufficient Data
  if (grounded.isInsufficientData) {
    return (
      <div
        className={`bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm ${className}`}
      >
        <div className="flex items-center gap-2.5 text-slate-700 font-semibold text-sm">
          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span>TRẠNG THÁI: KHÔNG ĐỦ DỮ LIỆU</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300">
                INSUFFICIENT_DATA
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Hệ thống không tự ý suy đoán hoặc làm tròn khi chưa đủ cơ sở dữ liệu thực tế.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed">
          {grounded.missingDataReason || grounded.rawText}
        </div>
      </div>
    );
  }

  // 2. Case: Unverified Records / Hallucination Detected
  if (grounded.hasHallucinations) {
    return (
      <div
        className={`bg-red-50/70 border border-red-200/80 rounded-2xl p-5 space-y-4 shadow-sm ${className}`}
      >
        <div className="flex items-center gap-3 text-red-800">
          <div className="w-9 h-9 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-red-900">
              CẢNH BÁO TOÀN VẸN DỮ LIỆU: PHÁT HIỆN BẢN GHI CHƯA XÁC THỰC
            </h4>
            <p className="text-xs text-red-700/80 mt-0.5">
              AI đã trích dẫn mã bản ghi không tồn tại trong cơ sở dữ liệu trường học.
            </p>
          </div>
        </div>

        <div className="bg-red-100/60 border border-red-200/80 rounded-xl p-3 text-xs text-red-900 space-y-1.5 font-mono">
          <div className="font-semibold text-red-800">Mã bản ghi không hợp lệ:</div>
          <div className="flex flex-wrap gap-1.5">
            {grounded.unverifiedRecordIds.map((id) => (
              <span
                key={id}
                className="px-2 py-0.5 rounded bg-red-200/80 border border-red-300 text-red-900"
              >
                {id}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasFacts = grounded.facts.length > 0;
  const hasInferences = grounded.inferences.length > 0;

  // 3. Case: Standard Grounded Content with Fact vs Inference Split
  return (
    <div className={`space-y-4 ${className}`}>
      {/* SECTION 1: VERIFIED FACTS — Light emerald theme */}
      {hasFacts && (
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 space-y-3 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              DỮ KIỆN THỰC TẾ — CÓ TRUY VẾT DATABASE
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
              Đã xác thực DB ({grounded.verifiedRecordIds.length} bản ghi)
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {grounded.facts.map((fact, idx) => (
              <div
                key={idx}
                className="bg-white border border-emerald-100 rounded-xl p-3.5 space-y-2 text-xs text-emerald-950"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{fact.statement}</div>
                </div>

                {fact.recordIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-emerald-100 text-[11px]">
                    <span className="text-emerald-600 flex items-center gap-1 font-mono">
                      <FileSearch className="w-3 h-3 text-emerald-500" /> Nguồn:
                    </span>
                    {fact.recordIds.map((id) => (
                      <span
                        key={id}
                        className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[10px]"
                      >
                        {fact.sourceTable ? `${fact.sourceTable}#` : ""}
                        {id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: AI INFERENCES — Light amber theme */}
      {hasInferences && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 space-y-3 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              SUY LUẬN AI — CẦN CON NGƯỜI XÁC MINH
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
              Giả thuyết / Gợi ý
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {grounded.inferences.map((inf, idx) => (
              <div
                key={idx}
                className="bg-white border border-amber-100 rounded-xl p-3.5 space-y-2 text-xs text-amber-950"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{inf.hypothesis}</div>
                </div>

                <div className="pt-2 border-t border-amber-100 text-[11px] text-amber-700 flex items-center gap-1.5">
                  <strong>Yêu cầu xác minh:</strong> {inf.verificationRequired}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback to raw text if no structured facts/inferences parsed */}
      {!hasFacts && !hasInferences && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
          {grounded.rawText}
        </div>
      )}
    </div>
  );
}

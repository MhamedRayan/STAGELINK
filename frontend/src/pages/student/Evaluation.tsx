import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { formatDate, formatGrade } from '../../utils/formatters';
import { resolveUserName } from '../../demo/directory';
import { SectionCard } from '../../components/ui/SectionCard';

interface EvaluationData {
  id: string;
  internship_id: string;
  supervisor_user_id: string;
  grade: string;
  comment?: string;
  created_at: string;
}

export const StudentEvaluation: React.FC = () => {
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadEvaluation() {
      setIsLoading(true);
      try {
        const internRes = await apiRequest<{ results: any[] }>(
          '/svc/internships/api/internships/',
          { params: { mine: true } }
        );

        if (!isMounted) return;
        const current = (internRes.results || [])[0];

        if (current) {
          try {
            const evalData = await apiRequest<EvaluationData>(
              `/svc/internships/api/internships/${current.id}/evaluation/`
            );
            if (isMounted) setEvaluation(evalData);
          } catch {
            // Evaluation not recorded yet
          }
        }
      } catch (err) {
        console.error('Failed to load evaluation:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadEvaluation();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-surface-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="py-16 text-center bg-white rounded-xl border border-mint-200 p-8">
        <Award className="w-12 h-12 text-mutedText/60 mx-auto mb-3" />
        <h2 className="text-base font-bold text-forest-900 mb-1">
          Evaluation Not Available Yet
        </h2>
        <p className="text-xs text-mutedText max-w-md mx-auto">
          Your final evaluation and score will be visible here once your supervisor reviews and approves your submission and records your grade.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Internship Evaluation</h1>
        <p className="text-xs text-mutedText mt-1">Official academic assessment and feedback.</p>
      </div>

      {/* Grade Hero Card */}
      <div className="bg-mint rounded-2xl p-8 border border-mint-300 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white mb-3">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
          <div className="text-4xl font-extrabold text-forest-900 tracking-tight">
            Final Grade: {formatGrade(evaluation.grade)}
          </div>
          <p className="text-xs text-mutedText mt-2">
            Recorded by {resolveUserName(evaluation.supervisor_user_id, 'Supervisor')} on {formatDate(evaluation.created_at)}
          </p>
        </div>

        <div className="w-20 h-20 rounded-2xl bg-forest-900 text-mint flex items-center justify-center font-bold text-3xl shadow-md shrink-0">
          <Award className="w-10 h-10 text-sage" />
        </div>
      </div>

      {/* Supervisor Comments */}
      <SectionCard title="Supervisor Remarks & Feedback">
        {evaluation.comment ? (
          <p className="text-xs text-forest-900 leading-relaxed whitespace-pre-line p-4 bg-mint-50/50 rounded-lg border border-mint-200">
            "{evaluation.comment}"
          </p>
        ) : (
          <p className="text-xs text-mutedText">No written comment was attached to this evaluation.</p>
        )}
      </SectionCard>
    </div>
  );
};

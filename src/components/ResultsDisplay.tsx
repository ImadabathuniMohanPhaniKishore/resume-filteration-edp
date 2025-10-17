import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Resume, SimilarityResult } from '../lib/supabase';
import { Award, Mail, User, TrendingUp, Download, BarChart3, ArrowLeft } from 'lucide-react';

interface ResultsDisplayProps {
  jobPostingId: string;
  onReset: () => void;
}

interface ResultWithResume extends SimilarityResult {
  resume: Resume;
}

export default function ResultsDisplay({ jobPostingId, onReset }: ResultsDisplayProps) {
  const [results, setResults] = useState<ResultWithResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKeywords, setShowKeywords] = useState<string | null>(null);

  useEffect(() => {
    loadResults();
  }, [jobPostingId]);

  const loadResults = async () => {
    try {
      const { data, error } = await supabase
        .from('similarity_results')
        .select(`
          *,
          resume:resumes(*)
        `)
        .eq('job_posting_id', jobPostingId)
        .order('similarity_score', { ascending: false });

      if (error) throw error;

      setResults(data as any);
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Rank', 'Candidate Name', 'Email', 'Match Score', 'Skills', 'Matched Keywords'];
    const rows = results.map((result) => [
      result.ranking,
      result.resume.candidate_name || 'Unknown',
      result.resume.candidate_email || 'N/A',
      `${result.similarity_score}%`,
      result.resume.skills?.join('; ') || 'N/A',
      result.matched_keywords?.join('; ') || 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shortlisted-candidates-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-orange-600 bg-orange-50 border-orange-200';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Award className="text-blue-600" size={28} />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Shortlisted Candidates
              </h2>
              <p className="text-gray-600">
                Ranked by NLP similarity score
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Download size={20} />
              Export CSV
            </button>
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
              New Analysis
            </button>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="text-blue-600" size={20} />
              <span className="font-medium text-gray-900">
                Total Candidates Analyzed: {results.length}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              Top Match: {results[0]?.similarity_score.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {results.map((result) => (
            <div
              key={result.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-lg">
                        #{result.ranking}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <User size={18} />
                        {result.resume.candidate_name || 'Candidate'}
                      </h3>
                      {result.resume.candidate_email && (
                        <a
                          href={`mailto:${result.resume.candidate_email}`}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Mail size={16} />
                          {result.resume.candidate_email}
                        </a>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mb-3">
                      {result.resume.filename}
                    </p>

                    {result.resume.skills && result.resume.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {result.resume.skills.slice(0, 8).map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                        {result.resume.skills.length > 8 && (
                          <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                            +{result.resume.skills.length - 8} more
                          </span>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => setShowKeywords(showKeywords === result.id ? null : result.id)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {showKeywords === result.id ? 'Hide' : 'Show'} Matched Keywords
                    </button>

                    {showKeywords === result.id && result.matched_keywords && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-700 mb-2">
                          Matched Keywords:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {result.matched_keywords.map((keyword, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 ml-4">
                  <div className={`px-4 py-2 rounded-lg border-2 ${getScoreColor(result.similarity_score)}`}>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={20} />
                      <span className="text-2xl font-bold">
                        {result.similarity_score.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs mt-1">Match Score</p>
                  </div>
                  <div className="mt-3 w-24">
                    <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all ${getScoreBarColor(result.similarity_score)}`}
                        style={{ width: `${result.similarity_score}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {results.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}

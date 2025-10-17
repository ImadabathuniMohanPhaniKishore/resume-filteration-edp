import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import FileUpload from './FileUpload';
import ResultsDisplay from './ResultsDisplay';
import { LogOut, FileText, Briefcase } from 'lucide-react';

export default function Dashboard() {
  const { signOut, user } = useAuth();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleProcessingComplete = (jobId: string) => {
    setActiveJobId(jobId);
    setShowResults(true);
  };

  const handleReset = () => {
    setShowResults(false);
    setActiveJobId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="text-blue-600" size={28} />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Resume Shortlisting System
                </h1>
                <p className="text-sm text-gray-600">AI-Powered NLP Matching</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!showResults ? (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Briefcase className="text-blue-600" size={24} />
                <h2 className="text-xl font-semibold text-gray-900">
                  Start Resume Screening
                </h2>
              </div>
              <p className="text-gray-600 mb-6">
                Upload resumes and a job description to automatically rank candidates
                using NLP-powered similarity matching.
              </p>
              <FileUpload
                userId={user!.id}
                onComplete={handleProcessingComplete}
              />
            </div>
          </div>
        ) : (
          <ResultsDisplay
            jobPostingId={activeJobId!}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}

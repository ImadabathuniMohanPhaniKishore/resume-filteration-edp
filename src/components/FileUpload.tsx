import React, { useState } from 'react';
import { Upload, FileText, Briefcase, Loader, CheckCircle } from 'lucide-react';

interface FileUploadProps {
  userId: string;
  onComplete: (jobId: string) => void;
}

interface ProcessingStatus {
  stage: 'idle' | 'uploading' | 'processing' | 'calculating' | 'complete';
  message: string;
  progress: number;
}

export default function FileUpload({ userId, onComplete }: FileUploadProps) {
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [status, setStatus] = useState<ProcessingStatus>({
    stage: 'idle',
    message: '',
    progress: 0,
  });

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setResumeFiles(Array.from(e.target.files));
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve(text);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (resumeFiles.length === 0 || !jobDescription || !jobTitle) {
      alert('Please provide all required information');
      return;
    }

    try {
      setStatus({
        stage: 'uploading',
        message: 'Processing job description...',
        progress: 10,
      });

      const apiUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const jobResponse = await fetch(
        `${apiUrl}/functions/v1/process-job-description`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: {
              title: jobTitle,
              description: jobDescription,
              userId: userId,
            },
          }),
        }
      );

      const jobResult = await jobResponse.json();
      if (!jobResult.success) throw new Error(jobResult.error);

      const jobPostingId = jobResult.jobPosting.id;

      setStatus({
        stage: 'processing',
        message: `Processing ${resumeFiles.length} resumes...`,
        progress: 30,
      });

      const resumeIds: string[] = [];
      const totalResumes = resumeFiles.length;

      for (let i = 0; i < resumeFiles.length; i++) {
        const file = resumeFiles[i];
        const content = await extractTextFromFile(file);

        const resumeResponse = await fetch(
          `${apiUrl}/functions/v1/process-resume`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: {
                filename: file.name,
                content: content,
                userId: userId,
              },
            }),
          }
        );

        const resumeResult = await resumeResponse.json();
        if (resumeResult.success) {
          resumeIds.push(resumeResult.resume.id);
        }

        const progress = 30 + ((i + 1) / totalResumes) * 40;
        setStatus({
          stage: 'processing',
          message: `Processed ${i + 1}/${totalResumes} resumes...`,
          progress,
        });
      }

      setStatus({
        stage: 'calculating',
        message: 'Calculating similarity scores...',
        progress: 80,
      });

      const similarityResponse = await fetch(
        `${apiUrl}/functions/v1/calculate-similarity`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: {
              jobPostingId: jobPostingId,
              resumeIds: resumeIds,
            },
          }),
        }
      );

      const similarityResult = await similarityResponse.json();
      if (!similarityResult.success) throw new Error(similarityResult.error);

      setStatus({
        stage: 'complete',
        message: 'Analysis complete!',
        progress: 100,
      });

      setTimeout(() => {
        onComplete(jobPostingId);
      }, 1000);
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
      setStatus({ stage: 'idle', message: '', progress: 0 });
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-medium mb-2">
              <FileText size={20} className="text-blue-600" />
              <span>Upload Resumes</span>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
              <input
                type="file"
                multiple
                accept=".txt,.pdf,.doc,.docx"
                onChange={handleResumeChange}
                className="hidden"
                id="resume-upload"
                disabled={status.stage !== 'idle'}
              />
              <label
                htmlFor="resume-upload"
                className="flex flex-col items-center cursor-pointer"
              >
                <Upload size={40} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-600 text-center">
                  Click to upload resumes
                  <br />
                  <span className="text-xs text-gray-500">
                    (TXT, PDF, DOC, DOCX)
                  </span>
                </span>
              </label>
            </div>
            {resumeFiles.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  {resumeFiles.length} file{resumeFiles.length !== 1 ? 's' : ''} selected
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {resumeFiles.map((file, idx) => (
                    <p key={idx} className="text-xs text-blue-700 truncate">
                      {file.name}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-medium mb-2">
              <Briefcase size={20} className="text-blue-600" />
              <span>Job Description</span>
            </div>
            <div>
              <input
                type="text"
                placeholder="Job Title (e.g., Senior Software Engineer)"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                disabled={status.stage !== 'idle'}
                required
              />
              <textarea
                placeholder="Paste job description here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={10}
                disabled={status.stage !== 'idle'}
                required
              />
            </div>
          </div>
        </div>

        {status.stage !== 'idle' && (
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              {status.stage === 'complete' ? (
                <CheckCircle className="text-green-600" size={24} />
              ) : (
                <Loader className="text-blue-600 animate-spin" size={24} />
              )}
              <span className="font-medium text-gray-900">{status.message}</span>
            </div>
            <div className="bg-white rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-500 ease-out"
                style={{ width: `${status.progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2 text-right">
              {Math.round(status.progress)}%
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={status.stage !== 'idle'}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {status.stage === 'idle' ? (
            <>
              <Upload size={20} />
              Start Analysis
            </>
          ) : (
            'Processing...'
          )}
        </button>
      </form>
    </div>
  );
}

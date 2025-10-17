import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Resume {
  id: string;
  filename: string;
  candidate_name: string | null;
  candidate_email: string | null;
  extracted_text: string;
  skills: string[];
  uploaded_at: string;
}

export interface JobPosting {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  created_at: string;
  status: string;
}

export interface SimilarityResult {
  id: string;
  job_posting_id: string;
  resume_id: string;
  similarity_score: number;
  matched_keywords: string[];
  ranking: number;
  calculated_at: string;
}

/*
  # Intelligent Resume Shortlisting System Database Schema

  ## Overview
  This migration creates the database structure for an NLP-powered resume shortlisting system
  that matches resumes against job descriptions using similarity scoring.

  ## New Tables
  
  ### 1. `job_postings`
  Stores job descriptions uploaded by recruiters
  - `id` (uuid, primary key) - Unique identifier
  - `title` (text) - Job title
  - `description` (text) - Full job description text
  - `requirements` (text) - Extracted key requirements
  - `created_by` (uuid) - User who created the posting
  - `created_at` (timestamptz) - Creation timestamp
  - `status` (text) - Processing status (active, archived)

  ### 2. `resumes`
  Stores uploaded resume information and extracted content
  - `id` (uuid, primary key) - Unique identifier
  - `filename` (text) - Original filename
  - `candidate_name` (text) - Extracted candidate name
  - `candidate_email` (text) - Extracted email address
  - `extracted_text` (text) - Full extracted text content
  - `skills` (text[]) - Extracted skills array
  - `file_url` (text) - Storage URL for original file
  - `uploaded_at` (timestamptz) - Upload timestamp
  - `uploaded_by` (uuid) - User who uploaded

  ### 3. `similarity_results`
  Stores matching results between resumes and job postings
  - `id` (uuid, primary key) - Unique identifier
  - `job_posting_id` (uuid, foreign key) - Reference to job posting
  - `resume_id` (uuid, foreign key) - Reference to resume
  - `similarity_score` (decimal) - Match percentage (0-100)
  - `matched_keywords` (text[]) - Common keywords found
  - `ranking` (integer) - Rank within job posting results
  - `calculated_at` (timestamptz) - Calculation timestamp

  ## Security
  - Enable RLS on all tables
  - Authenticated users can create and view their own job postings
  - Authenticated users can upload resumes and view results
  - Users can only access their own data

  ## Indexes
  - Index on similarity_score for faster sorting
  - Index on job_posting_id for result lookups
  - Index on created_at/uploaded_at for chronological queries
*/

-- Create job_postings table
CREATE TABLE IF NOT EXISTS job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  requirements text,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived'))
);

-- Create resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  candidate_name text,
  candidate_email text,
  extracted_text text NOT NULL,
  skills text[],
  file_url text,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create similarity_results table
CREATE TABLE IF NOT EXISTS similarity_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id uuid REFERENCES job_postings(id) ON DELETE CASCADE NOT NULL,
  resume_id uuid REFERENCES resumes(id) ON DELETE CASCADE NOT NULL,
  similarity_score decimal(5,2) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 100),
  matched_keywords text[],
  ranking integer,
  calculated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_similarity_score ON similarity_results(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_job_posting_results ON similarity_results(job_posting_id, similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_job_postings_created ON job_postings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_uploaded ON resumes(uploaded_at DESC);

-- Enable Row Level Security
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE similarity_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_postings
CREATE POLICY "Users can view own job postings"
  ON job_postings FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create job postings"
  ON job_postings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own job postings"
  ON job_postings FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own job postings"
  ON job_postings FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for resumes
CREATE POLICY "Users can view own resumes"
  ON resumes FOR SELECT
  TO authenticated
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can upload resumes"
  ON resumes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete own resumes"
  ON resumes FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- RLS Policies for similarity_results
CREATE POLICY "Users can view results for their job postings"
  ON similarity_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM job_postings
      WHERE job_postings.id = similarity_results.job_posting_id
      AND job_postings.created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert similarity results"
  ON similarity_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_postings
      WHERE job_postings.id = similarity_results.job_posting_id
      AND job_postings.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete results for their job postings"
  ON similarity_results FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM job_postings
      WHERE job_postings.id = similarity_results.job_posting_id
      AND job_postings.created_by = auth.uid()
    )
  );
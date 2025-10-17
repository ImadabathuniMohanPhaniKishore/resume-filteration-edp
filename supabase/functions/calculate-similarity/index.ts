import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface MatchRequest {
  jobPostingId: string;
  resumeIds: string[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

function calculateTfIdf(tokens: string[], allTokens: string[][]): Map<string, number> {
  const tf = new Map<string, number>();
  const tokenCount = tokens.length;

  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1 / tokenCount);
  }

  const idf = new Map<string, number>();
  const docCount = allTokens.length;

  for (const token of tokens) {
    const docsWithToken = allTokens.filter(doc => doc.includes(token)).length;
    idf.set(token, Math.log(docCount / (docsWithToken + 1)));
  }

  const tfidf = new Map<string, number>();
  for (const [token, tfValue] of tf.entries()) {
    tfidf.set(token, tfValue * (idf.get(token) || 0));
  }

  return tfidf;
}

function cosineSimilarity(
  vec1: Map<string, number>,
  vec2: Map<string, number>
): number {
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  const allKeys = new Set([...vec1.keys(), ...vec2.keys()]);

  for (const key of allKeys) {
    const v1 = vec1.get(key) || 0;
    const v2 = vec2.get(key) || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  }

  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

function findMatchedKeywords(
  jobTokens: string[],
  resumeTokens: string[],
  topN: number = 10
): string[] {
  const jobSet = new Set(jobTokens);
  const resumeSet = new Set(resumeTokens);
  const matched = [...jobSet].filter(token => resumeSet.has(token));

  const frequency = new Map<string, number>();
  for (const token of matched) {
    const jobCount = jobTokens.filter(t => t === token).length;
    const resumeCount = resumeTokens.filter(t => t === token).length;
    frequency.set(token, jobCount + resumeCount);
  }

  return matched
    .sort((a, b) => (frequency.get(b) || 0) - (frequency.get(a) || 0))
    .slice(0, topN);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: matchRequest }: { data: MatchRequest } = await req.json();

    if (!matchRequest.jobPostingId || !matchRequest.resumeIds || matchRequest.resumeIds.length === 0) {
      throw new Error('Missing required fields');
    }

    const { data: jobPosting, error: jobError } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', matchRequest.jobPostingId)
      .single();

    if (jobError || !jobPosting) throw new Error('Job posting not found');

    const { data: resumes, error: resumeError } = await supabase
      .from('resumes')
      .select('*')
      .in('id', matchRequest.resumeIds);

    if (resumeError || !resumes || resumes.length === 0) {
      throw new Error('No resumes found');
    }

    const jobTokens = tokenize(jobPosting.description + ' ' + (jobPosting.requirements || ''));
    const allTokens = [jobTokens];
    const resumeTokensMap = new Map<string, string[]>();

    for (const resume of resumes) {
      const resumeTokens = tokenize(resume.extracted_text);
      resumeTokensMap.set(resume.id, resumeTokens);
      allTokens.push(resumeTokens);
    }

    const jobTfidf = calculateTfIdf(jobTokens, allTokens);
    const results = [];

    for (const resume of resumes) {
      const resumeTokens = resumeTokensMap.get(resume.id)!;
      const resumeTfidf = calculateTfIdf(resumeTokens, allTokens);
      const similarity = cosineSimilarity(jobTfidf, resumeTfidf);
      const similarityPercent = Math.round(similarity * 100 * 100) / 100;
      const matchedKeywords = findMatchedKeywords(jobTokens, resumeTokens);

      results.push({
        resumeId: resume.id,
        similarity: similarityPercent,
        matchedKeywords: matchedKeywords
      });
    }

    results.sort((a, b) => b.similarity - a.similarity);

    await supabase.from('similarity_results').delete().eq('job_posting_id', matchRequest.jobPostingId);

    const insertData = results.map((result, index) => ({
      job_posting_id: matchRequest.jobPostingId,
      resume_id: result.resumeId,
      similarity_score: result.similarity,
      matched_keywords: result.matchedKeywords,
      ranking: index + 1
    }));

    const { error: insertError } = await supabase
      .from('similarity_results')
      .insert(insertData);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: true,
        results: results,
        totalProcessed: resumes.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
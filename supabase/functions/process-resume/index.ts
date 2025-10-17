import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ResumeData {
  filename: string;
  content: string;
  userId: string;
}

function extractEmail(text: string): string | null {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0] : null;
}

function extractName(text: string): string | null {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length < 50 && !/\d/.test(firstLine)) {
      return firstLine;
    }
  }
  return null;
}

function extractSkills(text: string): string[] {
  const commonSkills = [
    'javascript', 'typescript', 'python', 'java', 'c\\+\\+', 'c#', 'ruby', 'php', 'swift', 'kotlin',
    'react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring', 'laravel',
    'sql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'git',
    'machine learning', 'deep learning', 'nlp', 'computer vision', 'data science',
    'html', 'css', 'sass', 'tailwind', 'bootstrap',
    'rest api', 'graphql', 'microservices', 'agile', 'scrum',
    'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy',
    'communication', 'leadership', 'teamwork', 'problem solving', 'project management'
  ];

  const lowerText = text.toLowerCase();
  const foundSkills: string[] = [];

  for (const skill of commonSkills) {
    const regex = new RegExp('\\b' + skill + '\\b', 'i');
    if (regex.test(lowerText)) {
      foundSkills.push(skill.replace(/\\\\[+]/g, '+'));
    }
  }

  return [...new Set(foundSkills)];
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s@.\-]/g, ' ')
    .trim();
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

    const { data: resumeData }: { data: ResumeData } = await req.json();

    if (!resumeData.content || !resumeData.filename) {
      throw new Error('Missing required fields: content and filename');
    }

    const cleanedText = cleanText(resumeData.content);
    const candidateName = extractName(cleanedText);
    const candidateEmail = extractEmail(cleanedText);
    const skills = extractSkills(cleanedText);

    const { data: resume, error } = await supabase
      .from('resumes')
      .insert({
        filename: resumeData.filename,
        candidate_name: candidateName,
        candidate_email: candidateEmail,
        extracted_text: cleanedText,
        skills: skills,
        uploaded_by: resumeData.userId
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        resume: resume,
        extracted: {
          name: candidateName,
          email: candidateEmail,
          skills: skills,
          textLength: cleanedText.length
        }
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
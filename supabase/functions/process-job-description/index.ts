import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface JobData {
  title: string;
  description: string;
  userId: string;
}

function extractRequirements(text: string): string {
  const lowerText = text.toLowerCase();
  const requirementSections = [];

  const patterns = [
    /requirements?:([\s\S]*?)(?=\n\n|responsibilities|qualifications|$)/i,
    /qualifications?:([\s\S]*?)(?=\n\n|responsibilities|requirements|$)/i,
    /required skills?:([\s\S]*?)(?=\n\n|responsibilities|qualifications|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      requirementSections.push(match[1].trim());
    }
  }

  return requirementSections.join('\n\n') || text.substring(0, 500);
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

    const { data: jobData }: { data: JobData } = await req.json();

    if (!jobData.description || !jobData.title) {
      throw new Error('Missing required fields: title and description');
    }

    const requirements = extractRequirements(jobData.description);

    const { data: jobPosting, error } = await supabase
      .from('job_postings')
      .insert({
        title: jobData.title,
        description: jobData.description,
        requirements: requirements,
        created_by: jobData.userId,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        jobPosting: jobPosting
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
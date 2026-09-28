// App-level configuration for the Vault: the same for every user.
//
// VERTICAL  — what the content is about (a company, a project, a certification…),
//             derived from the resume section it came from.
// HORIZONTAL — what a bullet demonstrates (people management, financial impact, …).
//             A bullet can carry several tags. `keywords` drive the instant local tagger;
//             `description` is what the AI tagger reads. Keywords match whole words; use \\w* for stems. Edit this list to change tags app-wide;
//             ids are stored on bullets, so rename labels freely but keep ids stable.

export const TAGS = [
  {
    id: 'people', label: 'People management', color: '#7c3aed',
    description: 'Hiring, managing, mentoring or coaching people; growing and developing teams; performance management.',
    keywords: ['hired', 'hiring', 'recruited', 'managed a team', 'team of \\d+', 'direct reports', 'mentor', 'mentored', 'mentoring', 'onboarding', 'coached', 'grew the team', 'built (a|the) team', 'performance reviews', 'promoted \\d+', 'onboarded \\d+'],
  },
  {
    id: 'leadership', label: 'Leadership & strategy', color: '#4f46e5',
    description: 'Setting direction and strategy, owning roadmaps, leading initiatives across teams, influencing decisions.',
    keywords: ['led', 'lead', 'leading', 'strategy', 'strategic', 'vision', 'roadmap', 'spearheaded', 'drove', 'owned', 'headed', 'championed', 'tech lead', 'technical direction', 'initiative'],
  },
  {
    id: 'financial', label: 'Financial impact', color: '#059669',
    description: 'Revenue, ARR, cost savings, margin, pricing, budgets or any money-denominated outcome.',
    keywords: ['revenue', 'arr', 'mrr', 'arpu', 'profit', 'margin', 'cost', 'costs', 'savings', 'budget', 'pricing', 'monetiz\\w*', 'cogs', 'opex', '[$€£₹][\\d.,]+\\w*', 'million', 'billion'],
  },
  {
    id: 'growth', label: 'Growth & customer impact', color: '#0891b2',
    description: 'Users, customers, acquisition, conversion, retention, engagement, satisfaction.',
    keywords: ['users', 'customers', 'mau', 'dau', 'conversion', 'retention', 'churn', 'engagement', 'acquisition', 'sign-?ups', 'activation', 'ctr', 'nps', 'subscribers', 'growth', 'adoption'],
  },
  {
    id: 'technical', label: 'Technical', color: '#2563eb',
    description: 'Hands-on engineering: architecture, systems, APIs, infrastructure, performance, code.',
    keywords: ['architect\\w*', 'api', 'apis', 'platform', 'infrastructure', 'backend', 'frontend', 'microservices', 'database', 'latency', 'scalab\\w*', 'distributed', 'kubernetes', 'cloud', 'aws', 'gcp', 'kafka', 'code', 'sdk', 'pipeline', 'migration', 'rest', 'grpc', 'node\\.js', 'python', 'java', '\\bgo\\b'],
  },
  {
    id: 'product', label: 'Product & delivery', color: '#db2777',
    description: 'Launching and shipping products or features, go-to-market, delivering projects end to end.',
    keywords: ['launched', 'shipped', 'released', 'delivered', 'rolled out', 'introduced', 'go-to-market', 'mvp', 'feature', 'product', 'redesign'],
  },
  {
    id: 'data', label: 'Data & analytics', color: '#0d9488',
    description: 'Metrics, experimentation, A/B tests, dashboards, analysis and data-driven insights.',
    keywords: ['data', 'analytics', 'metrics', 'dashboard', 'sql', 'a/b', 'experiment', 'insights', 'cohort', 'forecast', 'analysis', 'kpi'],
  },
  {
    id: 'ai', label: 'AI & ML', color: '#9333ea',
    description: 'Machine learning, AI and LLM features, recommendations, search relevance, models.',
    keywords: ['\\bai\\b', 'ai-powered', '\\bml\\b', 'machine learning', 'llm', 'genai', 'generative', 'recommendation', 'personaliz\\w*', 'nlp', 'model', 'embedding', 'vector', 'semantic search', 'prompt'],
  },
  {
    id: 'operations', label: 'Operations & efficiency', color: '#ca8a04',
    description: 'Improving processes, automation, efficiency, turnaround time, operational excellence.',
    keywords: ['process', 'automated', 'automation', 'efficien\\w*', 'streamlined', 'workflow', 'operations', 'turnaround', 'hours a', 'time from', 'reduced time', 'self-serve', 'self-service', 'tooling'],
  },
  {
    id: 'reliability', label: 'Reliability, security & compliance', color: '#dc2626',
    description: 'Uptime, availability, incidents, on-call, security, compliance, audits, quality.',
    keywords: ['uptime', 'availability', 'reliab\\w*', 'incident', 'mttr', 'on-call', 'outage', 'security', 'compliance', 'soc ?2', 'pci', 'gdpr', 'hipaa', 'audit', 'observability', 'quality', 'deliverability', 'fraud'],
  },
  {
    id: 'collaboration', label: 'Collaboration & stakeholders', color: '#ea580c',
    description: 'Partnering across teams, working with stakeholders, clients, vendors and partners.',
    keywords: ['partnered', 'partnering', 'collaborated', 'stakeholder', 'cross-functional', 'cross-team', 'worked with', 'aligned', 'vendors', 'clients', 'partners'],
  },
  {
    id: 'communication', label: 'Communication & influence', color: '#64748b',
    description: 'Presenting, writing, teaching, documentation, evangelism and persuading others.',
    keywords: ['presented', 'presentation', 'wrote', 'authored', 'published', 'talk', 'speaker', 'evangeli\\w*', 'documentation', 'guide', 'training', 'workshop', 'taught', 'teaching'],
  },
  {
    id: 'recognition', label: 'Awards & recognition', color: '#b45309',
    description: 'Awards, honours, promotions, patents and other formal recognition.',
    keywords: ['award', 'awarded', 'recogni\\w*', 'honou?r', 'winner', 'won', 'patent', 'peer bonus', 'best paper'],
  },
]

export const TAG_BY_ID = Object.fromEntries(TAGS.map(t => [t.id, t]))

// Vertical groups, in display order. `from` lists the resume section types that feed each group.
export const VAULT_KINDS = [
  { id: 'experience', label: 'Companies', from: ['experience'] },
  { id: 'projects', label: 'Projects', from: ['projects'] },
  { id: 'education', label: 'Education', from: ['education'] },
  { id: 'certificates', label: 'Certifications', from: ['certificates'] },
  { id: 'skills', label: 'Skills', from: ['skills', 'languages'] },
  { id: 'awards', label: 'Awards', from: ['awards'] },
  { id: 'organisations', label: 'Volunteering & organisations', from: ['organisations'] },
  { id: 'publications', label: 'Publications', from: ['publications'] },
  { id: 'courses', label: 'Courses', from: ['courses'] },
  { id: 'summaries', label: 'Summaries', from: ['profile'] },
  { id: 'other', label: 'Other', from: ['custom'] },
]

export const KIND_OF_SECTION = Object.fromEntries(VAULT_KINDS.flatMap(k => k.from.map(t => [t, k.id])))

export const uid = () => Math.random().toString(36).slice(2, 10)

export const DEFAULT_SETTINGS = {
  // Document
  dateFormat: 'MM/YYYY',
  language: 'en',
  pageFormat: 'A4',
  // Layout
  columns: 'two', // one | two | mix
  headerPosition: 'left', // top | left | right
  leftWidth: 35,
  // Font sizes (pt; others are offsets from base)
  baseSize: 9,
  nameSize: 11,
  titleSize: 2,
  headingSize: 3.5,
  entrySize: 0.5,
  // Spacing
  lineHeight: 1.2,
  sectionGap: 4, // 1..9
  entryGap: 4, // 1..9
  marginX: 10,
  marginY: 10,
  // Entries
  entryLayout: 'full', // full | columns
  datePosition: 'below', // right | below
  subtitleStyle: 'bold', // bold | italic | normal
  subtitlePlacement: 'same', // same (Title, Subtitle) | next (own line)
  listStyle: 'bullet', // bullet | hyphen | none
  bulletIndent: 0, // mm the bullet list sits in from the entry's text
  titlePlacement: 'below', // below | inline: professional title under the name, or beside it
  // Headings
  headingStyle: 'plain', // plain | underline | box | line | bar | dotted | fill | overline
  headingCaps: 'capitalize', // capitalize | uppercase
  headingIcons: 'none', // none | outline | filled
  // Fonts
  bodyFont: 'PT Serif',
  nameFont: '',
  // Colors
  colorArea: 'column', // full | column | border
  colorMode: 'multi', // single | multi
  accent: '#1f2a6b',
  text: '#1f2a6b',
  bg: '#fdfbf8',
  accent2: '#ffffff',
  text2: '#ffffff',
  bg2: '#16195a',
  applyAccent: { name: true, jobTitle: false, headings: true, headerIcons: true, dates: false, entryTitle: true, entrySubtitle: false, linkIcons: true },
  // Header
  headerAlign: 'left',
  titleStyle: 'italic', // italic | normal
  showPhoto: true,
  photoSize: 24, // mm
  photoShape: 'circle', // circle | rounded | square
  detailsArrangement: 'icon', // icon | bullet | bar
  iconStyle: 'none', // none | circle | rounded | square | circle-outline | rounded-outline | square-outline
  // Links
  linkUnderline: false,
  linkBlue: false,
  linkIcon: false,
  // Footer
  footerEmail: false,
  footerPageNumbers: false,
  footerName: false,
}

// Sample content for a fictional person (John Doe) — replace with your own.
// Employers and schools are real names used only to make the example realistic.
export function sampleResume(name = 'Resume 1') {
  const section = (type, heading, column, entries) => ({ id: uid(), type, heading, column, hidden: false, entries: entries.map(e => ({ id: uid(), ...e })) })
  return {
    id: uid(),
    name,
    updatedAt: Date.now(),
    personal: {
      fullName: 'John Doe',
      jobTitle: 'Staff Software Engineer | Payments & Distributed Systems',
      email: 'john.doe@example.com',
      phone: '+1 415 555 0142',
      location: 'San Francisco, CA',
      links: [
        { id: uid(), type: 'linkedin', value: 'linkedin.com/in/johndoe' },
        { id: uid(), type: 'github', value: 'github.com/johndoe' },
      ],
      photo: '',
    },
    sections: [
      section('profile', 'Profile Summary', 'left', [{
        text: '<p>Staff engineer with 10 years of experience building payment and infrastructure systems at global scale. I lead cross-team technical strategy, design reliable distributed systems, and grow engineers into technical leaders.</p>',
      }]),
      section('education', 'Education', 'left', [
        { degree: 'MS Computer Science', school: 'Stanford University', startDate: '2014-09', endDate: '2016-06', location: 'Stanford, CA', description: '<p>Distributed systems track. Teaching assistant for CS 244.</p>' },
        { degree: 'BS Electrical Engineering & Computer Science', school: 'Massachusetts Institute of Technology', startDate: '2010-09', endDate: '2014-06', location: 'Cambridge, MA', description: '' },
      ]),
      section('skills', 'Skills', 'left', [
        { skill: 'Languages', info: 'Go, Java, Python, TypeScript, SQL', level: -1 },
        { skill: 'Systems', info: 'Distributed databases, Kafka, gRPC, event sourcing', level: -1 },
        { skill: 'Cloud', info: 'AWS, GCP, Kubernetes, Terraform', level: -1 },
        { skill: 'Leadership', info: 'Technical strategy, design reviews, mentoring, hiring', level: -1 },
      ]),
      section('languages', 'Languages', 'left', [
        { language: 'English', info: 'Native', level: -1 },
        { language: 'Spanish', info: 'Professional', level: -1 },
      ]),
      section('awards', 'Awards', 'left', [
        { award: 'Google Peer Bonus × 6', issuer: 'Google', endDate: '2020', description: '' },
        { award: 'Best Paper, Systems Track', issuer: 'USENIX ATC', endDate: '2019', description: '' },
      ]),
      section('interests', 'Interests', 'left', [
        { interest: 'Marathon running', info: '' },
        { interest: 'Chess', info: '' },
        { interest: 'Teaching', info: '' },
      ]),
      section('experience', 'Professional Experience', 'right', [
        {
          jobTitle: 'Staff Software Engineer', employer: 'Stripe', startDate: '2021-03', endDate: '', location: 'San Francisco, CA',
          description: '<ul><li>Tech lead for the ledger platform processing <b>$1T+</b> in annual payment volume across 40+ countries.</li><li>Designed a multi-region ledger architecture that raised availability from 99.95% to <b>99.999%</b>.</li><li>Led a 25-engineer, cross-team migration to event sourcing with zero customer-visible downtime.</li><li>Mentored 8 engineers; 3 promoted to senior and 1 to staff.</li><li>Authored the company-wide guide to idempotent API design, now required reading for new payments engineers.</li></ul>',
        },
        {
          jobTitle: 'Senior Software Engineer', employer: 'Google', startDate: '2017-08', endDate: '2021-02', location: 'Mountain View, CA',
          description: '<ul><li>Built core components of the Google Pay merchant APIs serving <b>150M+</b> users.</li><li>Cut p99 API latency by <b>45%</b> by redesigning request fan-out and caching.</li><li>Co-authored the fraud signal pipeline that reduced chargebacks by <b>30%</b>.</li><li>Ran the team design-review process and onboarding for 12 new engineers.</li><li>Launched tap-to-pay support in 9 markets with partner banks and card networks.</li></ul>',
        },
        {
          jobTitle: 'Software Engineer', employer: 'Airbnb', startDate: '2016-07', endDate: '2017-07', location: 'San Francisco, CA',
          description: '<ul><li>Shipped payouts to hosts in 15 new currencies, unlocking expansion into Latin America.</li><li>Built reconciliation tooling that saved the finance team 200+ hours a month.</li><li>Reduced failed payouts by <b>60%</b> with automated retry and bank-detail validation.</li></ul>',
        },
        {
          jobTitle: 'Software Engineering Intern', employer: 'Microsoft', startDate: '2015-06', endDate: '2015-09', location: 'Redmond, WA',
          description: '<ul><li>Prototyped a telemetry dashboard for Azure Storage adopted by the on-call team.</li><li>Received a return offer and an intern hackathon award.</li></ul>',
        },
      ]),
      section('projects', 'Projects', 'right', [
        { title: 'Open-source rate limiter', subtitle: 'Go · 4k GitHub stars', startDate: '2019-01', endDate: '', location: '', description: '<p>Distributed token-bucket limiter used in production by several fintech startups.</p>' },
        { title: 'Ledger Lab', subtitle: 'Teaching tool', startDate: '2022-05', endDate: '', location: '', description: '<p>Interactive simulator for double-entry accounting systems, used in two university courses.</p>' },
      ]),
      section('certificates', 'Certifications', 'right', [
        { name: 'AWS Certified Solutions Architect – Professional', issuer: 'Amazon Web Services', endDate: '2022-11', description: '' },
        { name: 'Certified Kubernetes Administrator (CKA)', issuer: 'Cloud Native Computing Foundation', endDate: '2021-05', description: '' },
      ]),
      section('publications', 'Publications', 'right', [
        { title: 'Exactly-once payments at global scale', publisher: 'USENIX ATC', endDate: '2019-07', description: '<p>How idempotency keys and deterministic replay prevent double charges during regional failover.</p>' },
      ]),
      section('organisations', 'Volunteering', 'right', [
        { organisation: 'Code2040', position: 'Engineering Mentor', startDate: '2018-01', endDate: '', location: 'San Francisco, CA', description: '<p>Mentor early-career engineers from under-represented groups through interview prep and first-job support.</p>' },
      ]),
    ],
    settings: { ...DEFAULT_SETTINGS, applyAccent: { ...DEFAULT_SETTINGS.applyAccent } },
  }
}

export function blankEntry(type) {
  return { id: uid(), ...(type === 'skills' || type === 'languages' ? { level: -1 } : {}) }
}

// An empty resume with the usual sections ready to fill in.
export function blankResume(name = 'Untitled resume') {
  const section = (type, heading, column, entries = []) => ({ id: uid(), type, heading, column, hidden: false, entries })
  return {
    id: uid(),
    name,
    updatedAt: Date.now(),
    personal: { fullName: '', jobTitle: '', email: '', phone: '', location: '', links: [], photo: '' },
    sections: [
      section('profile', 'Profile Summary', 'left', [{ id: uid(), text: '' }]),
      section('education', 'Education', 'left'),
      section('skills', 'Skills', 'left'),
      section('experience', 'Professional Experience', 'right'),
    ],
    settings: { ...DEFAULT_SETTINGS, applyAccent: { ...DEFAULT_SETTINGS.applyAccent } },
  }
}

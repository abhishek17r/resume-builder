import {
  IdCard, GraduationCap, Brain, Briefcase, Languages, Award, Heart, FolderGit2,
  BookOpen, Trophy, Users, Newspaper, UserCheck, FileSignature, LayoutList,
} from 'lucide-react'

// Field kinds: text | month | rich | level | url
const DATES = [
  { key: 'startDate', label: 'Start Date', kind: 'month', span: 1 },
  { key: 'endDate', label: 'End Date', kind: 'month', span: 1, presentLabel: 'Present' },
]

export const SECTION_TYPES = {
  profile: {
    label: 'Profile Summary', icon: IdCard, single: true,
    blurb: 'A short pitch at the top of your resume.',
    fields: [{ key: 'text', label: 'Summary', kind: 'rich' }],
  },
  education: {
    label: 'Education', icon: GraduationCap,
    blurb: 'Degrees, schools and graduation dates.',
    fields: [
      { key: 'degree', label: 'Degree', kind: 'text', span: 3 },
      { key: 'school', label: 'School', kind: 'text', span: 3, link: true },
      ...DATES,
      { key: 'location', label: 'Location', kind: 'text', span: 1 },
      { key: 'description', label: 'Description', kind: 'rich' },
    ],
    title: e => [e.degree, e.school],
  },
  experience: {
    label: 'Professional Experience', icon: Briefcase,
    blurb: 'Roles, employers and what you achieved.',
    fields: [
      { key: 'jobTitle', label: 'Job Title', kind: 'text', span: 3 },
      { key: 'employer', label: 'Employer', kind: 'text', span: 3, link: true },
      ...DATES,
      { key: 'location', label: 'Location', kind: 'text', span: 1 },
      { key: 'description', label: 'Description', kind: 'rich' },
    ],
    title: e => [e.jobTitle, e.employer],
  },
  skills: {
    label: 'Skills', icon: Brain,
    blurb: 'Group skills by theme, optionally with a level.',
    fields: [
      { key: 'skill', label: 'Skill', kind: 'text', span: 3 },
      { key: 'info', label: 'Information / Sub-skills', kind: 'text', span: 3 },
      { key: 'level', label: 'Skill Level', kind: 'level' },
    ],
    title: e => [e.skill, e.info],
  },
  languages: {
    label: 'Languages', icon: Languages,
    blurb: 'Languages you speak and how well.',
    fields: [
      { key: 'language', label: 'Language', kind: 'text', span: 3 },
      { key: 'info', label: 'Information', kind: 'text', span: 3 },
      { key: 'level', label: 'Language Level', kind: 'level' },
    ],
    title: e => [e.language, e.info],
  },
  projects: {
    label: 'Projects', icon: FolderGit2,
    blurb: 'Side projects and notable work.',
    fields: [
      { key: 'title', label: 'Project Title', kind: 'text', span: 3, link: true },
      { key: 'subtitle', label: 'Subtitle', kind: 'text', span: 3 },
      ...DATES,
      { key: 'location', label: 'Location', kind: 'text', span: 1 },
      { key: 'description', label: 'Description', kind: 'rich' },
    ],
    title: e => [e.title, e.subtitle],
  },
  certificates: {
    label: 'Certificates', icon: Award,
    blurb: 'Certifications and licences.',
    fields: [
      { key: 'name', label: 'Certificate', kind: 'text', span: 3, link: true },
      { key: 'issuer', label: 'Issuer', kind: 'text', span: 3 },
      { key: 'endDate', label: 'Date', kind: 'month', span: 1 },
      { key: 'description', label: 'Description', kind: 'rich' },
    ],
    title: e => [e.name, e.issuer],
  },
  courses: {
    label: 'Courses', icon: BookOpen,
    blurb: 'Courses and trainings.',
    fields: [
      { key: 'course', label: 'Course', kind: 'text', span: 3, link: true },
      { key: 'institution', label: 'Institution', kind: 'text', span: 3 },
      ...DATES,
      { key: 'location', label: 'Location', kind: 'text', span: 1 },
      { key: 'description', label: 'Description', kind: 'rich' },
    ],
    title: e => [e.course, e.institution],
  },
  awards: {
    label: 'Awards', icon: Trophy,
    blurb: 'Honours and recognition.',
    fields: [
      { key: 'award', label: 'Award', kind: 'text', span: 3, link: true },
      { key: 'issuer', label: 'Issuer', kind: 'text', span: 3 },
      { key: 'endDate', label: 'Date', kind: 'month', span: 1 },
      { key: 'description', label: 'Description', kind: 'rich' },
    ],
    title: e => [e.award, e.issuer],
  },
  organisations: {
    label: 'Organisations', icon: Users,
    blurb: 'Clubs, volunteering and memberships.',
    fields: [
      { key: 'organisation', label: 'Organisation', kind: 'text', span: 3, link: true },
      { key: 'position', label: 'Position', kind: 'text', span: 3 },
      ...DATES,
      { key: 'location', label: 'Location', kind: 'text', span: 1 },
      { key: 'description', label: 'Description', kind: 'rich' },
    ],
    title: e => [e.position, e.organisation],
  },
  publications: {
    label: 'Publications', icon: Newspaper,
    blurb: 'Papers, articles and books.',
    fields: [
      { key: 'title', label: 'Title', kind: 'text', span: 3, link: true },
      { key: 'publisher', label: 'Publisher', kind: 'text', span: 3 },
      { key: 'endDate', label: 'Date', kind: 'month', span: 1 },
      { key: 'description', label: 'Description', kind: 'rich' },
    ],
    title: e => [e.title, e.publisher],
  },
  interests: {
    label: 'Interests', icon: Heart,
    blurb: 'Hobbies that say something about you.',
    fields: [
      { key: 'interest', label: 'Interest', kind: 'text', span: 3 },
      { key: 'info', label: 'Information', kind: 'text', span: 3 },
    ],
    title: e => [e.interest, e.info],
  },
  references: {
    label: 'References', icon: UserCheck,
    blurb: 'People who can vouch for you.',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', span: 3, link: true },
      { key: 'jobTitle', label: 'Job Title', kind: 'text', span: 3 },
      { key: 'organisation', label: 'Organisation', kind: 'text', span: 3 },
      { key: 'email', label: 'Email', kind: 'text', span: 3 },
      { key: 'phone', label: 'Phone', kind: 'text', span: 3 },
    ],
    title: e => [e.name, e.organisation],
  },
  declaration: {
    label: 'Declaration', icon: FileSignature, single: true,
    blurb: 'A signed statement, common in some countries.',
    fields: [
      { key: 'text', label: 'Declaration', kind: 'rich' },
      { key: 'fullName', label: 'Full Name', kind: 'text', span: 3 },
      { key: 'place', label: 'Place', kind: 'text', span: 3 },
    ],
  },
  custom: {
    label: 'Custom', icon: LayoutList,
    blurb: 'Anything else — you choose the heading.',
    fields: [
      { key: 'title', label: 'Title', kind: 'text', span: 3, link: true },
      { key: 'subtitle', label: 'Subtitle', kind: 'text', span: 3 },
      ...DATES,
      { key: 'location', label: 'Location', kind: 'text', span: 1 },
      { key: 'description', label: 'Description', kind: 'rich' },
    ],
    title: e => [e.title, e.subtitle],
  },
}

export const LEVELS = ['Beginner', 'Elementary', 'Intermediate', 'Advanced', 'Expert']

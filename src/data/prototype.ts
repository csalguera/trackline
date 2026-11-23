import type { Application } from '../types/application'

export const stages = ['Interested', 'Applied', 'Phone Screen', 'Assessment', 'Interview', 'Final Interview', 'Offer']

export const seedApplications: Application[] = [
  { id: 1, company: 'Linear', role: 'Product Designer', stage: 'Interested', location: 'Remote · US', notes: 2, logo: 'L', tone: 'violet', salary: '$145k–$180k', type: 'Full-time' },
  { id: 2, company: 'Vercel', role: 'Senior UX Designer', stage: 'Interested', location: 'Remote', notes: 1, logo: 'V', tone: 'slate', salary: '$155k–$195k', type: 'Full-time' },
  { id: 3, company: 'Arc', role: 'Product Designer', stage: 'Applied', location: 'New York, NY', date: 'May 14', notes: 3, logo: 'A', tone: 'amber', type: 'Full-time' },
  { id: 4, company: 'Notion', role: 'Product Designer, Growth', stage: 'Applied', location: 'San Francisco, CA', date: 'May 12', notes: 1, logo: 'N', tone: 'slate', salary: '$160k–$210k', type: 'Full-time' },
  { id: 5, company: 'Figma', role: 'Product Designer', stage: 'Phone Screen', location: 'San Francisco, CA', date: 'May 8', deadline: 'Tomorrow · 10:00 AM', notes: 4, logo: 'F', tone: 'coral', salary: '$149k–$260k', type: 'Full-time' },
  { id: 6, company: 'Airtable', role: 'Senior Product Designer', stage: 'Assessment', location: 'Remote · US', date: 'May 5', deadline: 'Due Fri · 5:00 PM', notes: 2, logo: 'A', tone: 'teal', type: 'Full-time' },
  { id: 7, company: 'Stripe', role: 'Product Designer, Core', stage: 'Interview', location: 'Seattle, WA', date: 'Apr 28', deadline: 'May 22 · 1:30 PM', notes: 6, logo: 'S', tone: 'indigo', salary: '$170k–$255k', type: 'Full-time' },
  { id: 8, company: 'Loom', role: 'Staff Product Designer', stage: 'Final Interview', location: 'Remote', date: 'Apr 18', deadline: 'May 24 · 11:00 AM', notes: 5, logo: 'L', tone: 'rose', type: 'Full-time' },
  { id: 9, company: 'Webflow', role: 'Design Systems Lead', stage: 'Offer', location: 'Remote · US', date: 'Apr 10', notes: 8, logo: 'W', tone: 'blue', salary: '$180k–$225k', type: 'Full-time' },
]

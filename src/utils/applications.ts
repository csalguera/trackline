import type { Application, NoteEntry, StageHistoryEntry } from '../types/application'
import { seedApplications } from '../data/prototype'

const seedStagePaths: Record<number, string[]> = {
  1: ['Interested'], 2: ['Interested'], 3: ['Interested', 'Applied'],
  4: ['Applied'], 5: ['Applied', 'Phone Screen'], 6: ['Applied', 'Assessment'],
  7: ['Applied', 'Phone Screen', 'Assessment', 'Interview'],
  8: ['Interested', 'Applied', 'Interview', 'Final Interview'],
  9: ['Applied', 'Interview', 'Offer'],
}

const seedDeadlines: Record<number, string> = {
  5: '2026-11-04T10:00:00-08:00',
  6: '2026-11-06T17:00:00-08:00',
  7: '2026-11-05T13:30:00-08:00',
  8: '2026-11-07T11:00:00-08:00',
}

export function createSeedNotes(app: Application): NoteEntry[] {
  const bodies = [
    'Team is focused on simplifying the onboarding experience. Prepare examples of systems thinking and cross-functional collaboration.',
    'Review the role requirements and prepare questions about team structure, ownership, and current product priorities.',
    'Save examples that show close collaboration with product and engineering partners.',
  ]
  return Array.from({ length: app.notes }, (_, index) => ({
    id: `note-${app.id}-${index}`,
    title: index === 0 ? 'Recruiter conversation' : index === 1 ? 'Preparation notes' : undefined,
    body: bodies[index % bodies.length],
    createdAt: new Date(`2025-05-${String(Math.max(2, 16 - index)).padStart(2, '0')}T${String(11 + (index % 5)).padStart(2, '0')}:42:00-07:00`).toISOString(),
  }))
}

export function hydrateApplication(app: Application): Application {
  const path = app.stageHistory?.length ? app.stageHistory.map((entry) => entry.stage) : seedStagePaths[app.id] || [app.stage]
  const stageHistory = app.stageHistory?.length ? app.stageHistory : path.map((stage, index) => ({
    id: `stage-${app.id}-${index}`,
    stage,
    recordedAt: new Date(`2025-05-${String(8 + index * 2).padStart(2, '0')}T${String(9 + index).padStart(2, '0')}:24:00-07:00`).toISOString(),
  }))
  const noteEntries = app.noteEntries || createSeedNotes(app)
  return {
    ...app,
    stage: stageHistory.at(-1)?.stage || app.stage,
    notes: noteEntries.length,
    createdAt: app.createdAt || '2025-05-08T09:14:00-07:00',
    deadlineAt: seedDeadlines[app.id] && (!app.deadlineAt || Date.parse(app.deadlineAt) < Date.now()) ? seedDeadlines[app.id] : app.deadlineAt,
    noteEntries,
    stageHistory,
  }
}

export function getInitialApplications() {
  try {
    const stored = JSON.parse(localStorage.getItem('trackline-applications') || 'null')
    if (Array.isArray(stored)) return stored.map(hydrateApplication)
  } catch {
    // Prototype data is the fallback when storage is unavailable or invalid.
  }
  return seedApplications.map(hydrateApplication)
}

export function getNotes(app: Application) {
  return app.noteEntries || createSeedNotes(app)
}

export function getStageHistory(app: Application): StageHistoryEntry[] {
  if (app.stageHistory?.length) return app.stageHistory
  const path = seedStagePaths[app.id] || [app.stage]
  return path.map((stage, index) => ({
    id: `stage-${app.id}-${index}`,
    stage,
    recordedAt: new Date(`2025-05-${String(8 + index * 2).padStart(2, '0')}T${String(9 + index).padStart(2, '0')}:24:00-07:00`).toISOString(),
  }))
}

export type IconName =
  | 'archive'
  | 'arrow'
  | 'board'
  | 'calendar'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'close'
  | 'dots'
  | 'edit'
  | 'filter'
  | 'goal'
  | 'inbox'
  | 'link'
  | 'menu'
  | 'note'
  | 'plus'
  | 'search'
  | 'settings'
  | 'sparkle'
  | 'trash'
  | 'user'

export type NoteEntry = {
  id: string
  title?: string
  body: string
  createdAt: string
  editedAt?: string
}

export type StageHistoryEntry = {
  id: string
  stage: string
  recordedAt: string
}

export type Application = {
  id: number
  company: string
  role: string
  stage: string
  location: string
  date?: string
  deadline?: string
  deadlineAt?: string
  notes: number
  logo: string
  tone: string
  salary?: string
  type?: string
  createdAt?: string
  noteEntries?: NoteEntry[]
  stageHistory?: StageHistoryEntry[]
}

export type Page = 'board' | 'archive' | 'settings'
export type Modal = 'add' | 'details' | 'event' | 'quick' | null

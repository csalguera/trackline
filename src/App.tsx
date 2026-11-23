import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './components/Icon'
import { seedApplications, stages } from './data/prototype'
import { commonTimeZones } from './data/timezones'
import { useDismissibleMenu } from './hooks/useDismissibleMenu'
import { useSingleColumnBoard } from './hooks/useSingleColumnBoard'
import type { Application, Modal, Page, StageHistoryEntry } from './types/application'
import { detectBrowserTimeZone, formatTimestamp, formatEventTime, formatEventDate, formatEventDay, formatEventMonth, timeZoneLabel } from './utils/format'
import { getInitialApplications, getNotes, getStageHistory, hydrateApplication } from './utils/applications'

const events = [
  { id: 5, company: 'Figma', type: 'Recruiter call', startsAt: '2026-11-04T10:00:00-08:00', tone: 'blue' },
  { id: 7, company: 'Stripe', type: 'Portfolio review', startsAt: '2026-11-05T13:30:00-08:00', tone: 'violet' },
  { id: 8, company: 'Loom', type: 'Final interview', startsAt: '2026-11-07T11:00:00-08:00', tone: 'teal' },
]

function Logo() {
  return <div className="brand-mark"><span /><span /><span /></div>
}

function App() {
  const [signedIn, setSignedIn] = useState(true)
  const [page, setPage] = useState<Page>('board')
  const [applications, setApplications] = useState<Application[]>(getInitialApplications)
  const [archived, setArchived] = useState<Application[]>([])
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterStage, setFilterStage] = useState('All stages')
  const [modal, setModal] = useState<Modal>(null)
  const [selected, setSelected] = useState<Application | null>(null)
  const [detailTab, setDetailTab] = useState('Overview')
  const [dragged, setDragged] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)
  const [undoApplication, setUndoApplication] = useState<Application | null>(null)
  const [backwardMove, setBackwardMove] = useState<{ app: Application; destination: string; nextHistory: StageHistoryEntry[]; removed: StageHistoryEntry[] } | null>(null)
  const [stageRemoval, setStageRemoval] = useState<{ app: Application; entry: StageHistoryEntry } | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [goalsEnabled, setGoalsEnabled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('trackline-goals') || 'null')?.enabled ?? false
    } catch {
      return false
    }
  })
  const [goalTarget, setGoalTarget] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('trackline-goals') || 'null')?.target ?? 3
    } catch {
      return 3
    }
  })
  const [timeZone, setTimeZone] = useState(() => {
    try {
      return localStorage.getItem('trackline-time-zone') || detectBrowserTimeZone()
    } catch {
      return detectBrowserTimeZone()
    }
  })
  const [addStage, setAddStage] = useState('Interested')
  const [archiveSelection, setArchiveSelection] = useState<number[]>([])
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const filtered = useMemo(() => applications.filter((app) => {
    const matchesQuery = `${app.company} ${app.role} ${app.location}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (filterStage === 'All stages' || app.stage === filterStage)
  }), [applications, query, filterStage])
  const availableStages = useMemo(() => Array.from(new Set([...stages, ...applications.map((app) => app.stage)])), [applications])

  useEffect(() => {
    try {
      localStorage.setItem('trackline-goals', JSON.stringify({ enabled: goalsEnabled, target: goalTarget }))
    } catch {
      // Keep the in-memory prototype functional when browser storage is unavailable.
    }
  }, [goalsEnabled, goalTarget])

  useEffect(() => {
    try {
      localStorage.setItem('trackline-time-zone', timeZone)
    } catch {
      // Keep the detected time zone for the current session when storage is unavailable.
    }
  }, [timeZone])

  useEffect(() => {
    try {
      localStorage.setItem('trackline-applications', JSON.stringify(applications))
    } catch {
      // Keep the in-memory prototype functional when browser storage is unavailable.
    }
  }, [applications])

  const notify = (message: string, undo: Application | null = null) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(message)
    setUndoApplication(undo)
    toastTimer.current = window.setTimeout(() => {
      setToast('')
      setUndoApplication(null)
    }, 3500)
  }

  const openDetails = (app: Application) => {
    setSelected(app)
    setDetailTab('Overview')
    setModal('details')
  }

  const replaceApplication = (updated: Application) => {
    setApplications((items) => items.map((item) => item.id === updated.id ? updated : item))
  }

  const moveApp = (id: number, stage: string) => {
    const app = applications.find((item) => item.id === id)
    if (!app || app.stage === stage) return
    setDragged(null)
    const currentIndex = availableStages.indexOf(app.stage)
    const destinationIndex = availableStages.indexOf(stage)
    const history = getStageHistory(app)

    if (destinationIndex < currentIndex) {
      const existingDestination = history.map((entry) => entry.stage).lastIndexOf(stage)
      let nextHistory: StageHistoryEntry[]
      if (existingDestination >= 0) {
        nextHistory = history.slice(0, existingDestination + 1)
      } else {
        const firstLaterStage = history.findIndex((entry) => availableStages.indexOf(entry.stage) > destinationIndex)
        const retained = firstLaterStage >= 0 ? history.slice(0, firstLaterStage) : history
        nextHistory = [...retained, { id: `stage-${id}-${Date.now()}`, stage, recordedAt: new Date().toISOString() }]
      }
      const retainedIds = new Set(nextHistory.map((entry) => entry.id))
      setBackwardMove({ app, destination: stage, nextHistory, removed: history.filter((entry) => !retainedIds.has(entry.id)) })
      return
    }

    const updated = {
      ...app,
      stage,
      stageHistory: [...history, { id: `stage-${id}-${Date.now()}`, stage, recordedAt: new Date().toISOString() }],
    }
    replaceApplication(updated)
    notify(`Application moved to ${stage}`, app)
  }

  const confirmBackwardMove = () => {
    if (!backwardMove) return
    replaceApplication({ ...backwardMove.app, stage: backwardMove.destination, stageHistory: backwardMove.nextHistory })
    notify(`Application moved back to ${backwardMove.destination}`, backwardMove.app)
    setBackwardMove(null)
  }

  const saveNote = (applicationId: number, note: { id?: string; title?: string; body: string }) => {
    const app = applications.find((item) => item.id === applicationId)
    if (!app) return
    const now = new Date().toISOString()
    const notes = getNotes(app)
    const nextNotes = note.id
      ? notes.map((item) => item.id === note.id ? { ...item, title: note.title?.trim() || undefined, body: note.body.trim(), editedAt: now } : item)
      : [{ id: `note-${applicationId}-${Date.now()}`, title: note.title?.trim() || undefined, body: note.body.trim(), createdAt: now }, ...notes]
    replaceApplication({ ...app, notes: nextNotes.length, noteEntries: nextNotes })
    notify(note.id ? 'Note updated' : 'Note added')
  }

  const deleteNote = (applicationId: number, noteId: string) => {
    const app = applications.find((item) => item.id === applicationId)
    if (!app) return
    const nextNotes = getNotes(app).filter((note) => note.id !== noteId)
    replaceApplication({ ...app, notes: nextNotes.length, noteEntries: nextNotes })
    notify('Note deleted')
  }

  const requestStageRemoval = (applicationId: number, entry: StageHistoryEntry) => {
    const app = applications.find((item) => item.id === applicationId)
    if (!app || getStageHistory(app).length <= 1) return
    setStageRemoval({ app, entry })
  }

  const confirmStageRemoval = () => {
    if (!stageRemoval) return
    const history = getStageHistory(stageRemoval.app).filter((entry) => entry.id !== stageRemoval.entry.id)
    const updated = { ...stageRemoval.app, stage: history.at(-1)!.stage, stageHistory: history }
    replaceApplication(updated)
    notify(`${stageRemoval.entry.stage} removed from timeline`, stageRemoval.app)
    setStageRemoval(null)
  }

  const archiveApp = (id: number) => {
    const app = applications.find((item) => item.id === id)
    if (!app) return
    setArchived((items) => [{ ...app }, ...items])
    setApplications((items) => items.filter((item) => item.id !== id))
    setDragged(null)
    setModal(null)
    notify(`${app.company} archived`)
  }

  const restoreApp = (id: number) => {
    const app = archived.find((item) => item.id === id)
    if (!app) return
    setApplications((items) => [...items, app])
    setArchived((items) => items.filter((item) => item.id !== id))
    notify(`${app.company} restored to ${app.stage}`)
  }

  const openAddApplication = (stage = 'Interested') => {
    setAddStage(stage)
    setModal('add')
  }

  const openGoalSettings = () => {
    setPage('settings')
    window.setTimeout(() => {
      const goalsSection = document.getElementById('goals')
      goalsSection?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      goalsSection?.focus({ preventScroll: true })
    }, 0)
  }

  if (!signedIn) return <AuthScreen onSignIn={() => setSignedIn(true)} />

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} onSignOut={() => setSignedIn(false)} />
      <header className="mobile-header">
        <button className="icon-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Icon name="menu" /></button>
        <div className="mobile-brand"><Logo /><strong>Trackline</strong></div>
        <button className="avatar small-avatar" aria-label="Profile">AM</button>
      </header>
      {mobileNav && <MobileNav page={page} onClose={() => setMobileNav(false)} onNavigate={(next) => { setPage(next); setMobileNav(false) }} />}

      <main className="main">
        {page === 'board' && (
          <Dashboard
            applications={filtered}
            stageOptions={availableStages}
            timeZone={timeZone}
            query={query}
            setQuery={setQuery}
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            filterStage={filterStage}
            setFilterStage={setFilterStage}
            onAdd={() => openAddApplication()}
            onAddToStage={openAddApplication}
            onQuick={() => { setImportStatus('idle'); setModal('quick') }}
            onDetails={openDetails}
            onMove={moveApp}
            onArchive={archiveApp}
            dragged={dragged}
            setDragged={setDragged}
            goalsEnabled={goalsEnabled}
            goalTarget={goalTarget}
            onConfigureGoals={openGoalSettings}
          />
        )}
        {page === 'archive' && (
          <Archive
            items={archived}
            selection={archiveSelection}
            setSelection={setArchiveSelection}
            onRestore={restoreApp}
            onDelete={(ids) => {
              if (!window.confirm(`Permanently delete ${ids.length} application${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
              setArchived((items) => items.filter((item) => !ids.includes(item.id)))
              setArchiveSelection([])
              notify('Application deleted permanently')
            }}
          />
        )}
        {page === 'settings' && (
          <Settings
            goalsEnabled={goalsEnabled}
            goalTarget={goalTarget}
            timeZone={timeZone}
            onSaveGoals={(enabled, target) => {
              setGoalsEnabled(enabled)
              setGoalTarget(target)
            }}
            onSaveTimeZone={setTimeZone}
            notify={notify}
          />
        )}
      </main>

      {modal === 'details' && selected && (
        <DetailsModal
          app={applications.find((item) => item.id === selected.id) || selected}
          tab={detailTab}
          setTab={setDetailTab}
          onClose={() => setModal(null)}
          onEvent={() => setModal('event')}
          onArchive={() => archiveApp(selected.id)}
          stageOptions={availableStages}
          timeZone={timeZone}
          onMove={(stage) => moveApp(selected.id, stage)}
          onSaveNote={saveNote}
          onDeleteNote={deleteNote}
          onDeleteStage={requestStageRemoval}
        />
      )}
      {modal === 'add' && <AddApplication initialStage={addStage} onClose={() => setModal(null)} onQuick={() => { setImportStatus('idle'); setModal('quick') }} onSave={(app) => {
        const id = Date.now()
        const createdAt = new Date().toISOString()
        setApplications((items) => [...items, hydrateApplication({ ...app, id, logo: app.company.charAt(0), tone: 'blue', notes: 0, createdAt, noteEntries: [], stageHistory: [{ id: `stage-${id}-0`, stage: app.stage, recordedAt: createdAt }] })])
        setModal(null)
        notify(`${app.company} added to ${app.stage}`)
      }} />}
      {modal === 'event' && selected && <EventModal app={selected} timeZone={timeZone} onClose={() => setModal('details')} onSave={() => { setModal('details'); notify('Event added to Google Calendar') }} />}
      {modal === 'quick' && <QuickAdd status={importStatus} setStatus={setImportStatus} onClose={() => setModal(null)} onManual={() => setModal('add')} onSave={() => {
        const id = Date.now()
        const createdAt = new Date().toISOString()
        setApplications((items) => [...items, hydrateApplication({ id, company: 'Miro', role: 'Senior Product Designer', stage: 'Interested', location: 'Remote · US', notes: 0, logo: 'M', tone: 'amber', salary: '$150k–$190k', type: 'Full-time', createdAt, noteEntries: [], stageHistory: [{ id: `stage-${id}-0`, stage: 'Interested', recordedAt: createdAt }] })])
        setModal(null)
        notify('Miro application imported')
      }} />}
      {backwardMove && <BackwardMoveDialog correction={backwardMove} onClose={() => setBackwardMove(null)} onConfirm={confirmBackwardMove} />}
      {stageRemoval && <RemoveStageDialog stage={stageRemoval.entry.stage} onClose={() => setStageRemoval(null)} onConfirm={confirmStageRemoval} />}
      {toast && <div className="toast"><span className="toast-check"><Icon name="check" size={14} /></span><span>{toast}</span>{undoApplication ? <button onClick={() => {
        replaceApplication(undoApplication)
        setToast('')
        setUndoApplication(null)
      }}>Undo</button> : <button onClick={() => setToast('')}>Dismiss</button>}</div>}
    </div>
  )
}

function AuthScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-brand"><Logo /><span>Trackline</span></div>
        <div className="auth-copy">
          <span className="eyebrow light">A calmer way to job search</span>
          <h1>Keep every opportunity moving forward.</h1>
          <p>Organize applications, prepare for interviews, and stay ahead of every important date in one focused workspace.</p>
        </div>
        <div className="auth-board">
          <div><span>APPLIED</span><article><b>Notion</b><small>Product Designer, Growth</small></article></div>
          <div><span>INTERVIEW</span><article><b>Stripe</b><small>Product Designer, Core</small><em>Wed · 1:30 PM</em></article></div>
          <div><span>OFFER</span><article><b>Webflow</b><small>Design Systems Lead</small></article></div>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand"><Logo /><span>Trackline</span></div>
          <h2>Welcome back</h2>
          <p>Sign in to continue to your application workspace.</p>
          <button className="google-button" onClick={onSignIn}><span className="google-g">G</span>Continue with Google</button>
          <small>By continuing, you agree to our Terms and Privacy Policy.</small>
        </div>
      </div>
    </div>
  )
}

function Sidebar({ page, setPage, onSignOut }: { page: Page; setPage: (page: Page) => void; onSignOut: () => void }) {
  return (
    <aside className="sidebar">
      <div className="brand"><Logo /><span>Trackline</span></div>
      <nav>
        <span className="nav-label">WORKSPACE</span>
        <button className={page === 'board' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('board')}><Icon name="board" />Board</button>
        <button className={page === 'archive' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('archive')}><Icon name="archive" />Archive</button>
        <span className="nav-label second">ACCOUNT</span>
        <button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('settings')}><Icon name="settings" />Settings</button>
      </nav>
      <div className="sidebar-tip"><span><Icon name="sparkle" size={16} />Quick tip</span><p>Keep notes after every conversation while details are fresh.</p></div>
      <button className="profile-row" onClick={onSignOut}><span className="avatar">AM</span><span><b>Alex Morgan</b><small>alex@example.com</small></span><Icon name="chevron" size={16} /></button>
    </aside>
  )
}

function MobileNav({ page, onClose, onNavigate }: { page: Page; onClose: () => void; onNavigate: (page: Page) => void }) {
  return <div className="mobile-nav-backdrop" onMouseDown={onClose}><aside className="mobile-nav" onMouseDown={(e) => e.stopPropagation()}>
    <div className="mobile-nav-head"><div className="brand"><Logo /><span>Trackline</span></div><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div>
    <button className={page === 'board' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('board')}><Icon name="board" />Board</button>
    <button className={page === 'archive' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('archive')}><Icon name="archive" />Archive</button>
    <button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate('settings')}><Icon name="settings" />Settings</button>
  </aside></div>
}

type DashboardProps = {
  applications: Application[]; stageOptions: string[]; timeZone: string; query: string; setQuery: (v: string) => void
  filterOpen: boolean; setFilterOpen: (v: boolean) => void; filterStage: string; setFilterStage: (v: string) => void
  onAdd: () => void; onAddToStage: (stage: string) => void; onQuick: () => void; onDetails: (app: Application) => void; onMove: (id: number, stage: string) => void
  onArchive: (id: number) => void; dragged: number | null; setDragged: (id: number | null) => void
  goalsEnabled: boolean; goalTarget: number; onConfigureGoals: () => void
}

function Dashboard(props: DashboardProps) {
  const singleColumn = useSingleColumnBoard()
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const filterMenuRef = useDismissibleMenu(props.filterOpen, () => props.setFilterOpen(false))
  const [selectedStage, setSelectedStage] = useState(props.stageOptions[0])
  const [moveApplication, setMoveApplication] = useState<Application | null>(null)
  const [boardRange, setBoardRange] = useState({ start: 1, end: 1, overflow: false, atStart: true, atEnd: false })

  const updateBoardRange = useCallback(() => {
    const board = boardScrollRef.current
    if (!board) return
    const columns = Array.from(board.querySelectorAll<HTMLElement>('[data-kanban-column]'))
    if (!columns.length) return

    const viewLeft = board.scrollLeft
    const viewRight = viewLeft + board.clientWidth
    const inset = columns[0].offsetLeft
    const visible = columns
      .map((column, index) => ({ index, center: column.offsetLeft + column.offsetWidth / 2 }))
      .filter((column) => column.center >= viewLeft && column.center <= viewRight)
    const first = visible[0]?.index ?? 0
    const last = visible.at(-1)?.index ?? first
    const stageWidth = columns.at(-1)!.offsetLeft + columns.at(-1)!.offsetWidth - columns[0].offsetLeft

    setBoardRange({
      start: first + 1,
      end: last + 1,
      overflow: stageWidth + inset * 2 > board.clientWidth + 1,
      atStart: viewLeft <= 2,
      atEnd: columns.at(-1)!.offsetLeft + columns.at(-1)!.offsetWidth <= viewRight - inset + 2,
    })
  }, [])

  useEffect(() => {
    const board = boardScrollRef.current
    if (!board || singleColumn) return
    const resizeObserver = new ResizeObserver(updateBoardRange)
    resizeObserver.observe(board)
    board.addEventListener('scroll', updateBoardRange, { passive: true })
    const frame = window.requestAnimationFrame(updateBoardRange)
    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      board.removeEventListener('scroll', updateBoardRange)
    }
  }, [singleColumn, updateBoardRange, props.stageOptions])

  useEffect(() => {
    if (!props.stageOptions.includes(selectedStage)) setSelectedStage(props.stageOptions[0])
  }, [props.stageOptions, selectedStage])

  const scrollBoard = (direction: -1 | 1) => {
    const board = boardScrollRef.current
    if (!board) return
    const columns = Array.from(board.querySelectorAll<HTMLElement>('[data-kanban-column]'))
    if (!columns.length) return
    const inset = columns[0].offsetLeft
    const currentIndex = columns.reduce((closest, column, index) => {
      const currentDistance = Math.abs(columns[closest].offsetLeft - inset - board.scrollLeft)
      const candidateDistance = Math.abs(column.offsetLeft - inset - board.scrollLeft)
      return candidateDistance < currentDistance ? index : closest
    }, 0)
    const targetIndex = Math.max(0, Math.min(columns.length - 1, currentIndex + direction))
    board.scrollTo({ left: columns[targetIndex].offsetLeft - inset, behavior: 'smooth' })
  }

  const selectedStageIndex = props.stageOptions.indexOf(selectedStage)
  const selectedStageItems = props.applications.filter((app) => app.stage === selectedStage)

  return (
    <div className="dashboard">
      <div className="page-header">
        <div><div className="header-kicker">MONDAY, MAY 20</div><h1>Your applications</h1><p>Keep the momentum going. You have 3 upcoming events this week.</p></div>
        <div className="header-actions"><button className="secondary-button" onClick={props.onQuick}><Icon name="link" />Quick add</button><button className="primary-button" onClick={props.onAdd}><Icon name="plus" />Add application</button></div>
      </div>
      <div className="dashboard-grid">
        <section className="board-panel">
          <div className="toolbar">
            <div className="search-field"><Icon name="search" /><input aria-label="Search applications" value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="Search applications..." />{props.query && <button onClick={() => props.setQuery('')}><Icon name="close" size={15} /></button>}</div>
            <div className="filter-wrap">
              <button className={props.filterStage !== 'All stages' ? 'secondary-button compact selected' : 'secondary-button compact'} onClick={() => props.setFilterOpen(!props.filterOpen)}><Icon name="filter" />Filter{props.filterStage !== 'All stages' && <span className="filter-count">1</span>}</button>
              {props.filterOpen && <div className="filter-menu" ref={filterMenuRef}><span>Hiring stage</span>{['All stages', ...props.stageOptions].map((stage) => <button key={stage} onClick={() => { props.setFilterStage(stage); props.setFilterOpen(false) }}><span className={props.filterStage === stage ? 'radio active' : 'radio'} />{stage}</button>)}</div>}
            </div>
            <button className="icon-button toolbar-more" aria-label="Board options"><Icon name="dots" /></button>
          </div>
          {singleColumn ? (
            <div className="board-navigation mobile-board-navigation">
              <button className="board-nav-arrow previous" disabled={selectedStageIndex === 0} onClick={() => setSelectedStage(props.stageOptions[selectedStageIndex - 1])} aria-label="Previous hiring stage"><Icon name="chevron" /></button>
              <label className="mobile-stage-selector">
                <span className={`stage-dot ${selectedStage.toLowerCase().replace(' ', '-')}`} />
                <span className="stage-select-copy">
                  <select aria-label="Select hiring stage" value={selectedStage} onChange={(event) => setSelectedStage(event.target.value)}>
                    {props.stageOptions.map((stage) => <option key={stage}>{stage}</option>)}
                  </select>
                  <small>{selectedStageItems.length} {selectedStageItems.length === 1 ? 'application' : 'applications'}</small>
                </span>
                <Icon name="chevron" size={15} />
              </label>
              <button className="board-nav-arrow" disabled={selectedStageIndex === props.stageOptions.length - 1} onClick={() => setSelectedStage(props.stageOptions[selectedStageIndex + 1])} aria-label="Next hiring stage"><Icon name="chevron" /></button>
            </div>
          ) : boardRange.overflow && (
            <div className="board-navigation desktop-board-navigation">
              <span>Showing {boardRange.start}–{boardRange.end} of {props.stageOptions.length} stages</span>
              <div>
                <button className="board-nav-arrow previous" disabled={boardRange.atStart} onClick={() => scrollBoard(-1)} aria-label="Show previous Kanban column"><Icon name="chevron" /></button>
                <button className="board-nav-arrow" disabled={boardRange.atEnd} onClick={() => scrollBoard(1)} aria-label="Show next Kanban column"><Icon name="chevron" /></button>
              </div>
            </div>
          )}
          <div className={singleColumn ? 'board-scroll single-stage-board' : 'board-scroll'} ref={boardScrollRef}>
            <div className={singleColumn ? 'kanban mobile-kanban' : 'kanban'}>
              {(singleColumn ? [selectedStage] : props.stageOptions).map((stage) => {
                const items = props.applications.filter((app) => app.stage === stage)
                return <KanbanColumn key={stage} stage={stage} items={items} mobile={singleColumn} timeZone={props.timeZone} onAdd={props.onAddToStage} onDetails={props.onDetails} onRequestMove={setMoveApplication} onMove={props.onMove} onArchive={props.onArchive} setDragged={props.setDragged} />
              })}
              {!singleColumn && <button className="add-stage"><Icon name="plus" />Add stage</button>}
            </div>
          </div>
          {props.dragged !== null && <div className="archive-drop" onDragOver={(e) => e.preventDefault()} onDrop={() => props.onArchive(props.dragged!)}><span><Icon name="archive" /></span><b>Drop to archive</b></div>}
        </section>
        <aside className="widgets">
          <UpcomingEvents timeZone={props.timeZone} onOpen={(id) => {
            const app = props.applications.find((item) => item.id === id)
            if (app) props.onDetails(app)
          }} />
          {props.goalsEnabled ? <GoalsWidget target={props.goalTarget} onConfigure={props.onConfigureGoals} /> : <EnableGoals onConfigure={props.onConfigureGoals} />}
        </aside>
      </div>
      {moveApplication && <MoveStageDialog app={moveApplication} stageOptions={props.stageOptions} onClose={() => setMoveApplication(null)} onMove={(stage) => {
        props.onMove(moveApplication.id, stage)
        setMoveApplication(null)
      }} />}
    </div>
  )
}

function KanbanColumn({ stage, items, mobile, timeZone, onAdd, onDetails, onRequestMove, onMove, onArchive, setDragged }: { stage: string; items: Application[]; mobile: boolean; timeZone: string; onAdd: (stage: string) => void; onDetails: (app: Application) => void; onRequestMove: (app: Application) => void; onMove: (id: number, stage: string) => void; onArchive: (id: number) => void; setDragged: (id: number | null) => void }) {
  const [menu, setMenu] = useState<number | null>(null)
  const [columnMenu, setColumnMenu] = useState(false)
  const cardMenuRef = useDismissibleMenu(menu !== null, () => setMenu(null))
  const columnMenuRef = useDismissibleMenu(columnMenu, () => setColumnMenu(false))
  return (
    <div className="kanban-column" data-kanban-column onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = Number(e.dataTransfer.getData('appId')); if (id) onMove(id, stage) }}>
      {!mobile && <div className="column-header"><span className={`stage-dot ${stage.toLowerCase().replace(' ', '-')}`} /><h3>{stage}</h3><span className="count">{items.length}</span><button onClick={() => setColumnMenu(!columnMenu)} aria-label={`${stage} options`} aria-expanded={columnMenu}><Icon name="dots" size={17} /></button>{columnMenu && <div className="card-menu column-menu" ref={columnMenuRef}><button onClick={() => { onAdd(stage); setColumnMenu(false) }}><Icon name="plus" />Add application</button></div>}</div>}
      <div className="column-body">
        {items.map((app) => <article className="application-card" key={app.id} draggable={!mobile} onDragStart={(e) => { e.dataTransfer.setData('appId', String(app.id)); setDragged(app.id) }} onDragEnd={() => setDragged(null)} onClick={() => onDetails(app)}>
          <div className="card-top"><span className={`company-logo ${app.tone}`}>{app.logo}</span><button onClick={(e) => { e.stopPropagation(); setMenu(menu === app.id ? null : app.id) }} aria-label="Application menu" aria-expanded={menu === app.id}><Icon name="dots" size={17} /></button>
            {menu === app.id && <div className="card-menu" ref={cardMenuRef}>
              <button onClick={(e) => { e.stopPropagation(); onDetails(app); setMenu(null) }}><Icon name="edit" />View details</button>
              <button onClick={(e) => { e.stopPropagation(); onRequestMove(app); setMenu(null) }}><Icon name="arrow" />Move to…</button>
              <button className="danger-text" onClick={(e) => { e.stopPropagation(); onArchive(app.id); setMenu(null) }}><Icon name="archive" />Archive</button>
            </div>}
          </div>
          <h4>{app.company}</h4><p>{app.role}</p><div className="location">{app.location}</div>
          <div className={app.deadlineAt ? 'deadline' : 'deadline deadline-empty'}>{app.deadlineAt && <><Icon name="clock" size={13} />{formatTimestamp(app.deadlineAt, timeZone)}</>}</div>
          <div className="card-footer">{app.date ? <span>Applied {app.date}</span> : <span className="muted">Not applied</span>} {app.notes > 0 && <span><Icon name="note" size={13} />{app.notes}</span>}</div>
        </article>)}
        {mobile && items.length === 0 && <div className="empty-column"><span><Icon name="inbox" /></span><b>No applications in this stage yet.</b><p>Add an opportunity when you're ready.</p></div>}
        <button className="column-add" onClick={() => onAdd(stage)}><Icon name="plus" size={16} />Add application</button>
      </div>
    </div>
  )
}

function MoveStageDialog({ app, stageOptions, onClose, onMove }: { app: Application; stageOptions: string[]; onClose: () => void; onMove: (stage: string) => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const firstDestination = stageOptions.find((stage) => stage !== app.stage)
  return <div className="modal-backdrop center" onMouseDown={onClose}><section className="dialog move-stage-dialog" role="dialog" aria-modal="true" aria-labelledby="move-stage-title" onMouseDown={(event) => event.stopPropagation()}>
    <div className="dialog-header"><div><h2 id="move-stage-title">Move application</h2><p>{app.company} · {app.role}</p></div><button className="icon-button" onClick={onClose} aria-label="Close move application dialog"><Icon name="close" /></button></div>
    <div className="move-stage-list" role="list">
      {stageOptions.map((stage) => {
        const current = stage === app.stage
        return <button key={stage} autoFocus={stage === firstDestination} disabled={current} onClick={() => onMove(stage)}>
          <span className={`stage-dot ${stage.toLowerCase().replace(' ', '-')}`} />
          <span><b>{stage}</b>{current && <small>Current stage</small>}</span>
          {current ? <Icon name="check" /> : <Icon name="chevron" />}
        </button>
      })}
    </div>
  </section></div>
}

function BackwardMoveDialog({ correction, onClose, onConfirm }: { correction: { app: Application; destination: string; removed: StageHistoryEntry[] }; onClose: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="modal-backdrop center" onMouseDown={onClose}><section className="dialog confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="backward-move-title" onMouseDown={(event) => event.stopPropagation()}>
    <div className="dialog-header"><div><h2 id="backward-move-title">Move application back to {correction.destination}?</h2><p>This application is currently in {correction.app.stage}. Moving it backward will remove the later hiring stages from its timeline.</p></div><button className="icon-button" onClick={onClose} aria-label="Cancel backward move"><Icon name="close" /></button></div>
    <div className="confirmation-content"><span>Stages that will be removed</span><ul>{correction.removed.map((entry) => <li key={entry.id}><span className={`stage-dot ${entry.stage.toLowerCase().replace(' ', '-')}`} />{entry.stage}</li>)}</ul></div>
    <div className="dialog-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={onConfirm}>Move back & remove stages</button></div>
  </section></div>
}

function RemoveStageDialog({ stage, onClose, onConfirm }: { stage: string; onClose: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="modal-backdrop center" onMouseDown={onClose}><section className="dialog confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-stage-title" onMouseDown={(event) => event.stopPropagation()}>
    <div className="dialog-header"><div><h2 id="remove-stage-title">Remove {stage} from timeline?</h2><p>This will remove the selected stage from this application's history. Other stages will remain unchanged.</p></div><button className="icon-button" onClick={onClose} aria-label="Cancel stage removal"><Icon name="close" /></button></div>
    <div className="dialog-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="danger-button" onClick={onConfirm}>Remove stage</button></div>
  </section></div>
}

function UpcomingEvents({ timeZone, onOpen }: { timeZone: string; onOpen: (id: number) => void }) {
  return <section className="widget"><div className="widget-title"><div><span className="widget-icon"><Icon name="calendar" /></span><h3>Upcoming</h3></div><button>View all</button></div>
    <div className="event-list">{events.map((event, index) => <button className="event-row" onClick={() => onOpen(event.id)} key={event.id}><span className={`event-line ${event.tone}`} /><span className="event-date"><b>{formatEventDay(event.startsAt, timeZone)}</b><small>{formatEventMonth(event.startsAt, timeZone)}</small></span><span className="event-copy"><b>{event.company}</b><small>{event.type}</small><em>{formatEventDate(event.startsAt, timeZone)} · {formatEventTime(event.startsAt, timeZone)}</em></span>{index === 0 && <span className="soon">SOON</span>}</button>)}</div>
  </section>
}

function EnableGoals({ onConfigure }: { onConfigure: () => void }) {
  return <section className="widget goals-empty"><span className="goal-illustration"><Icon name="goal" size={24} /></span><div><h3>Set a daily goal</h3><p>A gentle target can help you stay consistent. No streaks, no pressure.</p></div><button className="text-button" onClick={onConfigure}>Set a goal <Icon name="arrow" size={15} /></button></section>
}

function GoalsWidget({ target, onConfigure }: { target: number; onConfigure: () => void }) {
  const completed = 2
  const pct = target === 0 ? 100 : Math.min(100, (completed / target) * 100)
  return <section className="widget goals-widget"><div className="widget-title"><div><span className="widget-icon teal"><Icon name="goal" /></span><h3>Today's goal</h3></div><div className="goal-widget-actions"><span>{completed}/{target}</span><button onClick={onConfigure} aria-label="Configure daily goal"><Icon name="settings" size={15} /></button></div></div><div className="progress"><span style={{ width: `${pct}%` }} /></div><p>{target === 0 ? 'No target today. Keep your own pace.' : completed >= target ? 'Goal complete. Nicely done.' : `${target - completed} more application to reach your goal.`}</p></section>
}

function DetailsModal({ app, tab, setTab, onClose, onEvent, onArchive, stageOptions, timeZone, onMove, onSaveNote, onDeleteNote, onDeleteStage }: { app: Application; tab: string; setTab: (tab: string) => void; onClose: () => void; onEvent: () => void; onArchive: () => void; stageOptions: string[]; timeZone: string; onMove: (stage: string) => void; onSaveNote: (applicationId: number, note: { id?: string; title?: string; body: string }) => void; onDeleteNote: (applicationId: number, noteId: string) => void; onDeleteStage: (applicationId: number, entry: StageHistoryEntry) => void }) {
  const [noteEditor, setNoteEditor] = useState<{ id?: string; title: string; body: string } | null>(null)
  const [noteMenu, setNoteMenu] = useState<string | null>(null)
  const [timelineMenu, setTimelineMenu] = useState<string | null>(null)
  const noteMenuRef = useDismissibleMenu(noteMenu !== null, () => setNoteMenu(null))
  const timelineMenuRef = useDismissibleMenu(timelineMenu !== null, () => setTimelineMenu(null))
  const notes = [...getNotes(app)].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const history = getStageHistory(app)

  return <div className="modal-backdrop" onMouseDown={onClose}><section className="detail-drawer" onMouseDown={(e) => e.stopPropagation()}>
    <div className="drawer-header"><div className="detail-company"><span className={`company-logo large ${app.tone}`}>{app.logo}</span><div><span>{app.company}</span><h2>{app.role}</h2><small>{app.location}</small></div></div><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div>
    <div className="detail-actions"><button className="primary-button" onClick={onEvent}><Icon name="calendar" />Add event</button><select value={app.stage} onChange={(e) => onMove(e.target.value)}>{stageOptions.map((stage) => <option key={stage}>{stage}</option>)}</select><button className="icon-button" onClick={onArchive} aria-label="Archive"><Icon name="archive" /></button></div>
    <div className="tabs">{['Overview', 'Notes', 'Timeline', 'Events'].map((item) => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}{item === 'Notes' && <span>{app.notes}</span>}</button>)}</div>
    <div className="detail-content">
      {tab === 'Overview' && <><div className="detail-section"><div className="section-heading"><h3>Application details</h3><button><Icon name="edit" size={15} />Edit</button></div><dl className="detail-grid"><div><dt>Company</dt><dd>{app.company}</dd></div><div><dt>Employment type</dt><dd>{app.type || 'Full-time'}</dd></div><div><dt>Location</dt><dd>{app.location}</dd></div><div><dt>Compensation</dt><dd>{app.salary || 'Not specified'}</dd></div><div><dt>Application date</dt><dd>{app.date || 'Not yet applied'}</dd></div><div><dt>Current stage</dt><dd><span className="stage-pill">{app.stage}</span></dd></div></dl></div>
        <div className="detail-section"><div className="section-heading"><h3>Job posting</h3><button><Icon name="link" size={15} />Open original</button></div><p className="description">Join the product design team to shape thoughtful, high-quality experiences used by teams around the world. You’ll work closely with product and engineering to turn complex workflows into simple, intuitive tools.</p><button className="show-more">Show full description <Icon name="chevron" size={14} /></button></div>
        <div className="detail-section"><div className="section-heading"><h3>Next up</h3></div>{app.deadlineAt ? <div className="next-event"><span><Icon name="calendar" /></span><div><b>{app.stage === 'Assessment' ? 'Assessment deadline' : 'Interview'}</b><p>{formatTimestamp(app.deadlineAt, timeZone)}</p></div><button onClick={onEvent}>Edit</button></div> : <div className="empty-inline">No upcoming events. <button onClick={onEvent}>Add one</button></div>}</div></>}
      {tab === 'Notes' && <div className="detail-section notes-section"><div className="section-heading"><h3>Notes</h3>{!noteEditor && <button onClick={() => setNoteEditor({ title: '', body: '' })}><Icon name="plus" size={15} />Add note</button>}</div>
        {noteEditor && <NoteEditor note={noteEditor} onCancel={() => setNoteEditor(null)} onSave={(note) => { onSaveNote(app.id, note); setNoteEditor(null) }} />}
        <div className="notes-list">{notes.map((note) => <article className="note-card" key={note.id}>
          <div className="note-card-heading"><div><b>{note.title || note.body.split('\n')[0].slice(0, 54)}</b><small>Created {formatTimestamp(note.createdAt, timeZone)}{note.editedAt && <span className="edited-indicator" title={`Last edited ${formatTimestamp(note.editedAt, timeZone)}`}> · Edited</span>}</small></div><button className="note-menu-button" onClick={() => setNoteMenu(noteMenu === note.id ? null : note.id)} aria-label="Note options" aria-expanded={noteMenu === note.id}><Icon name="dots" size={17} /></button>
            {noteMenu === note.id && <div className="card-menu note-menu" ref={noteMenuRef}><button onClick={() => { setNoteEditor({ id: note.id, title: note.title || '', body: note.body }); setNoteMenu(null) }}><Icon name="edit" />Edit note</button><button className="danger-text" onClick={() => { setNoteMenu(null); if (window.confirm('Delete this note? This cannot be undone.')) onDeleteNote(app.id, note.id) }}><Icon name="trash" />Delete note</button></div>}
          </div><p>{note.body}</p>
        </article>)}</div>
        {notes.length === 0 && !noteEditor && <div className="empty-state compact"><Icon name="note" /><h4>No notes yet</h4><p>Add context from interviews, assessments, or recruiter conversations.</p></div>}
      </div>}
      {tab === 'Timeline' && <div className="detail-section timeline-section"><div className="section-heading"><h3>Application history</h3><span className="timeline-help">Stages determine Kanban placement</span></div><div className="timeline">
        {[...history].reverse().map((entry, reverseIndex) => {
          const current = reverseIndex === 0
          return <div className="timeline-entry" key={entry.id}><span className={current ? 'current' : ''} /><div><b>{entry.stage}{current && <em>Current</em>}</b><small>Hiring stage · {formatTimestamp(entry.recordedAt, timeZone)}</small></div><button className="timeline-menu-button" onClick={() => setTimelineMenu(timelineMenu === entry.id ? null : entry.id)} aria-label={`${entry.stage} timeline options`} aria-expanded={timelineMenu === entry.id}><Icon name="dots" size={17} /></button>
            {timelineMenu === entry.id && <div className="card-menu timeline-menu" ref={timelineMenuRef}><button className="danger-text" disabled={history.length <= 1} title={history.length <= 1 ? 'An application must retain one stage' : undefined} onClick={() => { setTimelineMenu(null); onDeleteStage(app.id, entry) }}><Icon name="trash" />Remove stage</button></div>}
          </div>
        })}
        <div className="timeline-entry activity-entry"><span /><div><b>Application created</b><small>Activity · {formatTimestamp(app.createdAt || '2025-05-08T09:14:00-07:00', timeZone)}</small></div></div>
      </div></div>}
      {tab === 'Events' && <div className="detail-section"><div className="section-heading"><h3>Events</h3><button onClick={onEvent}><Icon name="plus" size={15} />Create event</button></div>{app.deadlineAt ? <div className="next-event"><span><Icon name="calendar" /></span><div><b>Upcoming interview</b><p>{formatTimestamp(app.deadlineAt, timeZone)}</p></div></div> : <div className="empty-state"><Icon name="calendar" size={28} /><h4>No events yet</h4><p>Schedule an interview, assessment, or follow-up.</p><button className="secondary-button" onClick={onEvent}>Create event</button></div>}</div>}
    </div>
  </section></div>
}

function NoteEditor({ note, onCancel, onSave }: { note: { id?: string; title: string; body: string }; onCancel: () => void; onSave: (note: { id?: string; title?: string; body: string }) => void }) {
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  return <div className="note-editor"><label>Title <span>Optional</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Recruiter conversation" /></label><label>Note <span>Required</span><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write your note..." /></label><div><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={!body.trim()} onClick={() => onSave({ id: note.id, title, body })}>Save note</button></div></div>
}

function AddApplication({ initialStage, onClose, onQuick, onSave }: { initialStage: string; onClose: () => void; onQuick: () => void; onSave: (app: Application) => void }) {
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [stage, setStage] = useState(initialStage)
  const [location, setLocation] = useState('')
  const stageOptions = stages.includes(initialStage) ? stages : [initialStage, ...stages]
  return <div className="modal-backdrop center" onMouseDown={onClose}><section className="dialog wide-dialog" onMouseDown={(e) => e.stopPropagation()}>
    <div className="dialog-header"><div><h2>Add application</h2><p>Save the essentials now. You can add details anytime.</p></div><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div>
    <button className="import-banner" onClick={onQuick}><span><Icon name="sparkle" /></span><div><b>Save time with Quick Add</b><small>Paste a job posting URL and we'll fill in the details.</small></div><Icon name="chevron" /></button>
    <div className="form-grid"><label>Company name <span>*</span><input autoFocus value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme" /></label><label>Position title <span>*</span><input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Product Designer" /></label><label>Location<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, state, or Remote" /></label><label>Employment type<select><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></label><label>Current stage<select value={stage} onChange={(e) => setStage(e.target.value)}>{stageOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Application date<input type="date" /></label><label className="full">Job posting URL<input placeholder="https://..." /></label><label className="full">Job description<textarea placeholder="Paste the job description or add your own notes..." /></label></div>
    <div className="dialog-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!company || !role} onClick={() => onSave({ id: 0, company, role, stage, location: location || 'Remote', notes: 0, logo: '', tone: 'blue', type: 'Full-time' })}>Add application</button></div>
  </section></div>
}

function EventModal({ app, timeZone, onClose, onSave }: { app: Application; timeZone: string; onClose: () => void; onSave: () => void }) {
  const [type, setType] = useState('Interview')
  const [eventTimeZone, setEventTimeZone] = useState(timeZone)
  const timeZoneOptions = Array.from(new Set([timeZone, detectBrowserTimeZone(), ...commonTimeZones]))
  return <div className="modal-backdrop center" onMouseDown={onClose}><section className="dialog" onMouseDown={(e) => e.stopPropagation()}>
    <div className="dialog-header"><div><h2>Create calendar event</h2><p>For {app.company} · {app.role}</p></div><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div>
    <div className="calendar-connected"><span className="google-calendar-icon"><Icon name="calendar" /></span><div><b>Google Calendar</b><small>Connected as alex@example.com</small></div><span className="connected"><Icon name="check" size={13} />Connected</span></div>
    <div className="form-grid"><label className="full">Event type<select value={type} onChange={(e) => setType(e.target.value)}><option>Interview</option><option>Skills Assessment</option><option>Follow-up</option><option>Other</option></select></label><label className="full">Event title<input value={`${type} · ${app.company}`} readOnly /></label><label>{type === 'Skills Assessment' ? 'Deadline date' : 'Date'}<input type="date" defaultValue="2026-11-05" /></label><label>{type === 'Skills Assessment' ? 'Cutoff time' : 'Start time'}<input type="time" defaultValue="13:30" /></label>{type !== 'Skills Assessment' && <label>Duration<select><option>30 minutes</option><option>45 minutes</option><option>1 hour</option><option>1.5 hours</option></select></label>}<label>Time zone<select value={eventTimeZone} onChange={(event) => setEventTimeZone(event.target.value)}>{timeZoneOptions.map((zone) => <option key={zone} value={zone}>{timeZoneLabel(zone)}</option>)}</select></label><label className="full">Reminder<select><option>30 minutes before</option><option>1 hour before</option><option>1 day before</option><option>No reminder</option></select></label></div>
    <div className="dialog-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={onSave}><Icon name="calendar" />Add to Google Calendar</button></div>
  </section></div>
}

function QuickAdd({ status, setStatus, onClose, onManual, onSave }: { status: 'idle' | 'loading' | 'ready' | 'error'; setStatus: (status: 'idle' | 'loading' | 'ready' | 'error') => void; onClose: () => void; onManual: () => void; onSave: () => void }) {
  const [url, setUrl] = useState('')
  const extract = () => {
    if (!url.startsWith('http')) { setStatus('error'); return }
    setStatus('loading')
    window.setTimeout(() => setStatus('ready'), 1100)
  }
  return <div className="modal-backdrop center" onMouseDown={onClose}><section className="dialog" onMouseDown={(e) => e.stopPropagation()}>
    <div className="dialog-header"><div><h2>Quick add from URL</h2><p>Paste a job posting and review the details before saving.</p></div><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div>
    {status !== 'ready' ? <div className="quick-body"><div className="quick-icon"><Icon name="link" size={24} /></div><label>Job posting URL<div className={status === 'error' ? 'url-input error' : 'url-input'}><Icon name="link" /><input value={url} onChange={(e) => { setUrl(e.target.value); if (status === 'error') setStatus('idle') }} placeholder="https://company.com/jobs/..." /></div>{status === 'error' && <small className="field-error">Enter a valid URL beginning with http.</small>}</label>{status === 'loading' && <div className="extracting"><span className="spinner" /><div><b>Reading job posting…</b><small>Finding company, role, location, and compensation.</small></div></div>}<p className="quick-privacy">This is a simulated import. No information is sent or saved until you review it.</p></div> :
      <div className="quick-review"><div className="success-banner"><span><Icon name="check" /></span><div><b>Job details found</b><small>Review and edit anything that doesn't look right.</small></div></div><div className="form-grid"><label>Company<input defaultValue="Miro" /></label><label>Position title<input defaultValue="Senior Product Designer" /></label><label>Location<input defaultValue="Remote · US" /></label><label>Compensation<input defaultValue="$150k–$190k" /></label><label>Employment type<select defaultValue="Full-time"><option>Full-time</option></select></label><label>Stage<select><option>Interested</option><option>Applied</option></select></label><label className="full">Job description<textarea defaultValue="Help shape collaborative experiences for distributed product teams. Partner with product and engineering to define and deliver intuitive workflows..." /></label></div></div>}
    <div className="dialog-footer split"><button className="text-button" onClick={onManual}>Enter manually instead</button><div><button className="secondary-button" onClick={onClose}>Cancel</button>{status === 'ready' ? <button className="primary-button" onClick={onSave}>Save application</button> : <button className="primary-button" disabled={status === 'loading'} onClick={extract}>{status === 'loading' ? 'Importing…' : 'Import details'}</button>}</div></div>
  </section></div>
}

function Archive({ items, selection, setSelection, onRestore, onDelete }: { items: Application[]; selection: number[]; setSelection: (ids: number[]) => void; onRestore: (id: number) => void; onDelete: (ids: number[]) => void }) {
  const [query, setQuery] = useState('')
  const visible = items.filter((item) => `${item.company} ${item.role}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="content-page"><div className="page-header archive-header"><div><div className="header-kicker">WORKSPACE</div><h1>Archive</h1><p>Restore applications to their previous stage or remove them permanently.</p></div>{items.length > 0 && <button className="danger-button" onClick={() => onDelete(items.map((item) => item.id))}><Icon name="trash" />Delete all</button>}</div>
    <section className="archive-panel"><div className="archive-tools"><div className="search-field"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search archive..." /></div>{selection.length > 0 && <div className="bulk-actions"><span>{selection.length} selected</span><button onClick={() => selection.forEach(onRestore)}>Restore</button><button className="danger-text" onClick={() => onDelete(selection)}><Icon name="trash" size={15} />Delete</button></div>}</div>
      {visible.length === 0 ? <div className="archive-empty"><span><Icon name="archive" size={28} /></span><h2>{items.length === 0 ? 'Your archive is empty' : 'No matches found'}</h2><p>{items.length === 0 ? 'Archived applications will appear here. You can restore them anytime.' : 'Try a different company or position title.'}</p></div> :
      <div className="archive-table"><div className="archive-row archive-table-head"><label><input type="checkbox" checked={selection.length === visible.length} onChange={(e) => setSelection(e.target.checked ? visible.map((item) => item.id) : [])} /><span /></label><span>APPLICATION</span><span>PREVIOUS STAGE</span><span>ARCHIVED</span><span /></div>{visible.map((app) => <div className="archive-row" key={app.id}><label><input type="checkbox" checked={selection.includes(app.id)} onChange={(e) => setSelection(e.target.checked ? [...selection, app.id] : selection.filter((id) => id !== app.id))} /><span /></label><div className="archived-company"><span className={`company-logo ${app.tone}`}>{app.logo}</span><div><b>{app.company}</b><small>{app.role}</small></div></div><span><i className="stage-pill">{app.stage}</i></span><span className="archive-date">May 18, 2025</span><div className="row-actions"><button onClick={() => onRestore(app.id)}>Restore</button><button className="icon-button danger-text" onClick={() => onDelete([app.id])}><Icon name="trash" /></button></div></div>)}</div>}
    </section>
  </div>
}

function Settings({ goalsEnabled, goalTarget, timeZone, onSaveGoals, onSaveTimeZone, notify }: { goalsEnabled: boolean; goalTarget: number; timeZone: string; onSaveGoals: (enabled: boolean, target: number) => void; onSaveTimeZone: (timeZone: string) => void; notify: (message: string) => void }) {
  const [connected, setConnected] = useState(true)
  const [dark, setDark] = useState(false)
  const [draftGoalsEnabled, setDraftGoalsEnabled] = useState(goalsEnabled)
  const [draftGoalTarget, setDraftGoalTarget] = useState(goalTarget)
  const [draftTimeZone, setDraftTimeZone] = useState(timeZone)
  const timeZoneOptions = Array.from(new Set([timeZone, detectBrowserTimeZone(), ...commonTimeZones]))
  const saveSettings = () => {
    onSaveGoals(draftGoalsEnabled, draftGoalTarget)
    onSaveTimeZone(draftTimeZone)
    notify('Settings saved')
  }
  return <div className="content-page settings-page"><div className="page-header"><div><div className="header-kicker">ACCOUNT</div><h1>Settings</h1><p>Manage your preferences and connected services.</p></div><button className="primary-button" onClick={saveSettings}>Save changes</button></div>
    <div className="settings-layout"><nav className="settings-nav"><a href="#profile" className="active"><Icon name="user" />Profile</a><a href="#calendar"><Icon name="calendar" />Calendar</a><a href="#goals"><Icon name="goal" />Daily goals</a><a href="#stages"><Icon name="board" />Hiring stages</a><a href="#appearance"><Icon name="settings" />Appearance</a></nav>
      <div className="settings-content">
        <section className="settings-card" id="profile"><div className="settings-card-title"><h2>Profile</h2><p>Your personal details and regional preferences.</p></div><div className="profile-setting"><span className="avatar large-avatar">AM</span><div><b>Profile photo</b><small>JPG or PNG. Maximum 2 MB.</small><button>Change photo</button></div></div><div className="form-grid"><label>Display name<input defaultValue="Alex Morgan" /></label><label>Email address<input defaultValue="alex@example.com" disabled /></label><label className="full">Time zone<select value={draftTimeZone} onChange={(event) => setDraftTimeZone(event.target.value)}>{timeZoneOptions.map((zone) => <option key={zone} value={zone}>{timeZoneLabel(zone)}{zone === detectBrowserTimeZone() ? ' (Local)' : ''}</option>)}</select></label></div></section>
        <section className="settings-card" id="calendar"><div className="settings-card-title"><h2>Google Calendar</h2><p>Create interview and assessment events without re-entering job details.</p></div><div className="connection-row"><span className="google-calendar-icon"><Icon name="calendar" /></span><div><b>{connected ? 'Google Calendar connected' : 'Connect Google Calendar'}</b><small>{connected ? 'alex@example.com · Last synced just now' : 'Add events to your calendar directly from an application.'}</small></div><button className={connected ? 'secondary-button' : 'primary-button'} onClick={() => setConnected(!connected)}>{connected ? 'Disconnect' : 'Connect'}</button></div></section>
        <section className="settings-card" id="goals" tabIndex={-1}><div className="setting-toggle-row"><div><h2>Daily application goal</h2><p>Set a gentle daily target. You can change or disable it anytime.</p></div><Toggle checked={draftGoalsEnabled} onChange={setDraftGoalsEnabled} /></div>{draftGoalsEnabled && <div className="goal-setting"><label>Daily target<input type="number" min="0" max="20" value={draftGoalTarget} onChange={(e) => setDraftGoalTarget(Math.max(0, Number(e.target.value)))} /></label><p>Set to 0 for no target while keeping goal insights visible.</p></div>}</section>
        <section className="settings-card" id="stages"><div className="settings-card-title row"><div><h2>Hiring stages</h2><p>Drag to reorder stages or rename them to match your process.</p></div><button className="secondary-button"><Icon name="plus" />Add stage</button></div><div className="stage-settings">{stages.map((stage) => <div key={stage}><span className="drag-handle">⠿</span><span className={`stage-dot ${stage.toLowerCase().replace(' ', '-')}`} /><b>{stage}</b><small>{seedApplications.filter((app) => app.stage === stage).length} applications</small><button className="icon-button"><Icon name="dots" /></button></div>)}</div></section>
        <section className="settings-card" id="appearance"><div className="setting-toggle-row"><div><h2>Dark mode</h2><p>Use a darker interface in low-light environments.</p></div><Toggle checked={dark} onChange={setDark} /></div><div className="appearance-note">Dark mode is shown as a prototype preference and will be available in a future update.</div></section>
      </div>
    </div>
  </div>
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <button className={checked ? 'toggle on' : 'toggle'} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><span /></button>
}

export default App

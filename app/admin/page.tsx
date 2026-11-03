'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Match = {
  id: string
  competition: string
  home_team: string
  away_team: string
  status: string
  reporter_id: string | null
  start_time?: string | null
  venue?: string | null
  home_goals?: number
  home_points?: number
  away_goals?: number
  away_points?: number
  minute?: number
}

type Lookup = {
  id: string
  name: string
  active?: boolean
}

type Filter =
  | 'ALL'
  | 'LIVE'
  | 'UPCOMING'
  | 'FINISHED'
  | 'UNASSIGNED'

const STATUSES = [
  'SCHEDULED',
  'LIVE',
  'HT',
  'FT',
  'POSTPONED',
  'CANCELLED',
]

export default function Admin() {
  const supabase = useMemo(() => createClient(), [])

  const [session, setSession] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [matches, setMatches] = useState<Match[]>([])
  const [clubs, setClubs] = useState<Lookup[]>([])
  const [comps, setComps] = useState<Lookup[]>([])

  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [search, setSearch] = useState('')

  const [assignMatchId, setAssignMatchId] =
    useState<string | null>(null)

  const [assignEmail, setAssignEmail] = useState('')

  const [editMatchId, setEditMatchId] =
    useState<string | null>(null)

  const [scoreMatchId, setScoreMatchId] =
    useState<string | null>(null)

  const [form, setForm] = useState({
    competition: '',
    home: '',
    away: '',
    venue: '',
    start: '',
    reporter: '',
  })

  const [editForm, setEditForm] = useState({
    competition: '',
    home: '',
    away: '',
    venue: '',
    start: '',
  })

  const [scoreForm, setScoreForm] = useState({
    homeGoals: 0,
    homePoints: 0,
    awayGoals: 0,
    awayPoints: 0,
    status: 'SCHEDULED',
    minute: 0,
  })

  async function checkAdmin() {
    const { data, error } = await supabase.rpc('is_admin')
    return !error && !!data
  }

  async function load() {
    const [m, c, k] = await Promise.all([
      supabase
        .from('matches')
        .select('*')
        .order('start_time'),

      supabase
        .from('clubs')
        .select('*')
        .order('name'),

      supabase
        .from('competitions')
        .select('*')
        .order('name'),
    ])

    if (m.error || c.error || k.error) {
      setMessage(
        (m.error || c.error || k.error)!.message
      )
      return
    }

    setMatches((m.data ?? []) as Match[])
    setClubs((c.data ?? []) as Lookup[])
    setComps((k.data ?? []) as Lookup[])
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (
        data.session &&
        (await checkAdmin())
      ) {
        setSession(data.session)
      }
    })
  }, [supabase])

  useEffect(() => {
    if (session) load()
  }, [session])

  async function login() {
    setMessage('')

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (error) {
      setMessage(error.message)
      return
    }

    if (!(await checkAdmin())) {
      await supabase.auth.signOut()
      setMessage(
        'This account is not an admin.'
      )
      return
    }

    setSession(data.session)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
  }

  async function createFixture() {
    setMessage('')

    if (
      !form.competition ||
      !form.home ||
      !form.away
    ) {
      setMessage(
        'Choose a competition, home team and away team.'
      )
      return
    }

    if (form.home === form.away) {
      setMessage(
        'Home and away teams cannot be the same.'
      )
      return
    }

    const { data, error } =
      await supabase.rpc('admin_create_match', {
        p_competition: form.competition,
        p_home_team: form.home,
        p_away_team: form.away,
        p_venue: form.venue || null,
        p_start_time: form.start
          ? new Date(form.start).toISOString()
          : null,
      })

    if (error) {
      setMessage(error.message)
      return
    }

    if (form.reporter) {
      const assignment =
        await supabase.rpc(
          'admin_assign_reporter_by_email',
          {
            p_match_id: data,
            p_email: form.reporter.trim(),
          }
        )

      if (assignment.error) {
        setMessage(
          `Fixture created, but reporter assignment failed: ${assignment.error.message}`
        )
        await load()
        return
      }
    }

    setForm({
      competition: '',
      home: '',
      away: '',
      venue: '',
      start: '',
      reporter: '',
    })

    setMessage(
      'Fixture created successfully.'
    )

    await load()
  }

  function startEdit(match: Match) {
    setEditMatchId(match.id)

    setEditForm({
      competition: match.competition,
      home: match.home_team,
      away: match.away_team,
      venue: match.venue ?? '',
      start: toLocalDateTime(
        match.start_time
      ),
    })
  }

  async function saveEdit(matchId: string) {
    if (
      !editForm.competition ||
      !editForm.home ||
      !editForm.away
    ) {
      setMessage(
        'Competition and both teams are required.'
      )
      return
    }

    if (
      editForm.home === editForm.away
    ) {
      setMessage(
        'Home and away teams cannot be the same.'
      )
      return
    }

    const { error } = await supabase.rpc(
      'admin_update_match',
      {
        p_match_id: matchId,
        p_competition:
          editForm.competition,
        p_home_team: editForm.home,
        p_away_team: editForm.away,
        p_venue:
          editForm.venue || null,
        p_start_time: editForm.start
          ? new Date(
              editForm.start
            ).toISOString()
          : null,
      }
    )

    if (error) {
      setMessage(error.message)
      return
    }

    setEditMatchId(null)
    setMessage(
      'Fixture updated successfully.'
    )

    await load()
  }

  async function assignReporter(
    matchId: string
  ) {
    if (!assignEmail.trim()) {
      setMessage(
        'Enter the reporter email address.'
      )
      return
    }

    const { error } = await supabase.rpc(
      'admin_assign_reporter_by_email',
      {
        p_match_id: matchId,
        p_email: assignEmail.trim(),
      }
    )

    if (error) {
      setMessage(error.message)
      return
    }

    setAssignMatchId(null)
    setAssignEmail('')

    setMessage(
      'Reporter assigned successfully.'
    )

    await load()
  }

  async function clearReporter(
    matchId: string
  ) {
    const ok = window.confirm(
      'Remove the reporter from this fixture?'
    )

    if (!ok) return

    const { error } = await supabase.rpc(
      'admin_clear_reporter',
      {
        p_match_id: matchId,
      }
    )

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Reporter removed.')
    await load()
  }

  async function changeStatus(
    matchId: string,
    status: string
  ) {
    const { error } = await supabase.rpc(
      'set_match_status',
      {
        p_match_id: matchId,
        p_status: status,
      }
    )

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage(
      `Match status changed to ${status}.`
    )

    await load()
  }

  function startScoreCorrection(
    match: Match
  ) {
    setScoreMatchId(match.id)

    setScoreForm({
      homeGoals:
        match.home_goals ?? 0,
      homePoints:
        match.home_points ?? 0,
      awayGoals:
        match.away_goals ?? 0,
      awayPoints:
        match.away_points ?? 0,
      status:
        match.status || 'SCHEDULED',
      minute:
        match.minute ?? 0,
    })
  }

  async function saveScoreCorrection(
    matchId: string
  ) {
    const values = [
      scoreForm.homeGoals,
      scoreForm.homePoints,
      scoreForm.awayGoals,
      scoreForm.awayPoints,
      scoreForm.minute,
    ]

    if (
      values.some(
        (x) =>
          Number.isNaN(x) ||
          x < 0
      )
    ) {
      setMessage(
        'Scores and match minute cannot be negative.'
      )
      return
    }

    const { error } = await supabase.rpc(
      'admin_correct_score',
      {
        p_match_id: matchId,
        p_home_goals:
          scoreForm.homeGoals,
        p_home_points:
          scoreForm.homePoints,
        p_away_goals:
          scoreForm.awayGoals,
        p_away_points:
          scoreForm.awayPoints,
        p_status:
          scoreForm.status,
        p_minute:
          scoreForm.minute,
      }
    )

    if (error) {
      setMessage(error.message)
      return
    }

    setScoreMatchId(null)

    setMessage(
      'Score and match details corrected.'
    )

    await load()
  }

  async function deleteFixture(
    match: Match
  ) {
    const ok = window.confirm(
      `Delete ${match.home_team} v ${match.away_team}?\n\nThis cannot be undone.`
    )

    if (!ok) return

    const { error } = await supabase.rpc(
      'admin_delete_match',
      {
        p_match_id: match.id,
      }
    )

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Fixture deleted.')
    await load()
  }

  function toLocalDateTime(
    value?: string | null
  ) {
    if (!value) return ''

    const d = new Date(value)

    const pad = (n: number) =>
      String(n).padStart(2, '0')

    return `${d.getFullYear()}-${pad(
      d.getMonth() + 1
    )}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`
  }

  function formatDate(
    value?: string | null
  ) {
    if (!value) return 'Date not set'

    return new Intl.DateTimeFormat(
      'en-IE',
      {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }
    ).format(new Date(value))
  }

  const live = matches.filter((x) =>
    ['LIVE', 'HT'].includes(x.status)
  ).length

  const upcoming = matches.filter(
    (x) => x.status === 'SCHEDULED'
  ).length

  const finished = matches.filter(
    (x) => x.status === 'FT'
  ).length

  const unassigned = matches.filter(
    (x) =>
      !x.reporter_id &&
      ![
        'FT',
        'CANCELLED',
        'POSTPONED',
      ].includes(x.status)
  ).length

  const filteredMatches =
    matches.filter((match) => {
      const text =
        `${match.home_team} ${match.away_team} ${match.competition} ${match.venue ?? ''}`.toLowerCase()

      if (
        search &&
        !text.includes(
          search.toLowerCase()
        )
      ) {
        return false
      }

      if (filter === 'LIVE') {
        return ['LIVE', 'HT'].includes(
          match.status
        )
      }

      if (filter === 'UPCOMING') {
        return (
          match.status === 'SCHEDULED'
        )
      }

      if (filter === 'FINISHED') {
        return match.status === 'FT'
      }

      if (filter === 'UNASSIGNED') {
        return (
          !match.reporter_id &&
          ![
            'FT',
            'CANCELLED',
            'POSTPONED',
          ].includes(match.status)
        )
      }

      return true
    })

  if (!session) {
    return (
      <main>
        <div className="hero">
          <h1>ScoreTrak Admin</h1>

          <div className="muted">
            Sign in to manage fixtures
            and reporters.
          </div>
        </div>

        <div
          className="panel"
          style={{
            maxWidth: 480,
            marginTop: 20,
          }}
        >
          {message && (
            <div className="notice error">
              {message}
            </div>
          )}

          <div className="field">
            <label>Email</label>

            <input
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  login()
              }}
            />
          </div>

          <button
            className="btn primary"
            onClick={login}
          >
            Sign in
          </button>
        </div>
      </main>
    )
  }

  return (
    <main>
      <div className="hero">
        <div>
          <h1>ScoreTrak Admin</h1>

          <div className="muted">
            {session.user.email}
          </div>
        </div>
      </div>

      <div className="stats">
        <button
          className="stat"
          onClick={() =>
            setFilter('LIVE')
          }
        >
          <strong>{live}</strong>
          <span>Live</span>
        </button>

        <button
          className="stat"
          onClick={() =>
            setFilter('UPCOMING')
          }
        >
          <strong>{upcoming}</strong>
          <span>Upcoming</span>
        </button>

        <button
          className="stat"
          onClick={() =>
            setFilter('FINISHED')
          }
        >
          <strong>{finished}</strong>
          <span>Finished</span>
        </button>

        <button
          className="stat"
          onClick={() =>
            setFilter('UNASSIGNED')
          }
        >
          <strong>{unassigned}</strong>
          <span>Unassigned</span>
        </button>
      </div>

      {message && (
        <div
          className="notice"
          style={{ marginTop: 16 }}
        >
          {message}
        </div>
      )}

      <div
        className="grid2"
        style={{
          marginTop: 20,
          alignItems: 'start',
        }}
      >
        <div className="panel">
          <h2>Create Fixture</h2>

          <div className="field">
            <label>Competition</label>

            <select
              value={form.competition}
              onChange={(e) =>
                setForm({
                  ...form,
                  competition:
                    e.target.value,
                })
              }
            >
              <option value="">
                Select…
              </option>

              {comps
                .filter(
                  (x) =>
                    x.active !== false
                )
                .map((x) => (
                  <option
                    key={x.id}
                    value={x.name}
                  >
                    {x.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="field">
            <label>Home team</label>

            <select
              value={form.home}
              onChange={(e) =>
                setForm({
                  ...form,
                  home: e.target.value,
                })
              }
            >
              <option value="">
                Select…
              </option>

              {clubs
                .filter(
                  (x) =>
                    x.active !== false
                )
                .map((x) => (
                  <option
                    key={x.id}
                    value={x.name}
                  >
                    {x.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="field">
            <label>Away team</label>

            <select
              value={form.away}
              onChange={(e) =>
                setForm({
                  ...form,
                  away: e.target.value,
                })
              }
            >
              <option value="">
                Select…
              </option>

              {clubs
                .filter(
                  (x) =>
                    x.active !== false
                )
                .map((x) => (
                  <option
                    key={x.id}
                    value={x.name}
                  >
                    {x.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="field">
            <label>Venue</label>

            <input
              value={form.venue}
              placeholder="Optional"
              onChange={(e) =>
                setForm({
                  ...form,
                  venue: e.target.value,
                })
              }
            />
          </div>

          <div className="field">
            <label>Date / time</label>

            <input
              type="datetime-local"
              value={form.start}
              onChange={(e) =>
                setForm({
                  ...form,
                  start: e.target.value,
                })
              }
            />
          </div>

          <div className="field">
            <label>
              Reporter email
            </label>

            <input
              value={form.reporter}
              placeholder="Optional"
              onChange={(e) =>
                setForm({
                  ...form,
                  reporter:
                    e.target.value,
                })
              }
            />
          </div>

          <button
            className="btn primary"
            onClick={createFixture}
          >
            + Create Fixture
          </button>
        </div>

        <div className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ margin: 0 }}>
              Fixtures
            </h2>

            <button
              className="btn secondary"
              onClick={() => {
                setFilter('ALL')
                setSearch('')
              }}
            >
              Show all
            </button>
          </div>

          <div
            className="field"
            style={{ marginTop: 16 }}
          >
            <label>Search</label>

            <input
              placeholder="Team, competition or venue"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            {(
              [
                ['ALL', 'All'],
                ['LIVE', 'Live'],
                [
                  'UPCOMING',
                  'Upcoming',
                ],
                [
                  'FINISHED',
                  'Finished',
                ],
                [
                  'UNASSIGNED',
                  'Unassigned',
                ],
              ] as [
                Filter,
                string
              ][]
            ).map(
              ([value, label]) => (
                <button
                  key={value}
                  className={
                    filter === value
                      ? 'btn primary'
                      : 'btn secondary'
                  }
                  onClick={() =>
                    setFilter(value)
                  }
                >
                  {label}
                </button>
              )
            )}
          </div>

          {filteredMatches.length ===
            0 && (
            <div className="muted">
              No fixtures in this
              view.
            </div>
          )}

          {filteredMatches.map(
            (match) => (
              <div
                className="card"
                key={match.id}
                style={{
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    gap: 12,
                    alignItems:
                      'start',
                  }}
                >
                  <div>
                    <strong
                      style={{
                        fontSize: 17,
                      }}
                    >
                      {match.home_team} v{' '}
                      {match.away_team}
                    </strong>

                    <div className="muted">
                      {
                        match.competition
                      }
                    </div>

                    <div className="muted">
                      {formatDate(
                        match.start_time
                      )}
                    </div>

                    {match.venue && (
                      <div className="muted">
                        {match.venue}
                      </div>
                    )}
                  </div>

                  <strong>
                    {match.status}
                  </strong>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                  }}
                >
                  Score:{' '}
                  {match.home_goals ??
                    0}
                  -
                  {match.home_points ??
                    0}{' '}
                  :{' '}
                  {match.away_goals ??
                    0}
                  -
                  {match.away_points ??
                    0}
                  {typeof match.minute ===
                    'number' &&
                    ` • ${match.minute}'`}
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                  }}
                >
                  {match.reporter_id
                    ? 'Reporter assigned'
                    : 'No reporter assigned'}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <button
                    className="btn secondary"
                    onClick={() =>
                      startEdit(match)
                    }
                  >
                    Edit Fixture
                  </button>

                  <button
                    className="btn secondary"
                    onClick={() => {
                      setAssignMatchId(
                        match.id
                      )
                      setAssignEmail('')
                    }}
                  >
                    {match.reporter_id
                      ? 'Change Reporter'
                      : 'Assign Reporter'}
                  </button>

                  {match.reporter_id && (
                    <button
                      className="btn secondary"
                      onClick={() =>
                        clearReporter(
                          match.id
                        )
                      }
                    >
                      Remove Reporter
                    </button>
                  )}

                  <button
                    className="btn secondary"
                    onClick={() =>
                      startScoreCorrection(
                        match
                      )
                    }
                  >
                    Correct Score
                  </button>

                  <button
                    className="btn secondary"
                    onClick={() =>
                      deleteFixture(match)
                    }
                  >
                    Delete
                  </button>
                </div>

                <div
                  className="field"
                  style={{
                    marginTop: 12,
                  }}
                >
                  <label>
                    Match status
                  </label>

                  <select
                    value={match.status}
                    onChange={(e) =>
                      changeStatus(
                        match.id,
                        e.target.value
                      )
                    }
                  >
                    {STATUSES.map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {assignMatchId ===
                  match.id && (
                  <div
                    style={{
                      marginTop: 14,
                    }}
                  >
                    <div className="field">
                      <label>
                        Reporter email
                      </label>

                      <input
                        value={assignEmail}
                        onChange={(e) =>
                          setAssignEmail(
                            e.target
                              .value
                          )
                        }
                        placeholder="reporter@email.com"
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                      }}
                    >
                      <button
                        className="btn primary"
                        onClick={() =>
                          assignReporter(
                            match.id
                          )
                        }
                      >
                        Save Reporter
                      </button>

                      <button
                        className="btn secondary"
                        onClick={() => {
                          setAssignMatchId(
                            null
                          )
                          setAssignEmail(
                            ''
                          )
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {editMatchId ===
                  match.id && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop:
                        '1px solid #ddd',
                    }}
                  >
                    <h3>
                      Edit Fixture
                    </h3>

                    <div className="field">
                      <label>
                        Competition
                      </label>

                      <select
                        value={
                          editForm.competition
                        }
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            competition:
                              e.target
                                .value,
                          })
                        }
                      >
                        {comps.map(
                          (x) => (
                            <option
                              key={
                                x.id
                              }
                              value={
                                x.name
                              }
                            >
                              {
                                x.name
                              }
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="field">
                      <label>
                        Home team
                      </label>

                      <select
                        value={
                          editForm.home
                        }
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            home: e
                              .target
                              .value,
                          })
                        }
                      >
                        {clubs.map(
                          (x) => (
                            <option
                              key={
                                x.id
                              }
                              value={
                                x.name
                              }
                            >
                              {
                                x.name
                              }
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="field">
                      <label>
                        Away team
                      </label>

                      <select
                        value={
                          editForm.away
                        }
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            away: e
                              .target
                              .value,
                          })
                        }
                      >
                        {clubs.map(
                          (x) => (
                            <option
                              key={
                                x.id
                              }
                              value={
                                x.name
                              }
                            >
                              {
                                x.name
                              }
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="field">
                      <label>
                        Venue
                      </label>

                      <input
                        value={
                          editForm.venue
                        }
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            venue: e
                              .target
                              .value,
                          })
                        }
                      />
                    </div>

                    <div className="field">
                      <label>
                        Date / time
                      </label>

                      <input
                        type="datetime-local"
                        value={
                          editForm.start
                        }
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            start: e
                              .target
                              .value,
                          })
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                      }}
                    >
                      <button
                        className="btn primary"
                        onClick={() =>
                          saveEdit(
                            match.id
                          )
                        }
                      >
                        Save Changes
                      </button>

                      <button
                        className="btn secondary"
                        onClick={() =>
                          setEditMatchId(
                            null
                          )
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {scoreMatchId ===
                  match.id && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop:
                        '1px solid #ddd',
                    }}
                  >
                    <h3>
                      Correct Score
                    </h3>

                    <div
                      style={{
                        display:
                          'grid',
                        gridTemplateColumns:
                          '1fr 1fr',
                        gap: 10,
                      }}
                    >
                      <div className="field">
                        <label>
                          Home goals
                        </label>

                        <input
                          type="number"
                          min="0"
                          value={
                            scoreForm.homeGoals
                          }
                          onChange={(
                            e
                          ) =>
                            setScoreForm(
                              {
                                ...scoreForm,
                                homeGoals:
                                  Number(
                                    e
                                      .target
                                      .value
                                  ),
                              }
                            )
                          }
                        />
                      </div>

                      <div className="field">
                        <label>
                          Home points
                        </label>

                        <input
                          type="number"
                          min="0"
                          value={
                            scoreForm.homePoints
                          }
                          onChange={(
                            e
                          ) =>
                            setScoreForm(
                              {
                                ...scoreForm,
                                homePoints:
                                  Number(
                                    e
                                      .target
                                      .value
                                  ),
                              }
                            )
                          }
                        />
                      </div>

                      <div className="field">
                        <label>
                          Away goals
                        </label>

                        <input
                          type="number"
                          min="0"
                          value={
                            scoreForm.awayGoals
                          }
                          onChange={(
                            e
                          ) =>
                            setScoreForm(
                              {
                                ...scoreForm,
                                awayGoals:
                                  Number(
                                    e
                                      .target
                                      .value
                                  ),
                              }
                            )
                          }
                        />
                      </div>

                      <div className="field">
                        <label>
                          Away points
                        </label>

                        <input
                          type="number"
                          min="0"
                          value={
                            scoreForm.awayPoints
                          }
                          onChange={(
                            e
                          ) =>
                            setScoreForm(
                              {
                                ...scoreForm,
                                awayPoints:
                                  Number(
                                    e
                                      .target
                                      .value
                                  ),
                              }
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label>
                        Match minute
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={
                          scoreForm.minute
                        }
                        onChange={(e) =>
                          setScoreForm({
                            ...scoreForm,
                            minute: Number(
                              e.target
                                .value
                            ),
                          })
                        }
                      />
                    </div>

                    <div className="field">
                      <label>Status</label>

                      <select
                        value={
                          scoreForm.status
                        }
                        onChange={(e) =>
                          setScoreForm({
                            ...scoreForm,
                            status:
                              e.target
                                .value,
                          })
                        }
                      >
                        {STATUSES.map(
                          (status) => (
                            <option
                              key={
                                status
                              }
                              value={
                                status
                              }
                            >
                              {status}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                      }}
                    >
                      <button
                        className="btn primary"
                        onClick={() =>
                          saveScoreCorrection(
                            match.id
                          )
                        }
                      >
                        Save Correction
                      </button>

                      <button
                        className="btn secondary"
                        onClick={() =>
                          setScoreMatchId(
                            null
                          )
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button
          className="btn secondary"
          onClick={signOut}
        >
          Sign out
        </button>
      </div>
    </main>
  )
}

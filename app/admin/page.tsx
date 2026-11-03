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
}

type Lookup = {
  id: string
  name: string
  active?: boolean
}

type Filter = 'ALL' | 'LIVE' | 'UPCOMING' | 'FINISHED' | 'UNASSIGNED'

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

  const [assignMatchId, setAssignMatchId] = useState<string | null>(null)
  const [assignEmail, setAssignEmail] = useState('')

  const [form, setForm] = useState({
    competition: '',
    home: '',
    away: '',
    venue: '',
    start: '',
    reporter: '',
  })

  async function checkAdmin() {
    const { data, error } = await supabase.rpc('is_admin')
    return !error && !!data
  }

  async function load() {
    const [m, c, k] = await Promise.all([
      supabase.from('matches').select('*').order('start_time'),
      supabase.from('clubs').select('*').order('name'),
      supabase.from('competitions').select('*').order('name'),
    ])

    if (m.error || c.error || k.error) {
      setMessage((m.error || c.error || k.error)!.message)
      return
    }

    setMatches((m.data ?? []) as Match[])
    setClubs((c.data ?? []) as Lookup[])
    setComps((k.data ?? []) as Lookup[])
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session && (await checkAdmin())) {
        setSession(data.session)
      }
    })
  }, [supabase])

  useEffect(() => {
    if (session) load()
  }, [session])

  async function login() {
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    if (!(await checkAdmin())) {
      await supabase.auth.signOut()
      setMessage('This account is not an admin.')
      return
    }

    setSession(data.session)
  }

  async function createFixture() {
    setMessage('')

    if (!form.competition || !form.home || !form.away) {
      setMessage('Choose a competition, home team and away team.')
      return
    }

    if (form.home === form.away) {
      setMessage('Home and away teams cannot be the same.')
      return
    }

    const { data, error } = await supabase.rpc('admin_create_match', {
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
      const assignment = await supabase.rpc(
        'admin_assign_reporter_by_email',
        {
          p_match_id: data,
          p_email: form.reporter,
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

    setMessage('Fixture created successfully.')
    await load()
  }

  async function assignReporter(matchId: string) {
    if (!assignEmail.trim()) {
      setMessage('Enter the reporter email address.')
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

    setMessage('Reporter assigned successfully.')
    setAssignMatchId(null)
    setAssignEmail('')
    await load()
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
  }

  function formatDate(value?: string | null) {
    if (!value) return 'Date not set'

    return new Intl.DateTimeFormat('en-IE', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
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
    (x) => !x.reporter_id && x.status !== 'FT'
  ).length

  const filteredMatches = matches.filter((match) => {
    const text =
      `${match.home_team} ${match.away_team} ${match.competition} ${match.venue ?? ''}`
        .toLowerCase()

    if (search && !text.includes(search.toLowerCase())) {
      return false
    }

    if (filter === 'LIVE') {
      return ['LIVE', 'HT'].includes(match.status)
    }

    if (filter === 'UPCOMING') {
      return match.status === 'SCHEDULED'
    }

    if (filter === 'FINISHED') {
      return match.status === 'FT'
    }

    if (filter === 'UNASSIGNED') {
      return !match.reporter_id && match.status !== 'FT'
    }

    return true
  })

  if (!session) {
    return (
      <main>
        <div className="hero">
          <h1>ScoreTrak Admin</h1>
          <div className="muted">
            Sign in to manage fixtures and reporters.
          </div>
        </div>

        <div
          className="panel"
          style={{ maxWidth: 480, marginTop: 20 }}
        >
          {message && (
            <div className="notice error">{message}</div>
          )}

          <div className="field">
            <label>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') login()
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
          onClick={() => setFilter('LIVE')}
        >
          <strong>{live}</strong>
          <span>Live</span>
        </button>

        <button
          className="stat"
          onClick={() => setFilter('UPCOMING')}
        >
          <strong>{upcoming}</strong>
          <span>Upcoming</span>
        </button>

        <button
          className="stat"
          onClick={() => setFilter('FINISHED')}
        >
          <strong>{finished}</strong>
          <span>Finished</span>
        </button>

        <button
          className="stat"
          onClick={() => setFilter('UNASSIGNED')}
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
                  competition: e.target.value,
                })
              }
            >
              <option value="">Select…</option>

              {comps
                .filter((x) => x.active !== false)
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
              <option value="">Select…</option>

              {clubs
                .filter((x) => x.active !== false)
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
              <option value="">Select…</option>

              {clubs
                .filter((x) => x.active !== false)
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
                  reporter: e.target.value,
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
              justifyContent: 'space-between',
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
                ['UPCOMING', 'Upcoming'],
                ['FINISHED', 'Finished'],
                ['UNASSIGNED', 'Unassigned'],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                className={
                  filter === value
                    ? 'btn primary'
                    : 'btn secondary'
                }
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredMatches.length === 0 && (
            <div className="muted">
              No fixtures in this view.
            </div>
          )}

          {filteredMatches.map((match) => (
            <div
              className="card"
              key={match.id}
              style={{ marginBottom: 12 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'start',
                }}
              >
                <div>
                  <strong
                    style={{ fontSize: 17 }}
                  >
                    {match.home_team} v{' '}
                    {match.away_team}
                  </strong>

                  <div className="muted">
                    {match.competition}
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

                <div>
                  <strong>{match.status}</strong>
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 14,
                }}
              >
                {match.reporter_id
                  ? 'Reporter assigned'
                  : 'No reporter assigned'}
              </div>

              {!match.reporter_id &&
                match.status !== 'FT' && (
                  <div
                    style={{
                      marginTop: 12,
                    }}
                  >
                    {assignMatchId ===
                    match.id ? (
                      <>
                        <div className="field">
                          <label>
                            Reporter email
                          </label>

                          <input
                            value={assignEmail}
                            onChange={(e) =>
                              setAssignEmail(
                                e.target.value
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
                            Assign
                          </button>

                          <button
                            className="btn secondary"
                            onClick={() => {
                              setAssignMatchId(
                                null
                              )
                              setAssignEmail('')
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        className="btn secondary"
                        onClick={() =>
                          setAssignMatchId(
                            match.id
                          )
                        }
                      >
                        Assign Reporter
                      </button>
                    )}
                  </div>
                )}
            </div>
          ))}
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

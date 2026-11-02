'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Match = { id:string; competition:string; home_team:string; away_team:string; venue:string|null; start_time:string|null; status:string; minute:number|null; home_goals:number; home_points:number; away_goals:number; away_points:number }

export default function Home(){
 const supabase=useMemo(()=>createClient(),[]); const [matches,setMatches]=useState<Match[]>([]); const [view,setView]=useState('today'); const [error,setError]=useState('')
 async function load(){const {data,error}=await supabase.from('matches').select('*').order('start_time',{ascending:true}); if(error)setError(error.message); else setMatches((data??[]) as Match[])}
 useEffect(()=>{load();const ch=supabase.channel('v1-public').on('postgres_changes',{event:'*',schema:'public',table:'matches'},load).subscribe();return()=>{supabase.removeChannel(ch)}},[supabase])
 const shown=matches.filter(m=>{if(view==='live')return m.status==='LIVE'||m.status==='HT';if(view==='results')return m.status==='FT';if(view==='upcoming')return m.status==='SCHEDULED';if(!m.start_time)return false;return new Date(m.start_time).toDateString()===new Date().toDateString()})
 const fmt=(g:number,p:number)=>`${g}-${String(p).padStart(2,'0')}`
 return <main><div className="hero"><h1>Live GAA Scores</h1><div className="muted">Fixtures, live scores and results — updated in realtime.</div></div><div className="toolbar">{['today','live','upcoming','results'].map(x=><button key={x} className={`btn ${view===x?'primary':'secondary'}`} onClick={()=>setView(x)}>{x[0].toUpperCase()+x.slice(1)}</button>)}</div>{error&&<div className="notice error">{error}</div>}{shown.map(m=><div className="card" key={m.id}><div className="matchTop"><div className="comp">{m.competition}</div><span className={`badge ${m.status.toLowerCase()}`}>{m.status}</span></div><div className="teams"><div className="team">{m.home_team}</div><div className="score">{m.status==='SCHEDULED'?'—':fmt(m.home_goals,m.home_points)}</div><div className="team">{m.away_team}</div><div className="score">{m.status==='SCHEDULED'?'—':fmt(m.away_goals,m.away_points)}</div></div><div className="muted" style={{marginTop:8}}>{m.status==='LIVE'?`${m.minute??0} mins`:m.start_time?new Date(m.start_time).toLocaleString():'TBC'}{m.venue?` · ${m.venue}`:''}</div></div>)}{!shown.length&&!error&&<div className="panel muted">No matches in this view.</div>}</main>
}

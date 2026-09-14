import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import OverviewClient from './OverviewClient'
import { startOfWeek, endOfWeek, parseISO, format } from 'date-fns'

export default async function OverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profileData } = await admin.from('profiles')
    .select('*, organization:organizations(*)')
    .eq('user_id', user.id).single()
  if (!profileData) redirect('/login')

  const orgId = profileData.org_id
  const isAdmin = profileData.role === 'owner' || profileData.role === 'admin'
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  // Non-admins only see their own entries — admins see the whole org
  let entriesQuery = admin.from('time_entries')
    .select('*, project:projects(*, client:clients(*))')
    .eq('org_id', orgId)
    .gte('start_time', weekStart.toISOString())
    .lte('start_time', weekEnd.toISOString())
    .eq('is_running', false)
  if (!isAdmin) entriesQuery = entriesQuery.eq('user_id', user.id)

  const [allMembersRes, weekEntriesRes, topProjectsRes, runningRes] = await Promise.all([
    admin.from('profiles').select('*').eq('org_id', orgId),
    entriesQuery,
    admin.from('projects').select('*, client:clients(*)').eq('org_id', orgId).eq('is_archived', false).limit(10),
    admin.from('time_entries').select('user_id').eq('org_id', orgId).eq('is_running', true),
  ])

  const allMembers = (allMembersRes.data || []) as { user_id: string; full_name: string }[]
  const weekEntries = (weekEntriesRes.data || []) as { user_id: string; start_time: string; is_billable: boolean; duration: number | null; project_id: string | null; project?: { name: string; color: string } | null }[]
  const topProjects = topProjectsRes.data || []
  const trackingUserIds = new Set((runningRes.data || []).map((e: { user_id: string }) => e.user_id))

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const weeklyData = days.map((day, i) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayEntries = weekEntries.filter(e => format(parseISO(e.start_time), 'yyyy-MM-dd') === dateStr)
    const billable = dayEntries.filter(e => e.is_billable).reduce((s, e) => s + (e.duration || 0), 0)
    const nonBillable = dayEntries.filter(e => !e.is_billable).reduce((s, e) => s + (e.duration || 0), 0)
    return {
      day: `${day} ${format(date, 'MM/dd')}`,
      billable: Math.round(billable / 3600 * 100) / 100,
      nonBillable: Math.round(nonBillable / 3600 * 100) / 100,
      dateLabel: format(date, 'MM/dd'),
    }
  })

  const projectHours: Record<string, { name: string; seconds: number; color: string }> = {}
  weekEntries.forEach(e => {
    const key = e.project_id || 'no-project'
    const name = e.project?.name || 'Without project'
    const color = e.project?.color || '#64748b'
    if (!projectHours[key]) projectHours[key] = { name, seconds: 0, color }
    projectHours[key].seconds += e.duration || 0
  })
  const projectDistribution = Object.values(projectHours)
    .sort((a, b) => b.seconds - a.seconds)
    .map(p => ({ name: p.name, hours: Math.round(p.seconds / 3600 * 100) / 100, color: p.color }))

  const memberActivity = allMembers.map(m => {
    const memberEntries = weekEntries.filter(e => e.user_id === m.user_id)
    const total = memberEntries.reduce((s, e) => s + (e.duration || 0), 0)
    return { id: m.user_id, name: m.full_name, hours: Math.round(total / 3600 * 100) / 100, is_tracking: trackingUserIds.has(m.user_id) }
  })

  const totalSecs = weekEntries.reduce((s, e) => s + (e.duration || 0), 0)
  const billableSecs = weekEntries.filter(e => e.is_billable).reduce((s, e) => s + (e.duration || 0), 0)
  const org = profileData.organization as { name: string }

  return (
    <OverviewClient
      orgName={org.name}
      isAdmin={isAdmin}
      members={allMembers.map(m => ({ id: m.user_id, name: m.full_name }))}
      stats={{
        totalHours: Math.round(totalSecs / 3600 * 100) / 100,
        billableHours: Math.round(billableSecs / 3600 * 100) / 100,
        totalMembers: allMembers.length,
        activeProjects: topProjects.length,
        weeklyData,
        projectDistribution,
        memberActivity,
      }}
    />
  )
}
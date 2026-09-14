import { requireUser, isAdmin } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'
import AnalyticsClient from './AnalyticsClient'

export default async function LeaveAnalyticsPage() {
  const auth = await requireUser()
  if ('error' in auth) redirect('/login')
  if (!isAdmin(auth.profile.role)) redirect('/leaves')
  return <AnalyticsClient />
}

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'
import type { Organization, Profile } from '@/lib/types'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profileData } = await admin.from('profiles')
    .select('*, organization:organizations(*)')
    .eq('user_id', user.id).single()
  if (!profileData) redirect('/login')

  const org = profileData.organization as Organization
  const profile = profileData as Profile
  return <SettingsClient org={org} profile={profile} />
}
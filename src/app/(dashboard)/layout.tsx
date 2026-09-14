import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/Sidebar'
import WhatsNewPopup from '@/components/WhatsNewPopup'
import AnnouncementTicker from '@/components/AnnouncementTicker'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profileData } = await admin.from('profiles')
    .select('*, organization:organizations(*)')
    .eq('user_id', user.id).single()

  if (!profileData) redirect('/login')

  const org = profileData.organization as { id: string; name: string; timezone: string; created_at: string }

  return (
    <>
      <AnnouncementTicker />
      <div style={{ display: 'flex', minHeight: '100vh', paddingTop: '32px' }}>
        <Sidebar
          profile={{ ...profileData, email: user.email } as Parameters<typeof Sidebar>[0]['profile']}
          org={org}
        />
        <main style={{ marginLeft: '220px', flex: 1, minHeight: '100vh', background: 'var(--bg-primary)', overflow: 'auto' }}>
          {children}
        </main>
        <WhatsNewPopup userId={user.id} />
      </div>
    </>
  )
}
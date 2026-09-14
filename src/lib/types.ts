export type Role = 'owner' | 'admin' | 'member'

export interface Organization {
  id: string
  name: string
  timezone: string
  created_at: string
}

export interface Profile {
  id: string
  user_id: string
  full_name: string
  avatar_url: string | null
  org_id: string
  role: Role
  hourly_rate: number | null
  timezone: string
  created_at: string
  email?: string
}

export interface Client {
  id: string
  org_id: string
  name: string
  color: string
  created_at: string
}

export interface Project {
  id: string
  org_id: string
  client_id: string | null
  name: string
  color: string
  is_billable: boolean
  is_archived: boolean
  created_at: string
  client?: Client
}

export interface TimeEntry {
  id: string
  user_id: string
  org_id: string
  project_id: string | null
  description: string
  start_time: string
  end_time: string | null
  duration: number | null
  is_billable: boolean
  is_running: boolean
  created_at: string
  project?: Project
  profile?: Profile
}

export interface Tag {
  id: string
  org_id: string
  name: string
  color: string
}

export interface Invite {
  id: string
  org_id: string
  email: string
  role: Role
  token: string
  expires_at: string
  used: boolean
  created_at: string
}

export interface Invoice {
  id: string
  org_id: string
  client_id: string
  invoice_number: string
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  issue_date: string
  due_date: string
  total_amount: number
  currency: string
  notes: string | null
  created_at: string
  client?: Client
  items?: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  hours: number
  rate: number
  amount: number
}

export interface DashboardStats {
  totalHours: number
  billableHours: number
  totalMembers: number
  activeProjects: number
  weeklyData: { day: string; billable: number; nonBillable: number }[]
  projectDistribution: { name: string; hours: number; color: string }[]
  memberActivity: { name: string; hours: number; is_tracking: boolean }[]
}

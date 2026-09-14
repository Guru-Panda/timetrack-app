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

export type LeaveType = 'annual' | 'sick' | 'casual' | 'unpaid' | 'maternity' | 'paternity' | 'wfh' | 'other'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type HalfDayPeriod = 'morning' | 'afternoon'
export type ActionStatus = 'unstarted' | 'in_progress' | 'blocked' | 'completed'

export interface LeavePolicy {
  id: string
  org_id: string
  name: string
  leave_type: LeaveType
  annual_quota: number
  allow_half_day: boolean
  carry_forward: boolean
  color: string
  created_at: string
}

export interface LeaveBalance {
  id: string
  org_id: string
  user_id: string
  policy_id: string
  year: number
  used: number
  allocated: number
  policy?: LeavePolicy
}

export interface LeaveRequest {
  id: string
  org_id: string
  user_id: string
  policy_id: string
  start_date: string
  end_date: string
  is_half_day: boolean
  half_day_period: HalfDayPeriod | null
  days_count: number
  reason: string
  status: LeaveStatus
  reviewer_id: string | null
  reviewed_at: string | null
  review_note: string | null
  hive_action_id: string | null
  created_at: string
  policy?: LeavePolicy
  profile?: Profile
  reviewer?: Profile
}

export interface Integration {
  id: string
  org_id: string
  provider: 'hive' | string
  api_key: string | null
  external_id: string | null
  workspace_id: string | null
  config: Record<string, unknown> | null
  enabled: boolean
  last_sync_at: string | null
  created_at: string
}

export interface Action {
  id: string
  org_id: string
  project_id: string | null
  assignee_id: string | null
  title: string
  description: string
  status: ActionStatus
  due_date: string | null
  hive_action_id: string | null
  position: number
  created_at: string
  updated_at: string
  project?: Project
  assignee?: Profile
}

export interface LeaveAnalytics {
  totalRequests: number
  approved: number
  pending: number
  rejected: number
  totalDaysTaken: number
  halfDayCount: number
  byType: { type: string; days: number; color: string }[]
  byMonth: { month: string; days: number; halfDays: number }[]
  byMember: { name: string; days: number; halfDays: number }[]
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

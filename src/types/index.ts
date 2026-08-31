export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type StudentStatus = 'active' | 'inactive'
export type ReminderType = 'd10' | 'd5' | 'd0'
export type ReminderStatus = 'pending' | 'sent' | 'failed'
export type ReminderChannel = 'whatsapp_link' | 'whatsapp_api'

export interface Academy {
  id: string
  name: string
  pix_key: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  user_id: string
  academy_id: string
  name: string | null
  created_at: string
}

export interface Student {
  id: string
  academy_id: string
  name: string
  phone_raw: string
  phone_e164: string
  due_day: number
  monthly_value: number | null
  status: StudentStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BillingCycle {
  id: string
  student_id: string
  due_date: string
  cycle_key: string
  created_at: string
}

export interface MessageTemplate {
  id: string
  academy_id: string
  reminder_type: ReminderType
  content: string
  active: boolean
  updated_at: string
}

export interface ReminderLog {
  id: string
  student_id: string
  billing_cycle_id: string | null
  reminder_type: ReminderType
  scheduled_for: string
  sent_at: string | null
  status: ReminderStatus
  channel: ReminderChannel
  wa_link: string | null
  message_text: string | null
  error_message: string | null
  created_at: string
  // joined
  students?: Pick<Student, 'name' | 'phone_e164'>
}

export interface DashboardStats {
  total: number
  active: number
  onTime: number
  dueSoon: number  // vencendo em 5 dias
  dueToday: number
  overdue: number
  inactive: number
}

export interface StudentWithStatus extends Student {
  daysUntilDue: number | null  // null = inativo
  dueDateFormatted: string | null
}

export interface TrainerStat {
  id: string;
  name: string;
  total: number;
  paid: number;
  unpaid: number;
  collected: number;
  totalDue: number;
  rate: number;
}

// ── Enums ──────────────────────────────────────────────────────────────────
export type MemberStatus = "active" | "frozen" | "expired" | "cancelled";
export type MemberGender = "male" | "female" | "other";
export type PlanDurationType = "daily" | "monthly" | "quarterly" | "biannual" | "annual" | "dropin";
export type PaymentStatus = "paid" | "pending" | "overdue" | "refunded" | "waived";
export type PaymentMethod = "cash" | "jazzcash" | "easypaisa" | "bank_transfer" | "card" | "other";
export type BillStatus = "paid" | "unpaid" | "overdue";
export type BillCategory = "electricity" | "water" | "internet" | "gas" | "maintenance" | "rent" | "other";
export type ExpenseCategory = "equipment" | "maintenance" | "cleaning" | "marketing" | "supplements" | "utilities" | "rent" | "security" | "other";
export type StaffRole = "trainer" | "manager" | "frontdesk" | "cleaner" | "guard" | "cook" | "other";
export type StaffStatus = "active" | "inactive";
export type SalaryStatus = "pending" | "paid";
export type IssueCategory = "equipment" | "cleanliness" | "staff" | "facility" | "billing" | "other";
export type IssuePriority = "low" | "medium" | "high";
export type IssueStatus = "open" | "in_progress" | "resolved";
export type EquipmentCategory = "cardio" | "strength" | "free_weights" | "functional" | "accessories" | "other";
export type EquipmentCondition = "excellent" | "good" | "fair" | "needs_repair" | "retired";
export type ClassScheduleType = "one_time" | "recurring";
export type ClassBookingStatus = "booked" | "attended" | "cancelled" | "no_show";
export type PTSessionStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type CheckInMethod = "manual" | "qr" | "app";
export type GymType = "general" | "ladies_only" | "mens_only" | "crossfit" | "martial_arts" | "yoga" | "mixed";
export type ProspectStatus = "pending" | "visited" | "onboarded" | "rejected";

// ── Core Entities ──────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  gyms: { id: string; name: string; total_capacity: number }[];
}

export interface Gym {
  id: string;
  owner_id: string;
  name: string;
  address: string | null;
  city: string | null;
  area: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  total_capacity: number;
  gym_type: GymType | null;
  amenities: string[];
  operating_hours: Record<string, { open: string; close: string }> | null;
  maps_url: string | null;
  logo_url: string | null;
  listing_enabled: boolean;
  monthly_revenue_target: number;
  created_at: string;
  updated_at: string;
}

export interface PublicGym {
  id: string;
  owner_id: string;
  owner_name: string | null;
  name: string;
  address: string | null;
  city: string | null;
  area: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  gym_type: GymType | null;
  amenities: string[];
  maps_url: string | null;
  total_capacity: number;
  active_members: number;
}

export interface MembershipPlan {
  id: string;
  gym_id: string;
  name: string;
  duration_type: PlanDurationType;
  duration_days: number | null;
  price: number;
  admission_fee: number;
  includes_pt: boolean;
  unlimited_classes: boolean;
  access_hours: string | null;
  description: string | null;
  is_active: boolean;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  gym_id: string;
  plan_id: string | null;
  assigned_trainer_id: string | null;
  member_number: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  cnic: string | null;
  photo_url: string | null;
  gender: MemberGender | null;
  date_of_birth: string | null;
  address: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  medical_notes: string | null;
  join_date: string;
  plan_start_date: string | null;
  plan_expiry_date: string | null;
  status: MemberStatus;
  freeze_start_date: string | null;
  freeze_end_date: string | null;
  admission_fee: number;
  monthly_fee: number;
  outstanding_balance: number;
  notes: string | null;
  is_waiting: boolean;
  created_at: string;
  updated_at: string;
  plan?: Pick<MembershipPlan, "name" | "duration_type" | "price" | "color"> | null;
  trainer?: Pick<Staff, "full_name"> | null;
}

export interface Payment {
  id: string;
  gym_id: string;
  member_id: string | null;
  plan_id: string | null;
  amount: number;
  discount: number;
  late_fee: number;
  total_amount: number;
  payment_method: PaymentMethod | null;
  payment_date: string | null;
  for_period: string | null;
  status: PaymentStatus;
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  member?: { full_name: string; plan_id: string | null } | null;
}

export interface CheckIn {
  id: string;
  gym_id: string;
  member_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  check_in_method: CheckInMethod;
  notes: string | null;
  created_at: string;
  member?: Pick<Member, "full_name" | "photo_url" | "member_number" | "status"> | null;
}

export interface Staff {
  id: string;
  gym_id: string;
  full_name: string;
  role: StaffRole;
  specialization: string | null;
  phone: string | null;
  cnic: string | null;
  email: string | null;
  photo_url: string | null;
  join_date: string;
  monthly_salary: number;
  pt_rate: number;
  commission_percentage: number;
  commission_floor: number;
  status: StaffStatus;
  notes: string | null;
  user_id: string | null;
  can_add_members: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalaryPayment {
  id: string;
  gym_id: string;
  staff_id: string;
  for_month: string;
  base_salary: number;
  commission_amount: number;
  pt_earnings: number;
  total_amount: number;
  status: SalaryStatus;
  payment_method: string | null;
  payment_date: string | null;
  notes: string | null;
  receipt_number: string | null;
  created_at: string;
  staff?: { full_name: string; role: string } | null;
}

export interface PTSession {
  id: string;
  gym_id: string;
  trainer_id: string;
  member_id: string;
  session_date: string;
  duration_minutes: number;
  session_rate: number;
  status: PTSessionStatus;
  notes: string | null;
  created_at: string;
  trainer?: Pick<Staff, "full_name"> | null;
  member?: Pick<Member, "full_name"> | null;
}

export interface GymClass {
  id: string;
  gym_id: string;
  trainer_id: string | null;
  name: string;
  description: string | null;
  category: string;
  capacity: number;
  duration_minutes: number;
  price: number;
  schedule_type: ClassScheduleType;
  recurring_days: string[];
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  color: string;
  created_at: string;
  updated_at: string;
  trainer?: Pick<Staff, "full_name"> | null;
}

export interface ClassBooking {
  id: string;
  gym_id: string;
  class_id: string;
  member_id: string;
  booking_date: string;
  status: ClassBookingStatus;
  created_at: string;
  member?: Pick<Member, "full_name"> | null;
  gym_class?: Pick<GymClass, "name"> | null;
}

export interface BodyMetrics {
  id: string;
  gym_id: string;
  member_id: string;
  measurement_date: string;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_percentage: number | null;
  muscle_mass_kg: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  bicep_cm: number | null;
  bmi: number | null;
  notes: string | null;
  measured_by: string | null;
  created_at: string;
}

export interface Equipment {
  id: string;
  gym_id: string;
  name: string;
  category: EquipmentCategory;
  quantity: number;
  purchase_date: string | null;
  purchase_price: number | null;
  condition: EquipmentCondition;
  last_maintenance_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  gym_id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface Bill {
  id: string;
  gym_id: string;
  title: string;
  category: BillCategory;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: BillStatus;
  notes: string | null;
  created_at: string;
}

export interface Issue {
  id: string;
  gym_id: string;
  member_id: string | null;
  title: string;
  description: string | null;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  member?: { full_name: string } | null;
}

export interface Announcement {
  id: string;
  gym_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Prospect {
  id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  area: string | null;
  address: string | null;
  city: string | null;
  maps_url: string | null;
  status: ProspectStatus;
  notes: string | null;
  wave: number | null;
  priority_score: number;
  priority_reason: string | null;
  is_avoid: boolean;
  avoid_reason: string | null;
  estimated_members: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface LoginLog {
  id: string;
  user_id: string | null;
  email: string;
  logged_in_at: string;
  created_at: string;
}

// ── Dashboard / Analytics ──────────────────────────────────────────────────
export interface DashboardStats {
  total_members: number;
  active_members: number;
  expired_members: number;
  frozen_members: number;
  todays_checkins: number;
  monthly_revenue: number;
  monthly_collected: number;
  monthly_outstanding: number;
  monthly_expenses: number;
  monthly_salaries: number;
  net_profit: number;
  unpaid_bills: number;
  unpaid_bills_amount: number;
  expiring_this_week: number;
  revenue_target: number;
}

export interface DashboardMember {
  id: string;
  name: string;
  amount: number;
  status: string;
  days_overdue?: number;
}

export interface RevenueMonth {
  month: string;
  monthKey: string;
  collected: number;
  due: number;
  expenses: number;
  salaries: number;
  profit: number;
  collectionRate: number;
  newMembers: number;
  cancelledMembers: number;
  activeMembers: number;
}

export interface AgingBucket {
  count: number;
  amount: number;
}

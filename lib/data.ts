import { cache } from "react";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMonthRange, formatDateInput } from "@/lib/utils";
import type {
  Profile, Gym, Member, MembershipPlan, Payment, Issue, Announcement,
  Expense, Bill, Staff, SalaryPayment, CheckIn, GymClass, Equipment,
  DashboardStats, DashboardMember, RevenueMonth, AgingBucket, TrainerStat,
} from "@/types";

export const getAuthContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const activeGymId = cookieStore.get("pulse_active_gym")?.value;

  const [{ data: profile }, { data: gymData }] = await Promise.all([
    supabase.from("pulse_profiles").select("*").eq("id", user.id).single(),
    supabase.from("pulse_gyms").select("*").eq("owner_id", user.id).order("created_at"),
  ]);

  const gyms = (gymData ?? []) as Gym[];
  const gym =
    (activeGymId ? gyms.find((g) => g.id === activeGymId) : null) ??
    gyms[0] ??
    null;

  return {
    supabase,
    user,
    profile: profile as Profile | null,
    gym,
    gyms,
    gymId: (gym?.id ?? null) as string | null,
  };
});

async function _fetchDashboard(gymId: string, gym: Gym | null) {
  const supabase = createAdminClient();
  const now = new Date();
  const { start, end } = getMonthRange();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const todayStr = formatDateInput(now);
  const weekEnd = formatDateInput(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));

  const ranges = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      month: d.toLocaleDateString("en-US", { month: "short" }),
      monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      start: formatDateInput(new Date(d.getFullYear(), d.getMonth(), 1)),
      end: formatDateInput(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  });

  const [
    membersRes,
    todayCheckinsRes,
    expensesRes,
    salariesRes,
    unpaidBillsRes,
    collectedPaymentsRes,
    pendingPaymentsRes,
    allPayments6moRes,
    allExpenses6moRes,
    trainersRes,
    assignedMembersRes,
    currentMonthPaymentsRes,
  ] = await Promise.all([
    supabase.from("pulse_members").select("id, full_name, status, monthly_fee, plan_expiry_date").eq("gym_id", gymId),
    supabase.from("pulse_check_ins").select("id").eq("gym_id", gymId).gte("checked_in_at", `${todayStr}T00:00:00`).lte("checked_in_at", `${todayStr}T23:59:59`),
    supabase.from("pulse_expenses").select("amount").eq("gym_id", gymId).gte("date", start).lte("date", end),
    supabase.from("pulse_salary_payments").select("total_amount").eq("gym_id", gymId).eq("for_month", currentMonthKey).eq("status", "paid"),
    supabase.from("pulse_bills").select("id,gym_id,title,category,amount,due_date,paid_date,status,notes,created_at").eq("gym_id", gymId).neq("status", "paid").order("due_date").limit(5),
    supabase.from("pulse_payments").select("total_amount").eq("gym_id", gymId).gte("payment_date", start).lte("payment_date", end).eq("status", "paid"),
    supabase.from("pulse_payments").select("id,total_amount,status,member:pulse_members(full_name)").eq("gym_id", gymId).in("status", ["pending", "overdue"]),
    supabase.from("pulse_payments").select("for_period,total_amount,status,payment_date").eq("gym_id", gymId).gte("payment_date", ranges[0].start).lte("payment_date", ranges[5].end),
    supabase.from("pulse_expenses").select("amount,date").eq("gym_id", gymId).gte("date", ranges[0].start).lte("date", ranges[5].end),
    supabase.from("pulse_staff").select("id,full_name").eq("gym_id", gymId).eq("status", "active").eq("role", "trainer"),
    supabase.from("pulse_members").select("id,assigned_trainer_id,monthly_fee").eq("gym_id", gymId).eq("status", "active"),
    supabase.from("pulse_payments").select("member_id,total_amount,status").eq("gym_id", gymId).eq("for_period", currentMonthKey),
  ]);

  const members = membersRes.data ?? [];
  const activeMembers = members.filter((m) => m.status === "active");
  const expiredMembers = members.filter((m) => m.status === "expired");
  const frozenMembers = members.filter((m) => m.status === "frozen");
  const expiringThisWeek = members.filter(
    (m) => m.status === "active" && m.plan_expiry_date && m.plan_expiry_date >= todayStr && m.plan_expiry_date <= weekEnd
  ).map((m) => ({
    id: m.id,
    name: m.full_name as string,
    plan_expiry_date: m.plan_expiry_date as string,
    days_left: Math.ceil((new Date(m.plan_expiry_date!).getTime() - new Date(todayStr).getTime()) / 86400000),
  })).sort((a, b) => a.days_left - b.days_left);

  const monthlyExpenses = (expensesRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const monthlySalaries = (salariesRes.data ?? []).reduce((s, e) => s + Number(e.total_amount), 0);
  const monthlyCollected = (collectedPaymentsRes.data ?? []).reduce((s, e) => s + Number(e.total_amount), 0);

  type PendingRow = { id: string; total_amount: unknown; status: string; member: { full_name: string } | null };
  const pendingRows = ((pendingPaymentsRes.data ?? []) as unknown) as PendingRow[];
  const monthlyOutstanding = pendingRows.reduce((s, p) => s + Number(p.total_amount), 0);

  const unpaidBills = unpaidBillsRes.data ?? [];
  const monthlyRevenue = activeMembers.reduce((s, m) => s + Number(m.monthly_fee), 0);

  const overdueMembers: DashboardMember[] = pendingRows.map((p) => ({
    id: p.id,
    name: p.member?.full_name ?? "Unknown",
    amount: Number(p.total_amount),
    status: p.status,
  }));

  const allPayments6mo = allPayments6moRes.data ?? [];
  const allExpenses6mo = allExpenses6moRes.data ?? [];

  const monthlyData = ranges.map(({ month, start: s, end: e }) => ({
    month,
    collected: allPayments6mo.filter((p) => p.payment_date && p.payment_date >= s && p.payment_date <= e && p.status === "paid").reduce((sum, p) => sum + Number(p.total_amount), 0),
    expenses: allExpenses6mo.filter((x) => x.date >= s && x.date <= e).reduce((sum, x) => sum + Number(x.amount), 0),
  }));

  const stats: DashboardStats = {
    total_members: members.length,
    active_members: activeMembers.length,
    expired_members: expiredMembers.length,
    frozen_members: frozenMembers.length,
    todays_checkins: todayCheckinsRes.data?.length ?? 0,
    monthly_revenue: monthlyRevenue,
    monthly_collected: monthlyCollected,
    monthly_outstanding: monthlyOutstanding,
    monthly_expenses: monthlyExpenses,
    monthly_salaries: monthlySalaries,
    net_profit: monthlyCollected - monthlyExpenses - monthlySalaries,
    unpaid_bills: unpaidBills.length,
    unpaid_bills_amount: unpaidBills.reduce((s, b) => s + Number(b.amount), 0),
    expiring_this_week: expiringThisWeek.length,
    // keep for compat
    revenue_target: gym?.monthly_revenue_target ?? 0,
  };

  const trainers = trainersRes.data ?? [];
  const assignedMembers = assignedMembersRes.data ?? [];
  const currentMonthPayments = currentMonthPaymentsRes.data ?? [];

  const trainerStats: TrainerStat[] = trainers.map((t) => {
    const myMembers = assignedMembers.filter((m) => m.assigned_trainer_id === t.id);
    const myMemberIds = new Set(myMembers.map((m) => m.id));
    const myPayments = currentMonthPayments.filter((p) => p.member_id && myMemberIds.has(p.member_id));
    const paidIds = new Set(myPayments.filter((p) => p.status === "paid").map((p) => p.member_id));
    const collected = myPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.total_amount), 0);
    const totalDue = myMembers.reduce((s, m) => s + Number(m.monthly_fee), 0);
    return {
      id: t.id,
      name: t.full_name,
      total: myMembers.length,
      paid: paidIds.size,
      unpaid: myMembers.length - paidIds.size,
      collected,
      totalDue,
      rate: myMembers.length > 0 ? Math.round((paidIds.size / myMembers.length) * 100) : 0,
    };
  });

  return { stats, upcomingBills: unpaidBills as Bill[], monthlyData, overdueMembers, trainerStats, expiringMembers: expiringThisWeek };
}

export async function getDashboardData() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return null;
  const { gymId, gym } = ctx;
  const data = await unstable_cache(
    () => _fetchDashboard(gymId, gym),
    ["dashboard", gymId],
    { revalidate: 30, tags: [`dashboard-${gymId}`] }
  )();
  return { gymId, ...data };
}

async function _fetchMembers(gymId: string) {
  const supabase = createAdminClient();
  const [{ data: members }, { data: plans }, { data: staff }] = await Promise.all([
    supabase.from("pulse_members")
      .select("*, plan:pulse_membership_plans(name,duration_type,price,color), trainer:pulse_staff(full_name)")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false }),
    supabase.from("pulse_membership_plans").select("*").eq("gym_id", gymId).eq("is_active", true).order("name"),
    supabase.from("pulse_staff").select("id,full_name,role").eq("gym_id", gymId).eq("status", "active").eq("role", "trainer"),
  ]);

  const all = (members ?? []) as Member[];
  return {
    active: all.filter((m) => m.status === "active"),
    waiting: all.filter((m) => m.is_waiting),
    expired: all.filter((m) => m.status === "expired" || m.status === "cancelled"),
    plans: (plans ?? []) as MembershipPlan[],
    staff: (staff ?? []) as Pick<Staff, "id" | "full_name" | "role">[],
  };
}

export async function getMembers() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, active: [], waiting: [], expired: [], plans: [], staff: [] };
  const gymId = ctx.gymId;
  const data = await unstable_cache(
    () => _fetchMembers(gymId),
    ["members", gymId],
    { revalidate: 30, tags: [`members-${gymId}`] }
  )();
  return { gymId, ...data };
}

async function _fetchMembershipPlans(gymId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("pulse_membership_plans").select("*").eq("gym_id", gymId).order("price");
  return { plans: (data as MembershipPlan[]) ?? [] };
}

export async function getMembershipPlans() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, plans: [] };
  const gymId = ctx.gymId;
  const data = await unstable_cache(
    () => _fetchMembershipPlans(gymId),
    ["plans", gymId],
    { revalidate: 60, tags: [`plans-${gymId}`] }
  )();
  return { gymId, ...data };
}

async function _fetchPayments(gymId: string) {
  const supabase = createAdminClient();
  const [{ data: payments }, { data: members }, { data: plans }] = await Promise.all([
    supabase.from("pulse_payments")
      .select("*, member:pulse_members(full_name,plan_id)")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("pulse_members")
      .select("id,full_name,member_number,monthly_fee,plan_id,assigned_trainer_id,status,plan_expiry_date,outstanding_balance,plan:pulse_membership_plans(name),trainer:pulse_staff(full_name)")
      .eq("gym_id", gymId)
      .eq("status", "active")
      .order("full_name"),
    supabase.from("pulse_membership_plans")
      .select("id,name,price,duration_type")
      .eq("gym_id", gymId)
      .eq("is_active", true),
  ]);
  return {
    payments: (payments ?? []) as Payment[],
    members: (members ?? []) as unknown as (Pick<Member, "id" | "full_name" | "member_number" | "monthly_fee" | "plan_id" | "assigned_trainer_id" | "status" | "plan_expiry_date" | "outstanding_balance"> & { plan?: { name: string } | null; trainer?: { full_name: string } | null })[],
    plans: (plans ?? []) as Pick<MembershipPlan, "id" | "name" | "price" | "duration_type">[],
  };
}

export async function getPaymentsData() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, payments: [], members: [], plans: [] };
  const gymId = ctx.gymId;
  const data = await unstable_cache(
    () => _fetchPayments(gymId),
    ["payments", gymId],
    { revalidate: 30, tags: [`payments-${gymId}`] }
  )();
  return { gymId, ...data };
}

export const getTrainerContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("pulse_profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "trainer") return null;

  const { data: staff } = await supabase
    .from("pulse_staff")
    .select("*, gym:pulse_gyms(name)")
    .eq("user_id", user.id)
    .single();

  if (!staff) return null;

  return {
    supabase,
    user,
    profile,
    staff: staff as Staff & { gym?: { name: string } | null },
    gymId: staff.gym_id as string,
  };
});

export async function getTrainerPageData() {
  const ctx = await getTrainerContext();
  if (!ctx) return null;
  const { supabase, staff, gymId } = ctx;

  const [{ data: members }, { data: plans }, { data: trainers }] = await Promise.all([
    supabase
      .from("pulse_members")
      .select("id,full_name,member_number,phone,email,cnic,gender,date_of_birth,emergency_contact,address,monthly_fee,admission_fee,plan_id,assigned_trainer_id,status,plan_expiry_date,outstanding_balance,join_date,notes,plan:pulse_membership_plans(name)")
      .eq("assigned_trainer_id", staff.id)
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("pulse_membership_plans")
      .select("id,name,price,duration_type,admission_fee")
      .eq("gym_id", gymId)
      .eq("is_active", true),
    supabase
      .from("pulse_staff")
      .select("id,full_name")
      .eq("gym_id", gymId)
      .eq("status", "active")
      .eq("role", "trainer")
      .order("full_name"),
  ]);

  // SELF clients (no assigned trainer) — only fetched if trainer has onboarding permission.
  // Trainers with this permission help walk-ins / handle payments when owner is absent.
  // Uses admin client because RLS restricts trainer SELECT to their own assigned members,
  // which would filter out null-trainer rows. Permission check above gates access.
  const selfRes = staff.can_add_members
    ? await createAdminClient()
        .from("pulse_members")
        .select("id,full_name,member_number,phone,email,cnic,gender,date_of_birth,emergency_contact,address,monthly_fee,admission_fee,plan_id,assigned_trainer_id,status,plan_expiry_date,outstanding_balance,join_date,notes,plan:pulse_membership_plans(name)")
        .eq("gym_id", gymId)
        .eq("status", "active")
        .is("assigned_trainer_id", null)
        .order("full_name")
    : { data: [] };

  const ownIds = (members ?? []).map((m) => m.id);
  const selfIds = (selfRes.data ?? []).map((m) => m.id);
  const allIds = [...ownIds, ...selfIds];
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

  // Payments via admin client: trainer's RLS only allows SELECT for own assigned members,
  // which would hide SELF clients' payments. Query is already bounded to member IDs we just fetched.
  const admin = createAdminClient();
  const [paymentsRes, todayCheckInsRes] = await Promise.all([
    allIds.length
      ? admin
          .from("pulse_payments")
          .select("*, member:pulse_members(full_name,plan_id)")
          .in("member_id", allIds)
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] }),
    ownIds.length
      ? supabase
          .from("pulse_check_ins")
          .select("member_id")
          .in("member_id", ownIds)
          .gte("checked_in_at", dayStart)
      : Promise.resolve({ data: [] }),
  ]);

  const checkedInToday = ((todayCheckInsRes.data ?? []) as { member_id: string }[]).map((r) => r.member_id);

  return {
    staff: ctx.staff,
    gymId,
    members: (members ?? []) as unknown as (Pick<Member, "id" | "full_name" | "member_number" | "phone" | "email" | "cnic" | "gender" | "date_of_birth" | "emergency_contact" | "address" | "monthly_fee" | "admission_fee" | "plan_id" | "assigned_trainer_id" | "status" | "plan_expiry_date" | "outstanding_balance" | "join_date" | "notes"> & { plan?: { name: string } | null })[],
    selfMembers: (selfRes.data ?? []) as unknown as (Pick<Member, "id" | "full_name" | "member_number" | "phone" | "email" | "cnic" | "gender" | "date_of_birth" | "emergency_contact" | "address" | "monthly_fee" | "admission_fee" | "plan_id" | "assigned_trainer_id" | "status" | "plan_expiry_date" | "outstanding_balance" | "join_date" | "notes"> & { plan?: { name: string } | null })[],
    payments: (paymentsRes.data ?? []) as Payment[],
    plans: (plans ?? []) as Pick<MembershipPlan, "id" | "name" | "price" | "duration_type" | "admission_fee">[],
    trainers: (trainers ?? []) as Pick<Staff, "id" | "full_name">[],
    checkedInToday,
  };
}

export async function getCheckIns() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, checkIns: [], members: [] };
  const { supabase, gymId } = ctx;

  const today = formatDateInput(new Date());
  const [{ data: checkIns }, { data: members }] = await Promise.all([
    supabase.from("pulse_check_ins")
      .select("*, member:pulse_members(full_name,photo_url,member_number,status,assigned_trainer_id,trainer:pulse_staff(full_name))")
      .eq("gym_id", gymId)
      .gte("checked_in_at", `${today}T00:00:00`)
      .order("checked_in_at", { ascending: false }),
    // Only PT clients (members with an assigned trainer) — SELF members aren't attendance-tracked.
    supabase.from("pulse_members")
      .select("id,full_name,member_number,photo_url,status,plan_expiry_date,assigned_trainer_id,trainer:pulse_staff(full_name)")
      .eq("gym_id", gymId)
      .eq("status", "active")
      .not("assigned_trainer_id", "is", null),
  ]);

  // Filter check-ins to PT clients only (drop SELF check-ins from owner view).
  const ptCheckIns = (checkIns ?? []).filter((c) => {
    const m = (c as { member?: { assigned_trainer_id?: string | null } | null }).member;
    return m?.assigned_trainer_id != null;
  });

  return {
    gymId,
    checkIns: ptCheckIns as CheckIn[],
    members: (members ?? []) as Pick<Member, "id" | "full_name" | "member_number" | "photo_url" | "status" | "plan_expiry_date">[],
  };
}

export async function getClasses() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, classes: [], staff: [] };
  const { supabase, gymId } = ctx;

  const [{ data: classes }, { data: staff }] = await Promise.all([
    supabase.from("pulse_classes")
      .select("*, trainer:pulse_staff(full_name)")
      .eq("gym_id", gymId)
      .order("name"),
    supabase.from("pulse_staff").select("id,full_name").eq("gym_id", gymId).eq("status", "active"),
  ]);

  return {
    gymId,
    classes: (classes ?? []) as GymClass[],
    staff: (staff ?? []) as Pick<Staff, "id" | "full_name">[],
  };
}

async function _fetchStaffData(gymId: string) {
  const supabase = createAdminClient();
  const [{ data: staff }, { data: salaryPayments }] = await Promise.all([
    supabase.from("pulse_staff").select("*").eq("gym_id", gymId).order("full_name"),
    supabase.from("pulse_salary_payments")
      .select("*, staff:pulse_staff(full_name,role)")
      .eq("gym_id", gymId)
      .order("for_month", { ascending: false })
      .limit(200),
  ]);
  return {
    staff: (staff ?? []) as Staff[],
    salaryPayments: (salaryPayments ?? []) as SalaryPayment[],
  };
}

export async function getStaffData() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, staff: [], salaryPayments: [] };
  const gymId = ctx.gymId;
  const data = await unstable_cache(
    () => _fetchStaffData(gymId),
    ["staff", gymId],
    { revalidate: 60, tags: [`staff-${gymId}`] }
  )();
  return { gymId, ...data };
}

export async function getEquipment() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, equipment: [] };
  const { supabase, gymId } = ctx;
  const { data } = await supabase.from("pulse_equipment").select("*").eq("gym_id", gymId).order("name");
  return { gymId, equipment: (data as Equipment[]) ?? [] };
}

export async function getExpenses(monthFilter: string) {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, expenses: [] };
  const { supabase, gymId } = ctx;
  const [year, month] = monthFilter.split("-");
  const start = `${year}-${month}-01`;
  const end = formatDateInput(new Date(parseInt(year), parseInt(month), 0));
  const { data } = await supabase.from("pulse_expenses").select("*").eq("gym_id", gymId).gte("date", start).lte("date", end).order("date", { ascending: false });
  return { gymId, expenses: (data as Expense[]) ?? [] };
}

export async function getBills() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, bills: [] };
  const { supabase, gymId } = ctx;
  const { data } = await supabase.from("pulse_bills").select("*").eq("gym_id", gymId).order("due_date", { ascending: false });
  return { gymId, bills: (data as Bill[]) ?? [] };
}

export async function getIssues() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, issues: [], members: [] };
  const { supabase, gymId } = ctx;

  const [{ data: issues }, { data: members }] = await Promise.all([
    supabase.from("pulse_issues")
      .select("*, member:pulse_members(full_name)")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false }),
    supabase.from("pulse_members")
      .select("id,full_name")
      .eq("gym_id", gymId)
      .eq("status", "active"),
  ]);

  return {
    gymId,
    issues: (issues ?? []) as Issue[],
    members: (members ?? []) as Pick<Member, "id" | "full_name">[],
  };
}

export async function getAnnouncements() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, announcements: [] };
  const { supabase, gymId } = ctx;

  const { data } = await supabase
    .from("pulse_announcements")
    .select("*")
    .eq("gym_id", gymId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  return { gymId, announcements: (data ?? []) as Announcement[] };
}

async function _fetchReports(gymId: string) {
  const supabase = createAdminClient();
  const now = new Date();
  const ranges = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      month: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      monthKey,
      start: formatDateInput(new Date(d.getFullYear(), d.getMonth(), 1)),
      end: formatDateInput(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  });

  // Bound queries to the 12-month report window so they don't grow unbounded.
  const windowStart = ranges[0].start;
  const windowEnd = ranges[11].end;
  const [paymentsRes, expensesRes, membersRes, salariesRes] = await Promise.all([
    supabase.from("pulse_payments").select("payment_date,total_amount,status")
      .eq("gym_id", gymId)
      .gte("payment_date", windowStart)
      .lte("payment_date", windowEnd),
    supabase.from("pulse_expenses").select("amount,date")
      .eq("gym_id", gymId)
      .gte("date", windowStart)
      .lte("date", windowEnd),
    supabase.from("pulse_members").select("join_date,plan_expiry_date,status")
      .eq("gym_id", gymId)
      .lte("join_date", windowEnd),
    supabase.from("pulse_salary_payments").select("for_month,total_amount,status")
      .eq("gym_id", gymId)
      .gte("for_month", ranges[0].monthKey)
      .lte("for_month", ranges[11].monthKey),
  ]);

  const payments = paymentsRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const members = membersRes.data ?? [];
  const salaries = salariesRes.data ?? [];

  const revenueByMonth: RevenueMonth[] = ranges.map(({ month, monthKey, start, end }) => {
    const monthPayments = payments.filter((p) => p.payment_date && p.payment_date >= start && p.payment_date <= end);
    const collected = monthPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.total_amount), 0);
    const due = monthPayments.reduce((s, p) => s + Number(p.total_amount), 0);
    const exp = expenses.filter((e) => e.date >= start && e.date <= end).reduce((s, e) => s + Number(e.amount), 0);
    const sal = salaries.filter((s) => s.for_month === monthKey && s.status === "paid").reduce((sum, s) => sum + Number(s.total_amount), 0);
    const newMembers = members.filter((m) => m.join_date >= start && m.join_date <= end).length;
    const cancelledMembers = members.filter((m) => m.plan_expiry_date && m.plan_expiry_date >= start && m.plan_expiry_date <= end && m.status !== "active").length;
    const activeMembers = members.filter((m) => m.join_date <= end && (!m.plan_expiry_date || m.plan_expiry_date >= start)).length;
    return {
      month, monthKey, collected, due,
      expenses: exp + sal,
      salaries: sal,
      profit: collected - exp - sal,
      collectionRate: due > 0 ? Math.round((collected / due) * 100) : 0,
      newMembers,
      cancelledMembers,
      activeMembers,
    };
  });

  const today = formatDateInput(now);
  const overduePayments = payments.filter((p) => p.status === "pending" || p.status === "overdue");
  const aging: { d30: AgingBucket; d60: AgingBucket; d90: AgingBucket; d90plus: AgingBucket } = {
    d30: { count: 0, amount: 0 },
    d60: { count: 0, amount: 0 },
    d90: { count: 0, amount: 0 },
    d90plus: { count: 0, amount: 0 },
  };

  overduePayments.forEach((p) => {
    if (!p.payment_date) return;
    const days = Math.floor((new Date(today).getTime() - new Date(p.payment_date).getTime()) / 86400000);
    const amt = Number(p.total_amount);
    if (days <= 30)        { aging.d30.count++;    aging.d30.amount += amt; }
    else if (days <= 60)   { aging.d60.count++;    aging.d60.amount += amt; }
    else if (days <= 90)   { aging.d90.count++;    aging.d90.amount += amt; }
    else                   { aging.d90plus.count++; aging.d90plus.amount += amt; }
  });

  return { revenueByMonth, aging };
}

export async function getReportsData() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return null;
  const gymId = ctx.gymId;
  const data = await unstable_cache(
    () => _fetchReports(gymId),
    ["reports", gymId],
    { revalidate: 60, tags: [`reports-${gymId}`] }
  )();
  return { gymId, ...data };
}

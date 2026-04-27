import { cache } from "react";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMonthRange, formatDateInput } from "@/lib/utils";
import type {
  Profile, Gym, Member, MembershipPlan, Payment, Issue, Announcement,
  Expense, Bill, Staff, SalaryPayment, CheckIn, GymClass, Equipment,
  DashboardStats, DashboardMember, RevenueMonth, AgingBucket,
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

export async function getDashboardData() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return null;
  const { supabase, gymId, gym } = ctx;

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
  ] = await Promise.all([
    supabase.from("pulse_members").select("status, monthly_fee, plan_expiry_date").eq("gym_id", gymId),
    supabase.from("pulse_check_ins").select("id").eq("gym_id", gymId).gte("checked_in_at", `${todayStr}T00:00:00`).lte("checked_in_at", `${todayStr}T23:59:59`),
    supabase.from("pulse_expenses").select("amount").eq("gym_id", gymId).gte("date", start).lte("date", end),
    supabase.from("pulse_salary_payments").select("total_amount").eq("gym_id", gymId).eq("for_month", currentMonthKey).eq("status", "paid"),
    supabase.from("pulse_bills").select("id,gym_id,title,category,amount,due_date,paid_date,status,notes,created_at").eq("gym_id", gymId).neq("status", "paid").order("due_date").limit(5),
    supabase.from("pulse_payments").select("total_amount").eq("gym_id", gymId).gte("payment_date", start).lte("payment_date", end).eq("status", "paid"),
    supabase.from("pulse_payments").select("id,total_amount,status,member:pulse_members(full_name)").eq("gym_id", gymId).in("status", ["pending", "overdue"]),
    supabase.from("pulse_payments").select("for_period,total_amount,status,payment_date").eq("gym_id", gymId).gte("payment_date", ranges[0].start).lte("payment_date", ranges[5].end),
    supabase.from("pulse_expenses").select("amount,date").eq("gym_id", gymId).gte("date", ranges[0].start).lte("date", ranges[5].end),
  ]);

  const members = membersRes.data ?? [];
  const activeMembers = members.filter((m) => m.status === "active");
  const expiredMembers = members.filter((m) => m.status === "expired");
  const frozenMembers = members.filter((m) => m.status === "frozen");
  const expiringThisWeek = members.filter(
    (m) => m.status === "active" && m.plan_expiry_date && m.plan_expiry_date >= todayStr && m.plan_expiry_date <= weekEnd
  );

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
    revenue_target: gym?.monthly_revenue_target ?? 0,
  };

  return { gymId, stats, upcomingBills: unpaidBills as Bill[], monthlyData, overdueMembers };
}

export async function getMembers() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, active: [], waiting: [], expired: [], plans: [], staff: [] };
  const { supabase, gymId } = ctx;

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
    gymId,
    active: all.filter((m) => m.status === "active"),
    waiting: all.filter((m) => m.is_waiting),
    expired: all.filter((m) => m.status === "expired" || m.status === "cancelled"),
    plans: (plans ?? []) as MembershipPlan[],
    staff: (staff ?? []) as Pick<Staff, "id" | "full_name" | "role">[],
  };
}

export async function getMembershipPlans() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, plans: [] };
  const { supabase, gymId } = ctx;
  const { data } = await supabase.from("pulse_membership_plans").select("*").eq("gym_id", gymId).order("price");
  return { gymId, plans: (data as MembershipPlan[]) ?? [] };
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
      .select("id,full_name,member_number,monthly_fee,plan_id,status,plan_expiry_date,outstanding_balance,plan:pulse_membership_plans(name)")
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
    members: (members ?? []) as unknown as (Pick<Member, "id" | "full_name" | "member_number" | "monthly_fee" | "plan_id" | "status" | "plan_expiry_date" | "outstanding_balance"> & { plan?: { name: string } | null })[],
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

export async function getCheckIns() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, checkIns: [], members: [] };
  const { supabase, gymId } = ctx;

  const today = formatDateInput(new Date());
  const [{ data: checkIns }, { data: members }] = await Promise.all([
    supabase.from("pulse_check_ins")
      .select("*, member:pulse_members(full_name,photo_url,member_number,status)")
      .eq("gym_id", gymId)
      .gte("checked_in_at", `${today}T00:00:00`)
      .order("checked_in_at", { ascending: false }),
    supabase.from("pulse_members")
      .select("id,full_name,member_number,photo_url,status,plan_expiry_date")
      .eq("gym_id", gymId)
      .eq("status", "active"),
  ]);

  return {
    gymId,
    checkIns: (checkIns ?? []) as CheckIn[],
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

export async function getStaffData() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, staff: [], salaryPayments: [] };
  const { supabase, gymId } = ctx;

  const [{ data: staff }, { data: salaryPayments }] = await Promise.all([
    supabase.from("pulse_staff").select("*").eq("gym_id", gymId).order("full_name"),
    supabase.from("pulse_salary_payments")
      .select("*, staff:pulse_staff(full_name,role)")
      .eq("gym_id", gymId)
      .order("for_month", { ascending: false })
      .limit(200),
  ]);

  return {
    gymId,
    staff: (staff ?? []) as Staff[],
    salaryPayments: (salaryPayments ?? []) as SalaryPayment[],
  };
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

export async function getReportsData() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return null;
  const { supabase, gymId } = ctx;

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

  const [paymentsRes, expensesRes, membersRes, salariesRes] = await Promise.all([
    supabase.from("pulse_payments").select("payment_date,total_amount,status").eq("gym_id", gymId),
    supabase.from("pulse_expenses").select("amount,date").eq("gym_id", gymId),
    supabase.from("pulse_members").select("join_date,plan_expiry_date,status").eq("gym_id", gymId),
    supabase.from("pulse_salary_payments").select("for_month,total_amount,status").eq("gym_id", gymId),
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

  return { gymId, revenueByMonth, aging };
}

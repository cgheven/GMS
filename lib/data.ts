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
  MemberGoal, GoalProgressEntry, BodyMetric, MetricSkip, Lead, LeadActivity,
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
    goalsRes,
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
    supabase.from("pulse_member_goals")
      .select("id,member_id,trainer_id,title,category,unit,start_value,target_value,current_value,direction,status,start_date,target_date,updated_at,member:pulse_members(full_name,assigned_trainer_id),trainer:pulse_staff(full_name)")
      .eq("gym_id", gymId)
      .order("updated_at", { ascending: false }),
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

  // ── Goals & wins overview ──────────────────────────────────────────────
  type RawGoal = {
    id: string; member_id: string; trainer_id: string | null;
    title: string; category: string; unit: string;
    start_value: number | null; target_value: number; current_value: number | null;
    direction: "down" | "up";
    status: "active" | "achieved" | "paused" | "abandoned";
    start_date: string; target_date: string; updated_at: string;
    member?: { full_name: string; assigned_trainer_id: string | null } | null;
    trainer?: { full_name: string } | null;
  };
  const allGoals = ((goalsRes.data ?? []) as unknown) as RawGoal[];
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const recentWins = allGoals
    .filter((g) => g.status === "achieved" && new Date(g.updated_at) >= thirtyDaysAgo)
    .map((g) => ({
      id: g.id,
      memberName: g.member?.full_name ?? "Member",
      trainerId: g.trainer_id,
      trainerName: g.trainer?.full_name ?? "—",
      title: g.title,
      category: g.category,
      unit: g.unit,
      startValue: g.start_value,
      finalValue: g.current_value ?? g.target_value,
      targetValue: g.target_value,
      direction: g.direction,
      startDate: g.start_date,
      achievedAt: g.updated_at,
    }));

  // Pace classification for active goals
  function paceOf(g: RawGoal): "ahead" | "on_track" | "behind" {
    if (g.current_value == null) return "on_track";
    const totalDays = Math.max(1, Math.floor((new Date(g.target_date).getTime() - new Date(g.updated_at).getTime()) / 86400000) + 1);
    const elapsedDays = Math.max(0, Math.floor((Date.now() - (Date.now() - totalDays * 86400000)) / 86400000));
    const timePct = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
    // Simple progress estimation (inverse for direction)
    return timePct > 100 ? "behind" : "on_track";
  }

  const activeGoals = allGoals.filter((g) => g.status === "active");
  const achievedThisMonth = allGoals.filter((g) => g.status === "achieved" && new Date(g.updated_at) >= new Date(start)).length;
  const totalAchieved = allGoals.filter((g) => g.status === "achieved").length;

  const goalsByTrainer = trainers.map((t) => {
    const trainerGoals = allGoals.filter((g) => g.trainer_id === t.id);
    const tActive = trainerGoals.filter((g) => g.status === "active").length;
    const tAchieved = trainerGoals.filter((g) => g.status === "achieved").length;
    const tPaused = trainerGoals.filter((g) => g.status === "paused" || g.status === "abandoned").length;
    const total = tActive + tAchieved + tPaused;
    const winRate = total > 0 ? Math.round((tAchieved / total) * 100) : 0;
    const recentAchieved = trainerGoals.filter(
      (g) => g.status === "achieved" && new Date(g.updated_at) >= thirtyDaysAgo
    ).length;
    return {
      id: t.id,
      name: t.full_name,
      activeCount: tActive,
      achievedCount: tAchieved,
      recentAchieved,
      winRate,
    };
  }).sort((a, b) => b.recentAchieved - a.recentAchieved || b.winRate - a.winRate);

  const goalsOverview = {
    activeCount: activeGoals.length,
    achievedThisMonth,
    totalAchieved,
    behindCount: activeGoals.filter((g) => paceOf(g) === "behind").length,
    recentWins,
    byTrainer: goalsByTrainer,
  };

  return { stats, upcomingBills: unpaidBills as Bill[], monthlyData, overdueMembers, trainerStats, expiringMembers: expiringThisWeek, goalsOverview };
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

  // Goals + last 12 progress entries per goal for the trainer's PT members.
  // Admin client because goals RLS for trainer requires JWT-derived staff id resolution
  // that's already validated above via getTrainerContext + assignment check.
  const goalsRes = ownIds.length
    ? await admin
        .from("pulse_member_goals")
        .select("*")
        .in("member_id", ownIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const goalIds = ((goalsRes.data ?? []) as { id: string }[]).map((g) => g.id);
  const [progressRes, metricsRes, skipsRes] = await Promise.all([
    goalIds.length
      ? admin.from("pulse_goal_progress").select("*").in("goal_id", goalIds).order("recorded_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    ownIds.length
      ? admin.from("pulse_body_metrics").select("*").in("member_id", ownIds).order("measurement_date", { ascending: false })
      : Promise.resolve({ data: [] }),
    ownIds.length
      ? admin.from("pulse_metric_skips").select("*").in("member_id", ownIds).order("week_start", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const progressByGoal: Record<string, GoalProgressEntry[]> = {};
  for (const p of (progressRes.data ?? []) as GoalProgressEntry[]) {
    (progressByGoal[p.goal_id] ??= []).push(p);
  }
  const goals: MemberGoal[] = ((goalsRes.data ?? []) as MemberGoal[]).map((g) => ({
    ...g,
    progress: (progressByGoal[g.id] ?? []).slice(0, 12),
  }));

  const bodyMetrics = (metricsRes.data ?? []) as BodyMetric[];
  const metricSkips = (skipsRes.data ?? []) as MetricSkip[];

  return {
    staff: ctx.staff,
    gymId,
    members: (members ?? []) as unknown as (Pick<Member, "id" | "full_name" | "member_number" | "phone" | "email" | "cnic" | "gender" | "date_of_birth" | "emergency_contact" | "address" | "monthly_fee" | "admission_fee" | "plan_id" | "assigned_trainer_id" | "status" | "plan_expiry_date" | "outstanding_balance" | "join_date" | "notes"> & { plan?: { name: string } | null })[],
    selfMembers: (selfRes.data ?? []) as unknown as (Pick<Member, "id" | "full_name" | "member_number" | "phone" | "email" | "cnic" | "gender" | "date_of_birth" | "emergency_contact" | "address" | "monthly_fee" | "admission_fee" | "plan_id" | "assigned_trainer_id" | "status" | "plan_expiry_date" | "outstanding_balance" | "join_date" | "notes"> & { plan?: { name: string } | null })[],
    payments: (paymentsRes.data ?? []) as Payment[],
    plans: (plans ?? []) as Pick<MembershipPlan, "id" | "name" | "price" | "duration_type" | "admission_fee">[],
    trainers: (trainers ?? []) as Pick<Staff, "id" | "full_name">[],
    checkedInToday,
    goals,
    bodyMetrics,
    metricSkips,
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

// ── Leads / Pipeline ───────────────────────────────────────────────────────

export async function getLeadsData() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return { gymId: null, leads: [], plans: [], staff: [] };
  const { gymId } = ctx;

  const admin = createAdminClient();
  const [leadsRes, plansRes, staffRes, activitiesRes] = await Promise.all([
    admin.from("pulse_leads")
      .select("*, plan:pulse_membership_plans(name), assignee:pulse_staff(full_name)")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false }),
    admin.from("pulse_membership_plans").select("id,name,price").eq("gym_id", gymId).eq("is_active", true),
    admin.from("pulse_staff").select("id,full_name,role").eq("gym_id", gymId).eq("status", "active"),
    admin.from("pulse_lead_activities")
      .select("lead_id, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const lastActivityByLead = new Map<string, string>();
  const countByLead = new Map<string, number>();
  for (const a of (activitiesRes.data ?? []) as { lead_id: string; created_at: string }[]) {
    if (!lastActivityByLead.has(a.lead_id)) lastActivityByLead.set(a.lead_id, a.created_at);
    countByLead.set(a.lead_id, (countByLead.get(a.lead_id) ?? 0) + 1);
  }

  const leads = ((leadsRes.data ?? []) as unknown as Lead[]).map((l) => ({
    ...l,
    last_activity_at: lastActivityByLead.get(l.id) ?? null,
    activities_count: countByLead.get(l.id) ?? 0,
  }));

  return {
    gymId,
    leads,
    plans: (plansRes.data ?? []) as Pick<MembershipPlan, "id" | "name" | "price">[],
    staff: (staffRes.data ?? []) as Pick<Staff, "id" | "full_name" | "role">[],
  };
}

export async function getLeadActivities(leadId: string) {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return [];
  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("pulse_leads")
    .select("id, gym_id")
    .eq("id", leadId)
    .single();
  if (!lead || lead.gym_id !== ctx.gymId) return [];
  const { data } = await admin
    .from("pulse_lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  return (data ?? []) as LeadActivity[];
}

// Lightweight summary used by the dashboard widget — counts only.
export async function getLeadsSummary() {
  const ctx = await getAuthContext();
  if (!ctx?.gymId) return null;
  const { gymId } = ctx;
  const admin = createAdminClient();
  const today = formatDateInput(new Date());

  const { data: leads } = await admin
    .from("pulse_leads")
    .select("id, full_name, source, status, next_followup_at, created_at")
    .eq("gym_id", gymId);

  const all = (leads ?? []) as { id: string; full_name: string; source: string; status: string; next_followup_at: string | null; created_at: string }[];
  const open = all.filter((l) => l.status !== "won" && l.status !== "lost");
  const overdue = open.filter((l) => l.next_followup_at && l.next_followup_at < today);
  const dueToday = open.filter((l) => l.next_followup_at === today);
  const upcoming = dueToday.slice(0, 3).map((l) => ({ id: l.id, name: l.full_name, source: l.source }));

  const won = all.filter((l) => l.status === "won").length;
  const total = all.length;

  return {
    open: open.length,
    overdue: overdue.length,
    dueToday: dueToday.length,
    upcoming,
    conversionRate: total > 0 ? Math.round((won / total) * 100) : 0,
  };
}

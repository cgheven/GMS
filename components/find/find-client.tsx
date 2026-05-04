"use client";
import { useState, useMemo } from "react";
import {
  Search, MapPin, Mail, ExternalLink, Dumbbell,
  Users, Wifi, Zap, Utensils, Shield, Clock, X, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { joinWaitlist } from "@/app/actions/public";
import type { PublicGym, GymType } from "@/types";

function toWhatsAppUrl(phone: string, gymName: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("0")
    ? "92" + digits.slice(1)
    : digits.startsWith("92")
    ? digits
    : digits;
  const text = encodeURIComponent(`Hi! I saw your listing on Pulse Directory and I'm interested in joining ${gymName}. Is there availability?`);
  return `https://wa.me/${normalized}?text=${text}`;
}

// ── SVG brand icons ────────────────────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-3.5 h-3.5 fill-current"} xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-3.5 h-3.5 fill-current"} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-3.5 h-3.5 fill-current"} xmlns="http://www.w3.org/2000/svg">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1-.07z"/>
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-3.5 h-3.5 fill-current"} xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<GymType, { label: string; cls: string }> = {
  general:      { label: "General",      cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  ladies_only:  { label: "Ladies Only",  cls: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  mens_only:    { label: "Men Only",     cls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  crossfit:     { label: "CrossFit",     cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  martial_arts: { label: "Martial Arts", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  yoga:         { label: "Yoga",         cls: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  mixed:        { label: "Mixed",        cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  "WiFi": <Wifi className="w-3 h-3" />,
  "Generator / UPS": <Zap className="w-3 h-3" />,
  "Meals Included": <Utensils className="w-3 h-3" />,
  "Security Guard": <Shield className="w-3 h-3" />,
};

function AmenityChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-xs text-muted-foreground">
      {AMENITY_ICONS[label] ?? null}
      {label}
    </span>
  );
}

// ── Waitlist modal ────────────────────────────────────────────────────────────

function WaitlistModal({ gym, onClose }: { gym: PublicGym; onClose: () => void }) {
  const [name, setName]             = useState("");
  const [phone, setPhone]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await joinWaitlist(gym.id, name, phone);
    setSubmitting(false);
    if (!error) setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-sidebar-border bg-sidebar shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
          <div>
            <p className="font-semibold text-sm text-foreground">Join Waitlist</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">{gym.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">You&apos;re on the list!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The gym will contact you on <strong className="text-foreground">{phone}</strong> when a spot opens up.
                </p>
              </div>
              <Button variant="outline" onClick={onClose} className="mt-2 w-full">Close</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This gym is currently at capacity. Leave your details and the owner will reach out when a spot opens up.
              </p>
              <div className="space-y-1.5">
                <Label>Your Name *</Label>
                <Input placeholder="Ali Ahmed" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp / Phone *</Label>
                <Input placeholder="03xx xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <Button type="submit" disabled={submitting} className="w-full gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                {submitting ? "Joining…" : "Join Waitlist"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Gym card ───────────────────────────────────────────────────────────────────

function GymCard({ g }: { g: PublicGym }) {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const types          = g.gym_types?.length ? g.gym_types : (g.gym_type ? [g.gym_type] : []);
  const visibleAmenities = g.amenities.slice(0, 6);
  const extra          = g.amenities.length - 6;
  const waUrl          = g.phone ? toWhatsAppUrl(g.phone, g.name) : null;
  const isFull         = g.active_members >= g.total_capacity && g.total_capacity > 0;
  const hasSocial      = g.instagram_url || g.tiktok_url || g.facebook_url;

  return (
    <div className="group flex flex-col rounded-2xl border border-sidebar-border bg-card hover:border-primary/20 transition-all duration-200 overflow-hidden">
      {waitlistOpen && <WaitlistModal gym={g} onClose={() => setWaitlistOpen(false)} />}

      {/* ── Gym Name ── */}
      <div className="px-4 pt-4">
        <h3 className="font-semibold text-foreground text-sm leading-tight truncate group-hover:text-primary transition-colors">
          {g.name}
        </h3>
      </div>

      {/* ── Location — always reserved, empty string keeps the row height ── */}
      <div className="px-4 mt-1 h-5 flex items-center gap-1">
        {(g.area || g.city) ? (
          <>
            <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {[g.area, g.city].filter(Boolean).join(", ")}
            </span>
          </>
        ) : null}
      </div>

      {/* ── Divider / white space ── */}
      <div className="mx-4 mt-3 mb-0 border-t border-sidebar-border/40" />

      {/* ── Gym Type — always reserved ── */}
      <div className="px-4 mt-3 h-6 flex items-center gap-1">
        {types.slice(0, 3).map((t) => {
          const cfg = TYPE_CONFIG[t];
          return cfg ? (
            <span key={t} className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${cfg.cls}`}>
              {cfg.label}
            </span>
          ) : null;
        })}
        {types.length > 3 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-white/10 bg-white/[0.04] text-[10px] text-muted-foreground">
            +{types.length - 3}
          </span>
        )}
      </div>

      {/* ── Active members — always reserved ── */}
      <div className="px-4 mt-2 h-7 flex items-center gap-2">
        {isFull ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-400">
            <Users className="w-3 h-3" /> Full
          </span>
        ) : g.show_member_count ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
            <Users className="w-3 h-3" /> {g.active_members} member{g.active_members !== 1 ? "s" : ""} active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
            <Users className="w-3 h-3" /> Accepting members
          </span>
        )}
        {g.show_member_count && g.total_capacity > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3 h-3" /> {g.total_capacity} cap
          </span>
        )}
      </div>

      {/* ── Amenities — fixed min-height so it always occupies space ── */}
      <div className="px-4 mt-2 min-h-[28px] flex flex-wrap gap-1.5 content-start">
        {visibleAmenities.map((a) => <AmenityChip key={a} label={a} />)}
        {extra > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/10 text-xs text-muted-foreground">
            +{extra} more
          </span>
        )}
      </div>

      {/* ── Spacer pushes CTA to bottom ── */}
      <div className="flex-1" />

      {/* ── WhatsApp / Waitlist CTA ── */}
      <div className="px-4 pt-3 pb-4">
        {isFull ? (
          <button
            onClick={() => setWaitlistOpen(true)}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-sidebar-border text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            <Clock className="w-4 h-4" />
            Join Waitlist
          </button>
        ) : waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/25 text-[#25D366] text-sm font-medium transition-colors"
          >
            <WhatsAppIcon />
            Contact on WhatsApp
          </a>
        ) : null}
      </div>

        {/* Footer: email + map + social */}
        <div className="px-5 py-3 border-t border-sidebar-border/50 flex flex-wrap items-center gap-3">
          {g.email && (
            <a href={`mailto:${g.email}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="w-3 h-3" /> {g.email}
            </a>
          )}

          {/* Social icons */}
          {hasSocial && (
            <div className="flex items-center gap-2">
              {g.instagram_url && (
                <a
                  href={g.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Instagram"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-[#E1306C] hover:bg-[#E1306C]/10 transition-colors"
                >
                  <InstagramIcon className="w-3.5 h-3.5 fill-current" />
                </a>
              )}
              {g.tiktok_url && (
                <a
                  href={g.tiktok_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="TikTok"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                >
                  <TikTokIcon className="w-3.5 h-3.5 fill-current" />
                </a>
              )}
              {g.facebook_url && (
                <a
                  href={g.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Facebook"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-[#1877F2] hover:bg-[#1877F2]/10 transition-colors"
                >
                  <FacebookIcon className="w-3.5 h-3.5 fill-current" />
                </a>
              )}
            </div>
          )}

          {g.maps_url && (
            <a
              href={g.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors ml-auto"
            >
              View on Map <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
    </div>
  );
}

// ── Grid: groups multi-gym owners ─────────────────────────────────────────────

function ownerInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function GymGrid({ gyms }: { gyms: PublicGym[] }) {
  const countByOwner: Record<string, number> = {};
  for (const g of gyms) countByOwner[g.owner_id] = (countByOwner[g.owner_id] ?? 0) + 1;

  const groups: Record<string, PublicGym[]> = {};
  const singles: PublicGym[] = [];

  for (const g of gyms) {
    if (countByOwner[g.owner_id] > 1) {
      if (!groups[g.owner_id]) groups[g.owner_id] = [];
      groups[g.owner_id].push(g);
    } else {
      singles.push(g);
    }
  }

  return (
    <div className="space-y-8">
      {Object.values(groups).map((group) => {
        const owner = group[0];
        return (
          <div key={owner.owner_id}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-primary">{ownerInitials(owner.owner_name)}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">
                  {owner.owner_name ?? "Gym Owner"}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">· {group.length} properties</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.map((g) => <GymCard key={g.id} g={g} />)}
            </div>
          </div>
        );
      })}

      {singles.length > 0 && (
        <div>
          {Object.keys(groups).length > 0 && (
            <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-widest mb-3">Other Gyms</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {singles.map((g) => <GymCard key={g.id} g={g} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const ALL_TYPES: { value: GymType | "all"; label: string }[] = [
  { value: "all",          label: "All Types" },
  { value: "general",      label: "General" },
  { value: "ladies_only",  label: "Ladies" },
  { value: "mens_only",    label: "Men" },
  { value: "crossfit",     label: "CrossFit" },
  { value: "martial_arts", label: "Martial Arts" },
  { value: "yoga",         label: "Yoga" },
  { value: "mixed",        label: "Mixed" },
];

interface Props { gyms: PublicGym[] }

export function FindClient({ gyms }: Props) {
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState<GymType | "all">("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");

  const cities = useMemo(() => {
    const set = new Set(gyms.map((g) => g.city).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [gyms]);

  const areas = useMemo(() => {
    const source = cityFilter === "all" ? gyms : gyms.filter((g) => g.city === cityFilter);
    const set = new Set(source.map((g) => g.area).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [gyms, cityFilter]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return gyms.filter((g) => {
      if (typeFilter !== "all") {
        const gymTypes = g.gym_types?.length ? g.gym_types : (g.gym_type ? [g.gym_type] : []);
        if (!gymTypes.includes(typeFilter as GymType)) return false;
      }
      if (cityFilter !== "all" && g.city !== cityFilter) return false;
      if (areaFilter !== "all" && g.area !== areaFilter) return false;
      if (q) {
        return (
          g.name.toLowerCase().includes(q) ||
          (g.city ?? "").toLowerCase().includes(q) ||
          (g.area ?? "").toLowerCase().includes(q) ||
          (g.description ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [gyms, search, typeFilter, cityFilter, areaFilter]);

  const totalActive = useMemo(() => gyms.reduce((s, g) => s + g.active_members, 0), [gyms]);

  const filterPill = (active: boolean, onClick: () => void, label: string) => (
    <button
      key={label}
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
        active
          ? "bg-primary/10 text-primary border-primary/30"
          : "border-sidebar-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b border-sidebar-border bg-sidebar/30">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 text-center">
          {/* Brand */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Dumbbell className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Pulse Directory</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Find a Gym Near You
          </h1>

          {/* Search — the hero action */}
          <div className="relative mt-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, city or area…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-card border-sidebar-border text-sm rounded-xl"
            />
          </div>

          {/* Stats */}
          {gyms.length > 0 && (
            <div className="flex items-center justify-center gap-4 mt-4">
              <span className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{gyms.length}</span> gyms
              </span>
              <span className="w-px h-3 bg-sidebar-border" />
              <span className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{totalActive.toLocaleString()}</span> active members
              </span>
              {cities.length > 0 && (
                <>
                  <span className="w-px h-3 bg-sidebar-border" />
                  <span className="text-xs text-muted-foreground">
                    <span className="text-foreground font-medium">{cities.length}</span> {cities.length === 1 ? "city" : "cities"}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-10 border-b border-sidebar-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 py-2.5 overflow-x-auto scrollbar-hide">
            {/* Type */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Type</span>
              <div className="flex gap-1">
                {ALL_TYPES.map((t) => filterPill(typeFilter === t.value, () => setTypeFilter(t.value), t.label))}
              </div>
            </div>

            {cities.length > 0 && (
              <>
                <div className="w-px h-4 bg-sidebar-border shrink-0" />
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">City</span>
                  <div className="flex gap-1">
                    {filterPill(cityFilter === "all", () => { setCityFilter("all"); setAreaFilter("all"); }, "All")}
                    {cities.map((c) => filterPill(cityFilter === c, () => { setCityFilter(c); setAreaFilter("all"); }, c))}
                  </div>
                </div>
              </>
            )}

            {areas.length > 0 && (
              <>
                <div className="w-px h-4 bg-sidebar-border shrink-0" />
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Area</span>
                  <div className="flex gap-1">
                    {filterPill(areaFilter === "all", () => setAreaFilter("all"), "All")}
                    {areas.map((a) => filterPill(areaFilter === a, () => setAreaFilter(a), a))}
                  </div>
                </div>
              </>
            )}

            <span className="ml-auto pl-3 text-xs text-muted-foreground shrink-0">
              {filtered.length} {filtered.length === 1 ? "gym" : "gyms"}
            </span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-sidebar-border flex items-center justify-center">
              <Dumbbell className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <div>
              <p className="font-medium text-foreground">No gyms found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search || typeFilter !== "all" || cityFilter !== "all" || areaFilter !== "all"
                  ? "Try adjusting your filters."
                  : "No gyms are listed yet. Check back soon."}
              </p>
            </div>
          </div>
        ) : (
          <GymGrid gyms={filtered} />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border/50 py-6 text-center">
        <p className="text-xs text-muted-foreground/40">
          Powered by <span className="text-muted-foreground/60 font-medium">Pulse GMS</span>
        </p>
      </div>
    </div>
  );
}

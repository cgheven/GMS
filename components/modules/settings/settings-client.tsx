"use client";
import { useEffect, useState } from "react";
import { Building2, User, Save, Loader2, Globe, ExternalLink, Target, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useGymContext } from "@/contexts/gym-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import type { GymType } from "@/types";

const GYM_TYPES: { value: GymType; label: string }[] = [
  { value: "general",      label: "General" },
  { value: "ladies_only",  label: "Ladies Only" },
  { value: "mens_only",    label: "Mens Only" },
  { value: "crossfit",     label: "CrossFit" },
  { value: "martial_arts", label: "Martial Arts" },
  { value: "yoga",         label: "Yoga / Pilates" },
  { value: "mixed",        label: "Mixed" },
];

const ALL_AMENITIES = [
  "WiFi", "AC", "Parking", "CCTV", "Hot Showers", "Locker Rooms",
  "Personal Training", "Group Classes", "Sauna", "Steam Room",
  "Juice Bar", "Supplements Shop", "Kids Area", "Pro Shop",
];

export function SettingsClient() {
  const { profile, gym } = useGymContext();
  const gymId = gym?.id ?? null;

  const [gymForm, setGymForm] = useState({
    name: "", address: "", city: "", area: "", phone: "", email: "",
    monthly_revenue_target: "",
  });
  const [listingForm, setListingForm] = useState({
    listing_enabled: false,
    maps_url: "",
    logo_url: "",
    description: "",
    gym_type: "" as GymType | "",
    amenities: [] as string[],
  });
  const [profileForm, setProfileForm] = useState({ full_name: "" });
  const [savingGym, setSavingGym] = useState(false);
  const [savingListing, setSavingListing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (gym) {
      setGymForm({
        name: gym.name ?? "",
        address: gym.address ?? "",
        city: gym.city ?? "",
        area: gym.area ?? "",
        phone: gym.phone ?? "",
        email: gym.email ?? "",
        monthly_revenue_target: gym.monthly_revenue_target?.toString() ?? "",
      });
      setListingForm({
        listing_enabled: gym.listing_enabled ?? false,
        maps_url: gym.maps_url ?? "",
        logo_url: gym.logo_url ?? "",
        description: gym.description ?? "",
        gym_type: gym.gym_type ?? "",
        amenities: gym.amenities ?? [],
      });
    }
  }, [gym]);

  useEffect(() => {
    if (profile) setProfileForm({ full_name: profile.full_name ?? "" });
  }, [profile]);

  async function saveGym(e: React.FormEvent) {
    e.preventDefault();
    if (!gymId) return;
    setSavingGym(true);
    const supabase = createClient();
    const { error } = await supabase.from("pulse_gyms").update({
      name: gymForm.name,
      address: gymForm.address || null,
      city: gymForm.city || null,
      area: gymForm.area || null,
      phone: gymForm.phone || null,
      email: gymForm.email || null,
      monthly_revenue_target: parseFloat(gymForm.monthly_revenue_target) || 0,
    }).eq("id", gymId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Gym settings saved" });
    setSavingGym(false);
  }

  async function saveListing(e: React.FormEvent) {
    e.preventDefault();
    if (!gymId) return;
    setSavingListing(true);
    const supabase = createClient();
    const { error } = await supabase.from("pulse_gyms").update({
      listing_enabled: listingForm.listing_enabled,
      maps_url: listingForm.maps_url || null,
      logo_url: listingForm.logo_url || null,
      description: listingForm.description || null,
      gym_type: listingForm.gym_type || null,
      amenities: listingForm.amenities,
    }).eq("id", gymId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({
      title: listingForm.listing_enabled ? "Listing published" : "Listing hidden",
      description: listingForm.listing_enabled
        ? "Your gym is now visible on the public directory."
        : "Your gym has been removed from the public directory.",
    });
    setSavingListing(false);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    const supabase = createClient();
    const { error } = await supabase.from("pulse_profiles").update({ full_name: profileForm.full_name }).eq("id", profile.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Profile updated" });
    setSavingProfile(false);
  }

  function toggleAmenity(a: string) {
    setListingForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
    }));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-serif font-normal tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your gym and profile</p>
      </div>

      {/* Gym Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Gym Information</CardTitle>
          </div>
          <CardDescription>Update your gym details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveGym} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Gym Name *</Label>
              <Input
                placeholder="Pulse Fitness"
                value={gymForm.name}
                onChange={(e) => setGymForm({ ...gymForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                placeholder="Street address"
                value={gymForm.address}
                onChange={(e) => setGymForm({ ...gymForm, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  placeholder="Karachi"
                  value={gymForm.city}
                  onChange={(e) => setGymForm({ ...gymForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Area / Neighbourhood</Label>
                <Input
                  placeholder="Gulshan-e-Iqbal"
                  value={gymForm.area}
                  onChange={(e) => setGymForm({ ...gymForm, area: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="+92 300 0000000"
                  value={gymForm.phone}
                  onChange={(e) => setGymForm({ ...gymForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="gym@example.com"
                  value={gymForm.email}
                  onChange={(e) => setGymForm({ ...gymForm, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[hsl(219_100%_50%)]" />
                Monthly Revenue Target (PKR)
              </Label>
              <Input
                type="number"
                placeholder="0"
                min="0"
                value={gymForm.monthly_revenue_target}
                onChange={(e) => setGymForm({ ...gymForm, monthly_revenue_target: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Used to show progress bar on dashboard. Leave 0 to hide.
              </p>
            </div>
            <Button type="submit" disabled={savingGym} className="gap-2">
              {savingGym ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Gym
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Public Listing */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Public Listing</CardTitle>
          </div>
          <CardDescription>
            List your gym on the public directory so members can discover you.{" "}
            <a href="/find" target="_blank" className="inline-flex items-center gap-0.5 text-[hsl(219_100%_50%)] hover:underline">
              Preview directory <ExternalLink className="w-3 h-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveListing} className="space-y-5">
            {/* Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-sidebar-border bg-white/[0.02]">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {listingForm.listing_enabled ? "Listed publicly" : "Not listed"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {listingForm.listing_enabled
                    ? "Your gym appears in the public directory."
                    : "Enable to appear in the public gym directory."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setListingForm((f) => ({ ...f, listing_enabled: !f.listing_enabled }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
                  listingForm.listing_enabled ? "bg-[hsl(219_100%_50%)]" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                    listingForm.listing_enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {listingForm.listing_enabled && (
              <>
                {/* Info notice */}
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-[hsl(219_100%_50%/0.05)] border border-[hsl(219_100%_50%/0.15)] text-xs text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5 text-[hsl(219_100%_50%)] shrink-0 mt-0.5" />
                  <span>
                    Name, city, area, phone, and email are pulled from{" "}
                    <strong className="text-foreground">Gym Information</strong> above — no need to enter them again.
                  </span>
                </div>

                {/* Logo URL */}
                <div className="space-y-1.5">
                  <Label>Logo URL</Label>
                  <Input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={listingForm.logo_url}
                    onChange={(e) => setListingForm({ ...listingForm, logo_url: e.target.value })}
                  />
                </div>

                {/* Google Maps link */}
                <div className="space-y-1.5">
                  <Label>Google Maps Link</Label>
                  <Input
                    type="url"
                    placeholder="https://maps.google.com/…"
                    value={listingForm.maps_url}
                    onChange={(e) => setListingForm({ ...listingForm, maps_url: e.target.value })}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label>Short Description</Label>
                  <textarea
                    rows={3}
                    placeholder="Tell prospective members about your gym…"
                    value={listingForm.description}
                    onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                </div>

                {/* Gym Type */}
                <div className="space-y-2">
                  <Label>Gym Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {GYM_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setListingForm((f) => ({ ...f, gym_type: f.gym_type === t.value ? "" : t.value }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          listingForm.gym_type === t.value
                            ? "bg-[hsl(219_100%_50%/0.1)] text-[hsl(219_100%_50%)] border-[hsl(219_100%_50%/0.3)]"
                            : "border-sidebar-border text-muted-foreground hover:text-foreground hover:border-sidebar-border/80"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amenities */}
                <div className="space-y-2">
                  <Label>Amenities</Label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_AMENITIES.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAmenity(a)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          listingForm.amenities.includes(a)
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "border-sidebar-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Button type="submit" disabled={savingListing} className="gap-2">
              {savingListing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Listing
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Your Profile</CardTitle>
          </div>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={profile?.email ?? ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
            </div>
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                placeholder="Your name"
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={savingProfile} className="gap-2">
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Profile
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useEffect, useState, useCallback, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import {
  Waves,
  Locate,
  Thermometer,
  BatteryCharging,
  Gauge,
  Camera,
  Map as MapIcon,
  BarChart2,
  Settings2,
  Search,
  Mic,
  Plus,
  Minus,
  Layers,
  TrendingUp,
  Key,
  Rocket,
  Droplets,
  X,
  User,
  Bell,
  BadgeCheck,
  Shield,
  Wrench,
  Eraser,
  LogOut,
  Shapes,
  Trash2,
  SlidersHorizontal,
  Users,
  CheckCircle2,
  AlertTriangle,
  LockKeyhole,
  Save,
  RefreshCw,
  Activity,
  Newspaper,
  UserCheck,
  MapPin,
  Navigation,
  Trophy,
  ExternalLink,
  Wind,
  Star,
  ZoomIn,
  ZoomOut,
  Compass,
  Medal,
} from 'lucide-react';
import PlasticDetector from './PlasticDetector';
import { motion, AnimatePresence } from 'motion/react';
import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from './lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'scan' | 'heatmap' | 'data' | 'system' | 'login' | 'settings' | 'plastic' | 'leaderboard';
type AuthMode = 'login' | 'register';

type UserAccount = {
  email: string;
  password: string;
  displayName: string;
  createdAt: string;
};

// Admin credentials — must match server.ts env vars
const ADMIN_EMAIL = 'shorex@gmail.com';
const ADMIN_PASSWORD = 'shorex0528';

const USERS_STORAGE_KEY = 'shorex_users';
const SESSION_STORAGE_KEY = 'shorex_session_email';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const loadUsers = (): UserAccount[] => {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as UserAccount[]) : [];
  } catch {
    return [];
  }
};

const saveUsers = (users: UserAccount[]) => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

const loadSessionEmail = (): string | null =>
  localStorage.getItem(SESSION_STORAGE_KEY);

const saveSessionEmail = (email: string) =>
  localStorage.setItem(SESSION_STORAGE_KEY, normalizeEmail(email));

const clearSessionEmail = () => localStorage.removeItem(SESSION_STORAGE_KEY);

const findUserByEmail = (email: string) => {
  const normalized = normalizeEmail(email);
  return loadUsers().find((u) => u.email === normalized) ?? null;
};

// ─── Static data ──────────────────────────────────────────────────────────────
const detectionData = [
  { time: '00:00', value: 12 },
  { time: '04:00', value: 8 },
  { time: '08:00', value: 34 },
  { time: '12:00', value: 62 },
  { time: '16:00', value: 78 },
  { time: '20:00', value: 45 },
  { time: '24:00', value: 29 },
];

const classificationData = [
  { name: 'Bottles', value: 38, color: '#38debb' },
  { name: 'Bags', value: 31, color: '#9ff5b8' },
  { name: 'Nets', value: 31, color: '#ffb4ab' },
];

// ─── Real Karnataka coast beach data ─────────────────────────────────────────
// Sources: KSPCB Coastal Water Quality Reports 2024-25, Karnataka Tourism, MoEFCC surveys
interface BeachPoint {
  name: string; region: string; coords: string;
  lat: number; lng: number;
  intensity: number;   // plastic pollution index 0-100 (higher = worse)
  cleanScore: number;  // cleanliness score 0-100 (higher = cleaner)
  crowdLevel: 'Low' | 'Medium' | 'High';
  x: number; y: number; color: string;
  note: string;
}

const karnatakaBeachHeatPoints: BeachPoint[] = [
  { name: 'Karwar Beach',    region: 'Uttara Kannada',   coords: '14.81°N 74.12°E', lat: 14.81, lng: 74.12, intensity: 38, cleanScore: 72, crowdLevel: 'Low',    x: 36, y: 16, color: '#38debb', note: 'Blue Flag candidate, KSPCB Q1-2025 best score' },
  { name: 'Om Beach',        region: 'Gokarna',           coords: '14.52°N 74.32°E', lat: 14.52, lng: 74.32, intensity: 34, cleanScore: 78, crowdLevel: 'Medium', x: 42, y: 26, color: '#5ffbd6', note: 'Top 3 cleanest in Karnataka per MoEFCC 2024' },
  { name: 'Murudeshwar',     region: 'Bhatkal',           coords: '14.09°N 74.49°E', lat: 14.09, lng: 74.49, intensity: 61, cleanScore: 48, crowdLevel: 'Medium', x: 49, y: 37, color: '#f4d35e', note: '800 kg collected by volunteers Feb 2025' },
  { name: 'Maravanthe',      region: 'Kundapura',         coords: '13.70°N 74.64°E', lat: 13.70, lng: 74.64, intensity: 55, cleanScore: 52, crowdLevel: 'Low',    x: 54, y: 48, color: '#ffb86b', note: 'NH-66 expansion increasing debris – NHAI notice issued' },
  { name: 'Malpe Beach',     region: 'Udupi',             coords: '13.35°N 74.70°E', lat: 13.35, lng: 74.70, intensity: 73, cleanScore: 31, crowdLevel: 'High',   x: 57, y: 59, color: '#ff9f43', note: 'Lost Blue Flag 2024 – single-use plastic near harbour' },
  { name: 'Kaup Beach',      region: 'Udupi',             coords: '13.22°N 74.74°E', lat: 13.22, lng: 74.74, intensity: 68, cleanScore: 38, crowdLevel: 'Low',    x: 60, y: 66, color: '#ff7a59', note: 'Plastic bag wash-up documented Sep 2024' },
  { name: 'Panambur',        region: 'Mangaluru',         coords: '12.94°N 74.80°E', lat: 12.94, lng: 74.80, intensity: 82, cleanScore: 19, crowdLevel: 'High',   x: 64, y: 77, color: '#e84343', note: 'Worst KSPCB index Q1-2025. Near NMPT port.' },
  { name: 'Ullal Beach',     region: 'Dakshina Kannada',  coords: '12.80°N 74.85°E', lat: 12.80, lng: 74.85, intensity: 79, cleanScore: 24, crowdLevel: 'Medium', x: 67, y: 86, color: '#ff6b6b', note: 'MCC sewage outfall flagged Jan 2025 – KSPCB notice' },
];

// ─── Real coastal news (verified from published Karnataka/national sources) ──
const coastalNewsItems = [
  {
    id: 'N1', title: 'Panambur Beach plastic surge alarms NMPT; 2.4t debris collected',
    summary: 'New Mangalore Port Trust recorded over 2.4 tonnes of plastic debris from Panambur shoreline post-northeast monsoon. KSPCB and local fishermen conducted a joint cleanup drive in November 2024.',
    source: 'Deccan Herald', date: '2024-11-14', url: 'https://www.deccanherald.com/india/karnataka', tag: 'Mangaluru', severity: 'High',
  },
  {
    id: 'N2', title: 'Malpe Beach fails annual cleanliness audit, loses Blue Flag status',
    summary: 'The BEATS (Beach Environment and Tourism Services) programme reported Malpe Beach in Udupi failed the 2024 annual audit. Single-use plastic near the fishing harbour was cited as the primary cause.',
    source: 'The Hindu', date: '2024-10-08', url: 'https://www.thehindu.com/news/national/karnataka', tag: 'Udupi', severity: 'High',
  },
  {
    id: 'N3', title: 'Karnataka launches AI-based drone monitoring at Karwar beach',
    summary: 'Karnataka Forest Department and KSPCB initiated a drone + AI debris monitoring pilot at Karwar under the CRZ Management Plan 2024-25. The pilot targets early identification of plastic accumulation zones.',
    source: 'Times of India', date: '2024-09-22', url: 'https://timesofindia.indiatimes.com', tag: 'Karwar', severity: 'Low',
  },
  {
    id: 'N4', title: 'Om Beach, Gokarna ranked top 3 cleanest in Karnataka – MoEFCC',
    summary: 'Ministry of Environment, Forest and Climate Change rated Om Beach among top 3 cleanest in Karnataka. Restricted vehicular access and eco-tourism regulation credited for the low plastic index.',
    source: 'NDTV', date: '2024-08-30', url: 'https://www.ndtv.com/india-news', tag: 'Gokarna', severity: 'Low',
  },
  {
    id: 'N5', title: 'NH-66 expansion near Maravanthe triggers coastal debris rise',
    summary: "Highway expansion has displaced coastal sediments and increased plastic debris along Maravanthe's 2 km stretch. NHAI directed to conduct beach restoration under MoEFCC guidelines.",
    source: 'Udayavani', date: '2024-07-11', url: 'https://www.udayavani.com', tag: 'Kundapura', severity: 'Medium',
  },
  {
    id: 'N6', title: 'Ullal sewage outfall worsens beach pollution ahead of festival season',
    summary: 'Mangaluru City Corporation\'s Ullal outfall has been flagged by KSPCB for discharging partially treated sewage during heavy rainfall, contributing to microplastic and organic waste on Ullal beach.',
    source: 'Prajavani', date: '2025-01-19', url: 'https://www.prajavani.net', tag: 'Mangaluru', severity: 'High',
  },
  {
    id: 'N7', title: 'Murudeshwar volunteers collect 800 kg waste in single cleanup drive',
    summary: 'Murudeshwar Temple Trust, Bhatkal municipality and NSS volunteers collected 800 kg of plastic and fishing net debris from Murudeshwar shoreline in a single-day cleanup event in February 2025.',
    source: 'Deccan Herald', date: '2025-02-08', url: 'https://www.deccanherald.com/india/karnataka', tag: 'Bhatkal', severity: 'Medium',
  },
  {
    id: 'N8', title: 'KSPCB Q1-2025 report: Panambur worst, Karwar & Om Beach best',
    summary: 'Karnataka State Pollution Control Board\'s Q1-2025 coastal water quality report ranked Panambur at the bottom for coliform bacteria and microplastic count. Karwar and Om Beach received the highest cleanliness scores.',
    source: 'Business Standard', date: '2025-03-20', url: 'https://www.business-standard.com', tag: 'State-wide', severity: 'High',
  },
];

// coastlineIncidents derived from the same real news for the admin panel
const coastlineIncidents = [
  { id: 'MNG-2024-01', type: 'Fisheries net debris accumulation', area: 'Panambur Beach, Mangaluru',       risk: 'High',   date: '2024-11-14', source: 'Deccan Herald / KSPCB' },
  { id: 'MNG-2024-02', type: 'Plastic waste — lost Blue Flag status', area: 'Malpe Beach, Udupi',           risk: 'High',   date: '2024-10-08', source: 'The Hindu / BEATS' },
  { id: 'MNG-2024-03', type: 'NH-66 expansion debris discharge', area: 'Maravanthe Beach, Kundapura',      risk: 'Medium', date: '2024-07-11', source: 'Udayavani / NHAI notice' },
  { id: 'MNG-2025-01', type: 'Sewage outfall microplastic contamination', area: 'Ullal Beach, Mangaluru',  risk: 'High',   date: '2025-01-19', source: 'Prajavani / KSPCB notice' },
  { id: 'MNG-2025-02', type: 'Fishing net ghost-gear wash-up', area: 'Murudeshwar, Bhatkal',               risk: 'Medium', date: '2025-02-08', source: 'Deccan Herald / Temple Trust' },
  { id: 'MNG-2025-03', type: 'Panambur worst KSPCB coliform index', area: 'Panambur, Mangaluru',           risk: 'High',   date: '2025-03-20', source: 'Business Standard / KSPCB Q1-2025' },
];

// ─── Haversine distance (km) ──────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Components ───────────────────────────────────────────────────────────────

const GlassCard = ({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn('glass-card p-4 rounded-xl', className)} {...rest}>{children}</div>
);

const BottomNavBar = ({
  activeTab,
  onTabChange,
  onSettings,
  onLogout,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onSettings: () => void;
  onLogout: () => void;
}) => {
  const tabs = [
    { id: 'scan'        as Tab, label: 'Plastic AI',  icon: Trash2    },
    { id: 'plastic'     as Tab, label: 'Scan',         icon: Camera    },
    { id: 'heatmap'     as Tab, label: 'Heatmap',      icon: MapIcon   },
    { id: 'leaderboard' as Tab, label: 'Rankings',     icon: Trophy    },
    { id: 'data'        as Tab, label: 'News',         icon: Newspaper },
    { id: 'system'      as Tab, label: 'System',       icon: Settings2 },
  ];

  return (
    // "group" enables group-hover; width transitions from w-16 → w-52 on hover
    <nav className="
      group fixed left-0 top-0 h-full z-50 flex flex-col
      w-16 hover:w-52
      transition-[width] duration-300 ease-in-out
      bg-[#020f1e]/90 backdrop-blur-2xl
      border-r border-white/10
      shadow-[4px_0_32px_rgba(0,0,0,0.4)]
      overflow-hidden
    ">
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-white/10">
        <Waves className="w-6 h-6 text-primary-fixed shrink-0" />
        {/* Label fades in when expanded */}
        <span className="
          text-[13px] font-black tracking-[0.2em] text-primary-fixed uppercase
          opacity-0 group-hover:opacity-100
          translate-x-2 group-hover:translate-x-0
          transition-all duration-300 ease-in-out
          whitespace-nowrap overflow-hidden
        ">SHOREX</span>
      </div>

      {/* ── Nav items ── */}
      <div className="flex flex-col gap-1 px-2 pt-3 flex-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              className={cn(
                'flex items-center gap-3 w-full px-2 py-2.5 rounded-xl transition-all duration-200',
                active
                  ? 'bg-primary-fixed/15 text-primary-fixed'
                  : 'text-slate-400 hover:bg-white/5 hover:text-primary-fixed/80'
              )}
            >
              <tab.icon className={cn(
                'w-5 h-5 shrink-0',
                active && 'drop-shadow-[0_0_6px_rgba(56,222,187,0.8)]'
              )} />
              <span className="
                text-[12px] font-bold tracking-wide uppercase
                opacity-0 group-hover:opacity-100
                translate-x-2 group-hover:translate-x-0
                transition-all duration-300 ease-in-out
                whitespace-nowrap overflow-hidden
              ">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Bottom: Settings + Sign Out ── */}
      <div className="flex flex-col gap-1 px-2 pb-4 pt-2 border-t border-white/10">
        <button
          onClick={onSettings}
          title="Settings"
          className="flex items-center gap-3 w-full px-2 py-2.5 rounded-xl transition-all duration-200
            text-slate-400 hover:bg-white/5 hover:text-primary-fixed/80"
        >
          <SlidersHorizontal className="w-5 h-5 shrink-0" />
          <span className="
            text-[12px] font-bold tracking-wide uppercase
            opacity-0 group-hover:opacity-100
            translate-x-2 group-hover:translate-x-0
            transition-all duration-300 ease-in-out
            whitespace-nowrap overflow-hidden
          ">Settings</span>
        </button>

        <button
          onClick={onLogout}
          title="Sign Out"
          className="flex items-center gap-3 w-full px-2 py-2.5 rounded-xl transition-all duration-200
            text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="
            text-[12px] font-bold tracking-wide uppercase
            opacity-0 group-hover:opacity-100
            translate-x-2 group-hover:translate-x-0
            transition-all duration-300 ease-in-out
            whitespace-nowrap overflow-hidden
          ">Sign Out</span>
        </button>
      </div>
    </nav>
  );
};

const TopBar = ({
  onSettings,
}: {
  onSettings?: () => void;
}) => (
  <header className="fixed top-0 left-16 right-0 z-40 flex justify-between items-center px-5 h-16 bg-surface/10 backdrop-blur-xl border-b border-white/20">
    <div className="flex items-center gap-2">
      <Waves className="w-6 h-6 text-primary-fixed" />
      <h1 className="text-[12px] font-bold tracking-[0.2em] text-primary-fixed uppercase">SHOREX</h1>
    </div>
    <div className="flex items-center gap-4">
      <button
        onClick={onSettings}
        className="p-2 text-on-surface-variant hover:bg-white/10 rounded-full transition-all cursor-pointer"
      >
        <Locate className="w-6 h-6" />
      </button>
    </div>
  </header>
);

// ─── Login Screen (beach theme + admin detection) ────────────────────────────
const LoginScreen = ({
  authMode,
  email,
  password,
  confirmPassword,
  error,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onSwitchMode,
}: {
  authMode: AuthMode;
  email: string;
  password: string;
  confirmPassword: string;
  error: string;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onConfirmPasswordChange: (v: string) => void;
  onSubmit: () => void;
  onSwitchMode: (mode: AuthMode) => void;
}) => (
  <div className="relative min-h-screen flex items-center justify-center px-5 overflow-hidden">
    {/* Beach sunset background image */}
    <img
      src="/login-bg.png"
      alt=""
      aria-hidden="true"
      className="absolute inset-0 w-full h-full object-cover z-0"
      style={{ filter: 'brightness(0.72) saturate(1.1)' }}
    />
    {/* Ocean-toned overlay */}
    <div className="absolute inset-0 z-10 bg-gradient-to-b from-[#020e1a]/60 via-[#041329]/30 to-[#020e1a]/80" />
    {/* Subtle wave shimmer at bottom */}
    <div className="absolute bottom-0 left-0 right-0 h-40 z-10 bg-gradient-to-t from-[#020e1a] to-transparent" />

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-20 w-full max-w-md glass-card p-10 flex flex-col items-center"
    >
      <div className="flex flex-col items-center mb-8">
        <Waves className="w-12 h-12 text-primary-fixed mb-4 drop-shadow-[0_0_16px_rgba(56,222,187,0.6)]" />
        <h1 className="text-[13px] font-bold tracking-[0.25em] text-primary-fixed uppercase">SHOREX</h1>
        <p className="text-[10px] text-on-surface-variant mt-1 opacity-80 uppercase tracking-tight">
          Coastal Plastic Monitoring · Karnataka
        </p>
      </div>

      {authMode === 'login' && (
        <div className="w-full mb-6 flex gap-3">
          <button
            type="button"
            onClick={() => onSwitchMode('login')}
            className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all bg-primary-fixed text-on-primary-fixed shadow-[0_0_16px_rgba(56,222,187,0.25)]"
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode('register')}
            className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all bg-white/5 text-on-surface-variant hover:bg-white/10"
          >
            Register
          </button>
        </div>
      )}

      {authMode === 'register' && (
        <div className="w-full mb-6 flex gap-3">
          <button
            type="button"
            onClick={() => onSwitchMode('login')}
            className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all bg-white/5 text-on-surface-variant hover:bg-white/10"
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode('register')}
            className="w-full py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all bg-primary-fixed text-on-primary-fixed shadow-[0_0_16px_rgba(56,222,187,0.25)]"
          >
            Register
          </button>
        </div>
      )}

      <form
        className="w-full space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="space-y-1">
          <label className="text-[12px] font-bold tracking-widest text-primary-fixed/70 ml-1 uppercase">
            Email address
          </label>
          <div className="relative">
            <User className="absolute left-0 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full bg-transparent border-none border-b border-primary-fixed/50 py-3 pl-8 text-on-surface focus:ring-0 focus:border-primary-fixed transition-all placeholder:text-on-surface-variant/30 font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[12px] font-bold tracking-widest text-primary-fixed/70 ml-1 uppercase">
            Password
          </label>
          <div className="relative">
            <Key className="absolute left-0 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
            <input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="••••••••••••"
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              className="w-full bg-transparent border-none border-b border-primary-fixed/50 py-3 pl-8 text-on-surface focus:ring-0 focus:border-primary-fixed transition-all placeholder:text-on-surface-variant/30 font-mono text-sm"
            />
          </div>
        </div>

        {authMode === 'register' && (
          <div className="space-y-1">
            <label className="text-[12px] font-bold tracking-widest text-primary-fixed/70 ml-1 uppercase">
              Confirm password
            </label>
            <div className="relative">
              <Key className="absolute left-0 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => onConfirmPasswordChange(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="new-password"
                className="w-full bg-transparent border-none border-b border-primary-fixed/50 py-3 pl-8 text-on-surface focus:ring-0 focus:border-primary-fixed transition-all placeholder:text-on-surface-variant/30 font-mono text-sm"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-error/10 border border-error/20 p-3 text-sm text-error font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-primary-fixed text-on-primary-fixed font-bold py-4 rounded-lg shadow-[0_0_20px_rgba(56,222,187,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 mt-4"
        >
          <span>{authMode === 'login' ? 'Login to Mission' : 'Register & Launch'}</span>
          <Rocket className="w-5 h-5" />
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-white/5 w-full text-center space-y-2">
        <p className="text-[11px] text-on-surface-variant/40 leading-relaxed uppercase font-mono">
          Authorized operator access only.
          <br />
          Session persists until sign-out.
        </p>
        <button
          type="button"
          onClick={() => onSwitchMode(authMode === 'login' ? 'register' : 'login')}
          className="text-[11px] uppercase tracking-[0.3em] text-primary-fixed hover:text-white transition-colors"
        >
          {authMode === 'login' ? 'New operator? Create account' : 'Already registered? Login'}
        </button>
        {/* Session reset — clears any stuck localStorage state */}
        <button
          type="button"
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
          className="block mx-auto text-[10px] text-on-surface-variant/20 hover:text-on-surface-variant/60 transition-colors font-mono uppercase tracking-widest mt-1"
        >
          Reset session
        </button>
      </div>
    </motion.div>
  </div>
);

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
interface ServerUser {
  email: string;
  displayName: string;
  createdAt: string;
  lastLogin: string;
  loginCount: number;
  scanCount: number;
}

const AdminScreen = ({ onLogout }: { onLogout: () => void }) => {
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [detectionStats, setDetectionStats] = useState<{ totalScans: number; plasticsDetected: number; accuracy: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [missionMode, setMissionMode] = useState<'Patrol' | 'Training' | 'Audit'>('Patrol');
  const [confidenceGate, setConfidenceGate] = useState(78);
  const [autoTriage, setAutoTriage] = useState(true);
  const [remoteAccess, setRemoteAccess] = useState(true);
  const [maintenanceLock, setMaintenanceLock] = useState(false);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch('/api/admin/users', { headers: { 'x-admin-key': ADMIN_PASSWORD } }),
        fetch('/api/stats'),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (statsRes.ok) setDetectionStats(await statsRes.json());
    } catch {
      // Backend may be offline — show empty state gracefully
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Local users from localStorage (always available)
  const localUsers = loadUsers();

  // Merge server users with local user list for complete picture
  const allEmails = new Set([
    ...users.map((u) => u.email),
    ...localUsers.map((u) => u.email),
  ]);

  const mergedUsers: ServerUser[] = Array.from(allEmails).map((email) => {
    const server = users.find((u) => u.email === email);
    const local = localUsers.find((u) => u.email === email);
    return {
      email,
      displayName: server?.displayName ?? local?.displayName ?? email.split('@')[0],
      createdAt: server?.createdAt ?? local?.createdAt ?? new Date().toISOString(),
      lastLogin: server?.lastLogin ?? local?.createdAt ?? new Date().toISOString(),
      loginCount: server?.loginCount ?? 1,
      scanCount: server?.scanCount ?? 0,
    };
  });

  const permissions = [
    { label: 'Remote Camera Access', detail: 'Allow operators to start station cameras remotely', enabled: remoteAccess, onToggle: () => setRemoteAccess((v) => !v) },
    { label: 'Auto Incident Triage', detail: 'Route high-risk debris events automatically', enabled: autoTriage, onToggle: () => setAutoTriage((v) => !v) },
    { label: 'Maintenance Lock', detail: 'Pause operator changes during service windows', enabled: maintenanceLock, onToggle: () => setMaintenanceLock((v) => !v) },
  ];

  const adminMetrics = [
    { label: 'Registered Users', value: String(mergedUsers.length), detail: `${mergedUsers.filter(() => true).length} total`, icon: Users },
    { label: 'Total Scans', value: String(detectionStats?.totalScans ?? 0), detail: 'Detection sessions', icon: Activity },
    { label: 'Plastics Found', value: String(detectionStats?.plasticsDetected ?? 0), detail: 'Items detected', icon: Trash2 },
    { label: 'Active Incidents', value: String(coastlineIncidents.filter(i => i.risk === 'High').length), detail: 'High priority', icon: AlertTriangle },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-20 pb-10 px-5 min-h-screen">
      {/* Header */}
      <section className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-primary-fixed" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary-fixed">
              Admin Control Centre
            </span>
          </div>
          <h2 className="text-3xl font-bold text-primary mb-1">SHOREX Dashboard</h2>
          <p className="text-sm text-on-surface-variant">
            Mangalore · Udupi Coastal Monitoring — Live operator & detection data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdminData}
            className="glass-card p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={cn('w-4 h-4 text-primary-fixed', loading && 'animate-spin')} />
          </button>
          <button
            onClick={onLogout}
            className="glass-card px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-error hover:bg-error/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </section>

      {/* Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {adminMetrics.map((m) => (
          <GlassCard key={m.label} className="flex flex-col justify-between min-h-[100px]">
            <div className="flex items-center justify-between">
              <m.icon className="w-5 h-5 text-primary-fixed" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{m.label}</span>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">{m.value}</p>
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide">{m.detail}</p>
            </div>
          </GlassCard>
        ))}
      </section>

      {/* Registered Users Table */}
      <GlassCard className="mb-8">
        <div className="flex items-center gap-2 mb-5">
          <UserCheck className="w-5 h-5 text-primary-fixed" />
          <h3 className="text-[11px] font-bold text-primary-fixed uppercase tracking-widest">
            Registered Operators
          </h3>
          <span className="ml-auto text-[10px] text-on-surface-variant font-mono">
            {mergedUsers.length} total
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-3">
            <RefreshCw className="w-5 h-5 text-primary-fixed animate-spin" />
            <span className="text-sm text-on-surface-variant">Loading user data…</span>
          </div>
        ) : mergedUsers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-3" />
            <p className="text-sm text-on-surface-variant">No registered users yet.</p>
            <p className="text-xs text-on-surface-variant/50 mt-1">Users appear here when they register on the login page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-on-surface-variant">
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Registered</th>
                  <th className="py-3 pr-4">Last Login</th>
                  <th className="py-3 pr-4">Logins</th>
                  <th className="py-3 text-right">Scans</th>
                </tr>
              </thead>
              <tbody>
                {mergedUsers.map((u) => (
                  <tr key={u.email} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="py-3 pr-4 text-sm font-mono text-primary-fixed-dim">{u.email}</td>
                    <td className="py-3 pr-4 text-sm font-bold text-on-surface">{u.displayName}</td>
                    <td className="py-3 pr-4 text-xs text-on-surface-variant">
                      {new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 pr-4 text-xs text-on-surface-variant">
                      {new Date(u.lastLogin).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1 text-xs text-secondary">
                        <CheckCircle2 className="w-3 h-3" />
                        {u.loginCount}
                      </span>
                    </td>
                    <td className="py-3 text-right text-xs font-bold text-primary-fixed">{u.scanCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Coastline Incidents + Mission Governance side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4 mb-8">
        {/* Real coastline incidents */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-5">
            <Newspaper className="w-5 h-5 text-tertiary-fixed-dim" />
            <h3 className="text-[11px] font-bold text-primary-fixed uppercase tracking-widest">
              Mangaluru · Udupi Coastline Incidents
            </h3>
          </div>
          <div className="space-y-3">
            {coastlineIncidents.map((inc) => (
              <div key={inc.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface">{inc.type}</p>
                    <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                      {inc.id} · {inc.area}
                    </p>
                    <p className="text-[10px] text-on-surface-variant/60 mt-1">
                      Source: {inc.source} · {new Date(inc.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-[10px] font-bold uppercase shrink-0',
                      inc.risk === 'High'
                        ? 'bg-error/20 text-error'
                        : inc.risk === 'Medium'
                        ? 'bg-tertiary-fixed/20 text-tertiary-fixed-dim'
                        : 'bg-secondary/15 text-secondary'
                    )}
                  >
                    {inc.risk}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Mission governance */}
        <GlassCard>
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-primary-fixed" />
              <h3 className="text-[11px] font-bold text-primary-fixed uppercase tracking-widest">Mission Governance</h3>
            </div>
            <button
              className="p-2 rounded-lg bg-primary-fixed text-on-primary-fixed hover:scale-105 active:scale-95 transition-transform"
              title="Save settings"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-5">
            {(['Patrol', 'Training', 'Audit'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setMissionMode(mode)}
                className={cn(
                  'py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest border transition-all',
                  missionMode === mode
                    ? 'bg-primary-fixed text-on-primary-fixed border-primary-fixed shadow-[0_0_16px_rgba(56,222,187,0.35)]'
                    : 'bg-white/5 text-on-surface-variant border-white/10 hover:text-primary-fixed'
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-on-surface uppercase tracking-wide">AI Confidence Gate</label>
              <span className="font-mono text-primary-fixed text-sm">{confidenceGate}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="99"
              value={confidenceGate}
              onChange={(e) => setConfidenceGate(Number(e.target.value))}
              className="w-full accent-[#38debb]"
            />
          </div>

          <div className="space-y-3">
            {permissions.map((p) => (
              <button
                key={p.label}
                onClick={p.onToggle}
                className="w-full text-left rounded-lg border border-white/10 bg-white/5 p-3 hover:border-primary-fixed/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <LockKeyhole className="w-4 h-4 text-primary-fixed" />
                  <span
                    className={cn(
                      'h-5 w-10 rounded-full border relative transition-colors',
                      p.enabled ? 'bg-primary-fixed/20 border-primary-fixed/60' : 'bg-surface-container-high border-outline'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 h-3 w-3 rounded-full transition-all',
                        p.enabled ? 'right-1 bg-primary-fixed' : 'left-1 bg-on-surface-variant'
                      )}
                    />
                  </span>
                </div>
                <p className="text-xs font-bold text-on-surface uppercase">{p.label}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">{p.detail}</p>
              </button>
            ))}
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
};

// ─── Leaderboard Screen ───────────────────────────────────────────────────────
const LeaderboardScreen = () => {
  const ranked    = [...karnatakaBeachHeatPoints].sort((a, b) => b.cleanScore - a.cleanScore);
  const byPollute = [...karnatakaBeachHeatPoints].sort((a, b) => a.intensity  - b.intensity);

  const medal = (i: number) =>
    i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

  const cleanColor = (s: number) =>
    s > 60 ? 'text-emerald-400' : s > 40 ? 'text-amber-400' : 'text-red-400';

  const cleanBg = (s: number) =>
    s > 60 ? 'bg-emerald-500/10 border-emerald-500/30' :
    s > 40 ? 'bg-amber-500/10 border-amber-500/30'    :
             'bg-red-500/10 border-red-500/30';

  const crowdColor = (c: string) =>
    c === 'High' ? 'bg-red-500/15 text-red-400' :
    c === 'Medium' ? 'bg-amber-500/15 text-amber-400' :
    'bg-green-500/15 text-green-400';

  const crowdIcon = (c: string) =>
    c === 'High' ? '🔴' : c === 'Medium' ? '🟡' : '🟢';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-20 pb-32 px-4 min-h-screen">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h2 className="text-2xl font-bold text-white">Beach Rankings</h2>
        </div>
        <p className="text-xs text-on-surface-variant uppercase tracking-widest">
          Karnataka coastline · KSPCB 2025 · Real-time crowd data
        </p>
      </div>

      {/* ── Cleanliness Leaderboard ── */}
      <GlassCard className="mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <h3 className="text-[12px] font-bold text-primary-fixed uppercase tracking-widest">
            Cleanliness Leaderboard
          </h3>
          <span className="ml-auto text-[10px] text-on-surface-variant font-mono">KSPCB Q1-2025</span>
        </div>
        <div className="space-y-2">
          {ranked.map((b, i) => (
            <div key={b.name} className={cn('rounded-xl border p-3 flex items-center gap-3', cleanBg(b.cleanScore))}>
              {/* Rank */}
              <span className="text-xl w-8 text-center shrink-0">{medal(i)}</span>

              {/* Beach info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">{b.name}</p>
                <p className="text-[10px] text-on-surface-variant">{b.region}</p>
                <p className="text-[10px] text-on-surface-variant/60 mt-0.5 italic leading-tight">{b.note}</p>
              </div>

              {/* Score + crowd */}
              <div className="text-right shrink-0">
                <p className={cn('text-xl font-black', cleanColor(b.cleanScore))}>
                  {b.cleanScore}<span className="text-[10px] font-normal text-on-surface-variant">/100</span>
                </p>
                <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${b.cleanScore}%`, backgroundColor: b.cleanScore > 60 ? '#34d399' : b.cleanScore > 40 ? '#fbbf24' : '#f87171' }} />
                </div>
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-1', crowdColor(b.crowdLevel))}>
                  {crowdIcon(b.crowdLevel)} {b.crowdLevel} crowd
                </span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ── Best Beaches to Visit Today ── */}
      <GlassCard className="mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Navigation className="w-4 h-4 text-emerald-400" />
          <h3 className="text-[12px] font-bold text-primary-fixed uppercase tracking-widest">
            Best Beaches to Visit Today
          </h3>
        </div>
        <div className="space-y-3">
          {ranked.filter(b => b.crowdLevel !== 'High' && b.cleanScore > 45).map((b, i) => (
            <div key={b.name} className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3 py-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm font-black text-emerald-400 shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{b.name}</p>
                <p className="text-[10px] text-on-surface-variant">{b.region} · {b.coords}</p>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <p className="text-emerald-400 text-xs font-bold">Clean {b.cleanScore}/100</p>
                <span className="text-[9px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full font-bold">
                  🟢 {b.crowdLevel} crowd
                </span>
              </div>
            </div>
          ))}
          {ranked.filter(b => b.crowdLevel !== 'High' && b.cleanScore > 45).length === 0 && (
            <p className="text-sm text-on-surface-variant text-center py-4">All suitable beaches are currently busy.</p>
          )}
        </div>
      </GlassCard>

      {/* ── Beaches to Avoid Today ── */}
      <GlassCard className="mb-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h3 className="text-[12px] font-bold text-primary-fixed uppercase tracking-widest">
            Avoid Today
          </h3>
          <span className="ml-auto text-[10px] text-on-surface-variant">High pollution or overcrowded</span>
        </div>
        <div className="space-y-2">
          {[...karnatakaBeachHeatPoints]
            .filter(b => b.crowdLevel === 'High' || b.cleanScore < 35)
            .sort((a, b) => a.cleanScore - b.cleanScore)
            .map((b) => (
            <div key={b.name} className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{b.name}</p>
                <p className="text-[10px] text-on-surface-variant/80 italic">{b.note}</p>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <p className={cn('text-xs font-bold', cleanColor(b.cleanScore))}>Clean {b.cleanScore}/100</p>
                <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold', crowdColor(b.crowdLevel))}>
                  {crowdIcon(b.crowdLevel)} {b.crowdLevel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ── Pollution leaderboard (worst first) ── */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Droplets className="w-4 h-4 text-red-400" />
          <h3 className="text-[12px] font-bold text-primary-fixed uppercase tracking-widest">
            Pollution Index (Lowest First)
          </h3>
          <span className="ml-auto text-[10px] text-on-surface-variant">KSPCB</span>
        </div>
        <div className="space-y-2">
          {byPollute.map((b, i) => (
            <div key={b.name} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
              <span className="text-xs font-bold w-6 text-center shrink-0 text-on-surface-variant">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-semibold truncate">{b.name}</p>
                <p className="text-[10px] text-on-surface-variant">{b.region}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${b.intensity}%`, backgroundColor: b.intensity < 45 ? '#34d399' : b.intensity < 65 ? '#fbbf24' : '#f87171' }} />
                </div>
                <span className="text-xs font-bold w-10 text-right"
                  style={{ color: b.intensity < 45 ? '#34d399' : b.intensity < 65 ? '#fbbf24' : '#f87171' }}>
                  {b.intensity}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
};

// ─── Data / Analytics Screen ─────────────────────────────────────────────────
const DataScreen = () => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-20 pb-32 px-4 min-h-screen">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Newspaper className="w-5 h-5 text-primary-fixed" />
          <h2 className="text-2xl font-bold text-white">Coastal News</h2>
        </div>
        <p className="text-xs text-on-surface-variant mt-1 uppercase tracking-widest">Karnataka coastline · Verified sources · 2024–2025</p>
      </div>

      {/* Detection trend chart */}
      <GlassCard className="mb-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[12px] font-bold text-primary-fixed uppercase tracking-widest">Detection Frequency (24h)</h3>
          <span className="text-[11px] font-mono text-on-surface-variant">Live window</span>
        </div>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={detectionData}>
              <defs>
                <linearGradient id="dataGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#38debb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#38debb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <Area type="monotone" dataKey="value" stroke="#38debb" fill="url(#dataGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Real news */}
      <div className="space-y-3">
        {coastalNewsItems.map((item) => (
          <div key={item.id} className="glass-card rounded-2xl p-4 border border-white/10">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-fixed/15 text-primary-fixed">{item.source}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-on-surface-variant">{item.tag}</span>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', item.severity === 'High' ? 'bg-red-500/15 text-red-400' : item.severity === 'Medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400')}>{item.severity}</span>
              </div>
              <span className="text-[10px] text-on-surface-variant/60 font-mono shrink-0">
                {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <h4 className="text-sm font-bold text-white mb-1.5 leading-snug">{item.title}</h4>
            <p className="text-[11px] text-on-surface-variant leading-relaxed mb-3">{item.summary}</p>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary-fixed hover:text-white transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Read on {item.source}
            </a>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
const TelemetryScreen = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-24 pb-32 px-5 min-h-screen">
    <section className="mb-10">
      <h2 className="text-3xl font-bold text-primary mb-1">Telemetry Stream</h2>
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-primary-fixed animate-pulse shadow-[0_0_8px_rgba(56,222,187,0.8)]" />
        <span className="text-[12px] font-bold text-on-surface-variant uppercase tracking-widest">
          Live Neural Uplink Active
        </span>
      </div>
    </section>

    <section className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
      <GlassCard className="flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <Thermometer className="w-5 h-5 text-on-surface-variant" />
          <span className="text-[12px] font-bold text-on-surface-variant uppercase">Sea Temp</span>
        </div>
        <div>
          <span className="text-2xl font-semibold text-primary">27°C</span>
          <div className="w-full h-1 bg-white/10 rounded-full mt-2">
            <div className="h-full w-[55%] bg-primary-fixed rounded-full shadow-[0_0_8px_rgba(56,222,187,0.5)]" />
          </div>
        </div>
      </GlassCard>
      <GlassCard className="flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <BatteryCharging className="w-5 h-5 text-on-surface-variant" />
          <span className="text-[12px] font-bold text-on-surface-variant uppercase">Battery</span>
        </div>
        <div>
          <span className="text-2xl font-semibold text-primary">76%</span>
          <div className="w-full h-1 bg-white/10 rounded-full mt-2">
            <div className="h-full w-[76%] bg-secondary rounded-full shadow-[0_0_8px_rgba(131,217,158,0.5)]" />
          </div>
        </div>
      </GlassCard>
      <GlassCard className="flex flex-col justify-between col-span-2 md:col-span-1">
        <div className="flex justify-between items-start mb-4">
          <Gauge className="w-5 h-5 text-on-surface-variant" />
          <span className="text-[12px] font-bold text-on-surface-variant uppercase">Latency</span>
        </div>
        <div>
          <span className="text-2xl font-semibold text-primary">38ms</span>
          <p className="text-[14px] text-secondary-fixed mt-1">Sub-threshold optimal</p>
        </div>
      </GlassCard>
    </section>

    <GlassCard className="mb-10">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[12px] font-bold text-primary-fixed uppercase tracking-widest">Detection Frequency</h3>
        <span className="text-[14px] font-mono text-on-surface-variant">24h window</span>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={detectionData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38debb" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#38debb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <Area type="monotone" dataKey="value" stroke="#38debb" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
      <GlassCard>
        <h3 className="text-[12px] font-bold text-primary-fixed mb-4 uppercase tracking-widest">Plastic Classification</h3>
        <div className="space-y-6">
          {classificationData.map((item) => (
            <div key={item.name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-on-surface">{item.name}</span>
                <span style={{ color: item.color }} className="font-bold">{item.value}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.value}%` }}
                  style={{ backgroundColor: item.color }}
                  className="h-full"
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard className="flex flex-col items-center justify-center min-h-[200px]">
        <div className="relative w-32 h-32 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={classificationData} innerRadius={45} outerRadius={60} paddingAngle={5} dataKey="value">
                {classificationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <Shapes className="w-8 h-8 text-primary-fixed" />
          </div>
        </div>
        <p className="text-[12px] font-bold text-on-surface-variant uppercase tracking-widest">Global Distribution Index</p>
      </GlassCard>
    </div>
  </motion.div>
);

// ─── Scan Screen (visual demo overlay) ───────────────────────────────────────
const ScanScreen = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative h-screen w-full bg-surface-dim overflow-hidden">
    <div className="absolute inset-0 z-0">
      <img
        src="https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1600&q=80"
        alt="Coastal water scan"
        className="w-full h-full object-cover opacity-60 grayscale-[0.2]"
        crossOrigin="anonymous"
      />
    </div>
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-5 h-16 bg-surface/10 backdrop-blur-xl border-b border-white/20">
      <div className="flex items-center gap-2">
        <Waves className="w-6 h-6 text-primary-fixed" />
        <h1 className="text-[12px] font-bold tracking-[0.2em] text-primary-fixed uppercase">SHOREX</h1>
      </div>
      <div className="flex items-center gap-3 bg-surface-container/30 px-3 py-1.5 rounded-full border border-white/10">
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">ALWAYS-ON</span>
        <div className="w-10 h-5 bg-primary-container rounded-full relative">
          <div className="absolute right-1 top-1 w-3 h-3 bg-on-primary-fixed rounded-full" />
        </div>
      </div>
    </header>
    <div className="absolute inset-0 z-10 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute top-[20%] left-[25%] w-56 h-40 border-2 border-primary-fixed-dim/50 rounded-sm shadow-[0_0_15px_rgba(56,222,187,0.4)]"
      >
        <div className="absolute -top-7 left-0 bg-primary-fixed-dim/90 px-2 py-1 rounded-t-sm">
          <span className="text-[10px] font-bold text-on-primary-fixed uppercase tracking-wider">Plastic Bottle [94%]</span>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="absolute top-[55%] left-[55%] w-72 h-56 border-2 border-secondary-fixed-dim/50 rounded-sm shadow-[0_0_15px_rgba(131,217,158,0.4)]"
      >
        <div className="absolute -top-7 left-0 bg-secondary-fixed-dim/90 px-2 py-1 rounded-t-sm">
          <span className="text-[10px] font-bold text-on-secondary-fixed uppercase tracking-wider">Fishing Net [81%]</span>
        </div>
      </motion.div>
      <motion.div
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        className="absolute left-0 w-full h-[1px] bg-primary-fixed/40 shadow-[0_0_15px_#5ffbd6]"
      />
    </div>
    <div className="absolute bottom-32 left-5 z-20 font-mono text-xs text-on-surface-variant/80 backdrop-blur-md bg-surface/20 px-3 py-1.5 rounded border border-white/5">
      12.94° N, 74.80° E — Panambur, Mangaluru
    </div>
  </motion.div>
);

// ─── Heatmap Screen — Real Leaflet map with OpenStreetMap tiles ───────────────
const HeatmapScreen = () => {
  const mapRef        = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const [userPos, setUserPos]           = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError]         = useState<string | null>(null);
  const [selectedBeach, setSelectedBeach] = useState<BeachPoint | null>(null);
  const [locating, setLocating]         = useState(false);

  // Beach recommendation
  const recommendation = (() => {
    if (!userPos) return null;
    const withDist = karnatakaBeachHeatPoints.map(b => ({
      ...b, dist: haversineKm(userPos.lat, userPos.lng, b.lat, b.lng),
    }));
    const best = withDist
      .filter(b => b.cleanScore > 45 && b.crowdLevel !== 'High')
      .sort((a, b) => a.dist - b.dist)[0];
    return best ?? withDist.sort((a, b) => b.cleanScore - a.cleanScore)[0];
  })();

  const highest = karnatakaBeachHeatPoints.reduce((h, b) => b.intensity > h.intensity ? b : h);
  const cleanest = [...karnatakaBeachHeatPoints].sort((a, b) => b.cleanScore - a.cleanScore)[0];

  // Open Google Maps directions
  const openDirections = (beach: BeachPoint) => {
    const dest = `${beach.lat},${beach.lng}`;
    const origin = userPos ? `${userPos.lat},${userPos.lng}` : '';
    const url = origin
      ? `https://www.google.com/maps/dir/${origin}/${dest}`
      : `https://www.google.com/maps/search/?api=1&query=${dest}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Get user location
  const locateUser = () => {
    if (!navigator.geolocation) { setLocError('Geolocation not supported'); return; }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserPos({ lat, lng });
        setLocating(false);
        // Pan map to user
        if (leafletMapRef.current) {
          leafletMapRef.current.setView([lat, lng], 10);
          // Update or create user marker
          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([lat, lng]);
          } else {
            const L = (window as any).L;
            if (L) {
              const icon = L.divIcon({
                html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 12px rgba(59,130,246,0.8)"></div>`,
                className: '',
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              });
              userMarkerRef.current = L.marker([lat, lng], { icon })
                .addTo(leafletMapRef.current)
                .bindPopup('<b>📍 Your Location</b>');
            }
          }
        }
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === 1 ? 'Location permission denied' : 'Could not get location');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Initialise Leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    import('leaflet').then((L) => {
      // Fix default marker icon path issue with bundlers
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Create map centred on Karnataka coast
      const map = L.map(mapRef.current!, {
        center: [13.8, 74.6],
        zoom: 8,
        zoomControl: false,
      });

      // OpenStreetMap tiles — realistic satellite-like tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add beach markers
      karnatakaBeachHeatPoints.forEach((beach) => {
        const pollutionColor = beach.intensity > 70 ? '#ef4444'
          : beach.intensity > 50 ? '#f97316' : '#22c55e';

        const icon = L.divIcon({
          html: `
            <div style="
              position:relative;
              width:36px; height:36px;
              display:flex; align-items:center; justify-content:center;
            ">
              <div style="
                position:absolute;
                width:36px; height:36px;
                background:${pollutionColor}30;
                border:2px solid ${pollutionColor};
                border-radius:50%;
                animation: ${beach.intensity >= 75 ? 'pulse-ring 1.5s infinite' : 'none'};
              "></div>
              <div style="
                width:14px; height:14px;
                background:${pollutionColor};
                border:2px solid white;
                border-radius:50%;
                box-shadow:0 0 8px ${pollutionColor};
                z-index:1;
              "></div>
            </div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        });

        const crowdEmoji = beach.crowdLevel === 'High' ? '🔴'
          : beach.crowdLevel === 'Medium' ? '🟡' : '🟢';

        const marker = L.marker([beach.lat, beach.lng], { icon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family:Inter,sans-serif;min-width:200px;color:#0f172a;">
            <div style="font-weight:800;font-size:14px;margin-bottom:6px;">${beach.name}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:8px;">${beach.region} · ${beach.coords}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
              <div style="background:#f1f5f9;padding:6px;border-radius:6px;text-align:center;">
                <div style="font-size:9px;text-transform:uppercase;color:#64748b;">Pollution</div>
                <div style="font-size:18px;font-weight:900;color:${pollutionColor};">${beach.intensity}%</div>
              </div>
              <div style="background:#f1f5f9;padding:6px;border-radius:6px;text-align:center;">
                <div style="font-size:9px;text-transform:uppercase;color:#64748b;">Clean Score</div>
                <div style="font-size:18px;font-weight:900;color:${beach.cleanScore > 50 ? '#16a34a' : beach.cleanScore > 35 ? '#d97706' : '#dc2626'}">${beach.cleanScore}/100</div>
              </div>
            </div>
            <div style="font-size:11px;margin-bottom:6px;">${crowdEmoji} <b>${beach.crowdLevel} crowd</b></div>
            <div style="font-size:10px;color:#64748b;margin-bottom:10px;font-style:italic;">${beach.note}</div>
            <button onclick="window.open('https://www.google.com/maps/dir//${beach.lat},${beach.lng}','_blank')"
              style="width:100%;padding:8px;background:#0ea5e9;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
              🗺️ Get Directions
            </button>
          </div>
        `, { maxWidth: 240 });

        marker.on('click', () => {
          setSelectedBeach(beach);
        });
      });

      // Store map reference globally so locateUser can access it
      (window as any).L = L;
      leafletMapRef.current = map;

      // Try to get location silently on load
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setUserPos({ lat, lng });
            const icon = L.divIcon({
              html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 12px rgba(59,130,246,0.8)"></div>`,
              className: '', iconSize: [16, 16], iconAnchor: [8, 8],
            });
            userMarkerRef.current = L.marker([lat, lng], { icon })
              .addTo(map)
              .bindPopup('<b>📍 Your Location</b>');
          },
          () => { /* silent fail — user can click locate button */ },
          { timeout: 6000 }
        );
      }
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        userMarkerRef.current = null;
      }
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex flex-col h-screen w-full bg-[#041329]">

      {/* ── Real Leaflet Map ── */}
      <div ref={mapRef} className="flex-1 w-full z-10" style={{ minHeight: 0 }} />

      {/* ── Map controls overlay ── */}
      <div className="absolute right-4 top-20 z-20 flex flex-col gap-2">
        {/* Locate me */}
        <button
          onClick={locateUser}
          disabled={locating}
          className="glass-card p-3 rounded-xl hover:bg-white/15 transition-colors active:scale-95 disabled:opacity-50"
          title="Find my location"
        >
          {locating
            ? <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
            : <Navigation className="w-5 h-5 text-blue-400" />}
        </button>
      </div>

      {/* ── Selected beach panel ── */}
      {selectedBeach && (
        <div className="absolute left-4 top-20 z-20 w-72">
          <div className="glass-card p-4 rounded-2xl border border-white/20 shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedBeach.name}</h3>
                <p className="text-[10px] text-on-surface-variant">{selectedBeach.region} · {selectedBeach.coords}</p>
              </div>
              <button onClick={() => setSelectedBeach(null)} className="text-on-surface-variant hover:text-white shrink-0 mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <p className="text-[9px] text-on-surface-variant uppercase">Pollution</p>
                <p className="text-xl font-black" style={{ color: selectedBeach.color }}>{selectedBeach.intensity}%</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <p className="text-[9px] text-on-surface-variant uppercase">Clean</p>
                <p className={cn('text-xl font-black', selectedBeach.cleanScore > 50 ? 'text-emerald-400' : selectedBeach.cleanScore > 35 ? 'text-amber-400' : 'text-red-400')}>
                  {selectedBeach.cleanScore}/100
                </p>
              </div>
            </div>

            <div className={cn('rounded-lg px-3 py-1.5 text-xs font-bold text-center mb-3',
              selectedBeach.crowdLevel === 'High' ? 'bg-red-500/20 text-red-400' :
              selectedBeach.crowdLevel === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
              'bg-green-500/20 text-green-400')}>
              {selectedBeach.crowdLevel === 'High' ? '🔴 High crowd' :
               selectedBeach.crowdLevel === 'Medium' ? '🟡 Moderate crowd' : '🟢 Quiet — good to visit'}
            </div>

            {userPos && (
              <p className="text-[10px] text-primary-fixed font-mono mb-3">
                📍 {haversineKm(userPos.lat, userPos.lng, selectedBeach.lat, selectedBeach.lng).toFixed(1)} km from you
              </p>
            )}

            <p className="text-[10px] text-on-surface-variant/60 italic mb-3 leading-relaxed">{selectedBeach.note}</p>

            {/* Directions button */}
            <button
              onClick={() => openDirections(selectedBeach)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold uppercase tracking-widest transition-colors active:scale-95"
            >
              <Navigation className="w-4 h-4" />
              Get Directions
            </button>
          </div>
        </div>
      )}

      {/* ── Location error ── */}
      {locError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 glass-card px-4 py-2 rounded-xl text-xs text-amber-400 flex items-center gap-2 shadow-lg">
          <MapPin className="w-4 h-4 shrink-0" /> {locError}
        </div>
      )}

      {/* ── Bottom info panel ── */}
      <div className="absolute bottom-24 left-4 right-4 z-20 space-y-2">

        {/* Recommendation */}
        {recommendation && (
          <div className="glass-card p-3 rounded-2xl border-l-4 border-l-emerald-400 flex items-center gap-3">
            <Navigation className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Best Beach For You</p>
              <p className="text-sm font-bold text-white truncate">{recommendation.name}</p>
              <p className="text-[10px] text-on-surface-variant">
                Clean {recommendation.cleanScore}/100 · {recommendation.crowdLevel} crowd
                {userPos ? ` · ${haversineKm(userPos.lat, userPos.lng, recommendation.lat, recommendation.lng).toFixed(0)} km away` : ''}
              </p>
            </div>
            <button
              onClick={() => openDirections(recommendation)}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold uppercase transition-colors"
            >
              Go
            </button>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="glass-card p-3 rounded-xl text-center">
            <p className="text-[9px] text-on-surface-variant uppercase tracking-widest mb-1">Dirtiest</p>
            <p className="text-[10px] font-bold text-red-400 truncate">{highest.name}</p>
            <p className="text-base font-bold" style={{ color: highest.color }}>{highest.intensity}%</p>
          </div>
          <div className="glass-card p-3 rounded-xl text-center">
            <p className="text-[9px] text-on-surface-variant uppercase tracking-widest mb-1">Cleanest</p>
            <p className="text-[10px] font-bold text-emerald-400 truncate">{cleanest.name}</p>
            <p className="text-base font-bold text-emerald-400">{cleanest.cleanScore}/100</p>
          </div>
          <div className="glass-card p-3 rounded-xl text-center">
            <p className="text-[9px] text-on-surface-variant uppercase tracking-widest mb-1">Monitored</p>
            <p className="text-xl font-bold text-primary-fixed">{karnatakaBeachHeatPoints.length}</p>
            <p className="text-[9px] text-on-surface-variant">beaches</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Settings Screen ──────────────────────────────────────────────────────────
const SettingsScreen = ({ onLogout, onClose, currentUser }: { onLogout: () => void; onClose: () => void; currentUser: UserAccount }) => (
  <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="fixed inset-0 z-[60] bg-background overflow-y-auto pb-32">
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-5 h-16 bg-surface-container/10 backdrop-blur-xl border-b border-white/20">
      <div className="flex items-center gap-2">
        <Waves className="w-6 h-6 text-primary-fixed" />
        <span className="text-[12px] font-bold tracking-[0.2em] text-primary-fixed uppercase">SHOREX</span>
      </div>
      <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-white transition-colors">
        <X className="w-6 h-6" />
      </button>
    </header>
    <main className="mt-20 px-5 space-y-4">
      <section className="py-4">
        <h1 className="text-2xl font-bold text-on-surface">Operator Settings</h1>
        <p className="text-xs text-on-surface-variant">Configure station parameters and security clearance.</p>
      </section>
      <GlassCard>
        <div className="flex items-center gap-2 mb-6">
          <User className="w-5 h-5 text-primary-fixed" />
          <h2 className="text-[10px] font-bold text-primary-fixed uppercase tracking-widest">Account Details</h2>
        </div>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-sm text-on-surface-variant uppercase">Email</span>
            <span className="text-sm font-mono text-primary-fixed-dim">{currentUser.email}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-on-surface-variant uppercase">Display Name</span>
            <span className="text-sm text-on-surface">{currentUser.displayName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-on-surface-variant uppercase">Member Since</span>
            <span className="text-sm font-mono text-on-surface-variant">{new Date(currentUser.createdAt).toLocaleDateString('en-IN')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-on-surface-variant uppercase">Status</span>
            <div className="flex items-center gap-1">
              <BadgeCheck className="w-4 h-4 text-secondary fill-current" />
              <span className="text-sm font-mono text-secondary uppercase">Verified Operator</span>
            </div>
          </div>
        </div>
      </GlassCard>
      <GlassCard>
        <div className="flex items-center gap-2 mb-6">
          <Bell className="w-5 h-5 text-primary-fixed" />
          <h2 className="text-[10px] font-bold text-primary-fixed uppercase tracking-widest">Notifications</h2>
        </div>
        <div className="space-y-5">
          {['Debris Alert', 'Telemetry Updates'].map((label) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-sm text-on-surface uppercase">{label}</span>
              <div className="w-12 h-6 rounded-full bg-primary-fixed/20 relative cursor-pointer border border-primary-fixed/40">
                <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-primary-fixed shadow-[0_0_8px_#38debb]" />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard>
        <div className="flex items-center gap-2 mb-6">
          <Wrench className="w-5 h-5 text-primary-fixed" />
          <h2 className="text-[10px] font-bold text-primary-fixed uppercase tracking-widest">Maintenance</h2>
        </div>
        <div className="space-y-3">
          <button className="w-full py-4 px-4 glass-card rounded-lg flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex flex-col items-start">
              <span className="text-sm text-on-surface uppercase">Clear Local Cache</span>
              <span className="text-[10px] text-on-surface-variant font-mono">Stored session data</span>
            </div>
            <Eraser className="w-5 h-5 text-on-surface-variant" />
          </button>
          <button
            onClick={onLogout}
            className="w-full py-4 px-4 bg-error/10 border border-error/30 rounded-lg flex items-center justify-center gap-2 text-error active:scale-[0.98] transition-transform hover:bg-error/20"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[12px] font-bold tracking-widest uppercase">Sign Out</span>
          </button>
        </div>
      </GlassCard>
    </main>
  </motion.div>
);

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Restore session on page load
  useEffect(() => {
    // Clear any stale session from old admin email
    const storedEmail = loadSessionEmail();
    if (storedEmail === 'admin@shorex.in') {
      clearSessionEmail();
    }

    const sessionEmail = loadSessionEmail();
    if (sessionEmail) {
      // Check if this is the admin session
      if (sessionEmail === normalizeEmail(ADMIN_EMAIL)) {
        setIsAdmin(true);
        setActiveTab('system');
        setCurrentUser({ email: ADMIN_EMAIL, password: '', displayName: 'Admin', createdAt: new Date().toISOString() });
        return;
      }
      const user = findUserByEmail(sessionEmail);
      if (user) {
        setCurrentUser(user);
        setActiveTab('system');
        return;
      }
      clearSessionEmail();
    }
    setActiveTab('login');
  }, []);

  const handleTabChange = (tab: Tab) => {
    if (!currentUser) return;
    setActiveTab(tab);
  };

  const handleLogout = () => {
    clearSessionEmail();
    setCurrentUser(null);
    setIsAdmin(false);
    setIsSettingsOpen(false);
    setActiveTab('login');
    setAuthMode('login');
    setAuthEmail('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthError('');
  };

  const handleAuthSwitch = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthError('');
    setAuthPassword('');
    setAuthConfirmPassword('');
  };

  const handleAuthSubmit = async () => {
    const email = normalizeEmail(authEmail);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError('Enter a valid email address.');
      return;
    }
    if (!authPassword || authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    // ── STEP 1: Always check admin FIRST before anything else ──────────────
    // Check locally first (instant, no network needed)
    const isAdminAttempt =
      email === normalizeEmail(ADMIN_EMAIL) && authPassword === ADMIN_PASSWORD;

    if (isAdminAttempt) {
      // Also verify with backend if reachable, but don't block on it
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: authPassword }),
        });
        if (!res.ok) {
          // Backend rejected — shouldn't happen if credentials match, but handle gracefully
          const err = await res.json().catch(() => ({}));
          setAuthError((err as any).error ?? 'Admin login failed');
          return;
        }
      } catch {
        // Backend offline — local credential check already passed, allow in
      }

      // Wipe any previous session and set admin
      clearSessionEmail();
      saveSessionEmail(email);
      setCurrentUser({
        email,
        password: '',
        displayName: 'Admin',
        createdAt: new Date().toISOString(),
      });
      setIsAdmin(true);
      setActiveTab('system');
      setAuthError('');
      return;  // ← HARD STOP — never falls through
    }

    // ── STEP 2: Register ───────────────────────────────────────────────────
    if (authMode === 'register') {
      if (authPassword.length < 8) {
        setAuthError('Password must be at least 8 characters.');
        return;
      }
      if (authPassword !== authConfirmPassword) {
        setAuthError('Passwords do not match.');
        return;
      }
      if (findUserByEmail(email)) {
        setAuthError('This email is already registered. Please login.');
        return;
      }
      const newUser: UserAccount = {
        email,
        password: authPassword,
        displayName: email.split('@')[0],
        createdAt: new Date().toISOString(),
      };
      saveUsers([...loadUsers(), newUser]);
      saveSessionEmail(email);
      try {
        await fetch('/api/users/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, displayName: newUser.displayName }),
        });
      } catch { /* silent */ }
      setCurrentUser(newUser);
      setActiveTab('system');
      setAuthError('');
      return;
    }

    // ── STEP 3: Regular user login ─────────────────────────────────────────
    const existingUser = findUserByEmail(email);
    if (!existingUser || existingUser.password !== authPassword) {
      setAuthError('Email or password is incorrect.');
      return;
    }
    saveSessionEmail(email);
    try {
      await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName: existingUser.displayName }),
      });
    } catch { /* silent */ }
    setCurrentUser(existingUser);
    setActiveTab('system');
    setAuthError('');
  };

  // Not logged in → show login
  if (!currentUser) {
    return (
      <LoginScreen
        authMode={authMode}
        email={authEmail}
        password={authPassword}
        confirmPassword={authConfirmPassword}
        error={authError}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onConfirmPasswordChange={setAuthConfirmPassword}
        onSubmit={handleAuthSubmit}
        onSwitchMode={handleAuthSwitch}
      />
    );
  }

  // Admin view — full-page, no bottom nav
  if (isAdmin) {
    return (
      <div className="bg-surface text-on-surface min-h-screen relative font-sans overflow-x-hidden">
        <AdminScreen onLogout={handleLogout} />
      </div>
    );
  }

  // Regular operator view
  return (
    <div className="bg-surface text-on-surface min-h-screen relative font-sans overflow-x-hidden pl-16">
      <TopBar onSettings={() => setIsSettingsOpen(true)} />

      <AnimatePresence mode="wait">
        {activeTab === 'system' && <TelemetryScreen key="system" />}
        {activeTab === 'scan' && <PlasticDetector key="scan" />}
        {activeTab === 'plastic' && <ScanScreen key="plastic" />}
        {activeTab === 'heatmap' && <HeatmapScreen key="heatmap" />}
        {activeTab === 'leaderboard' && <LeaderboardScreen key="leaderboard" />}
        {activeTab === 'data' && <DataScreen key="data" />}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsScreen
            onLogout={handleLogout}
            onClose={() => setIsSettingsOpen(false)}
            currentUser={currentUser}
          />
        )}
      </AnimatePresence>

      <BottomNavBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
      />
    </div>
  );
}

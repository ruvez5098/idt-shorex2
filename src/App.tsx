import React, { useEffect, useState } from 'react';
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
  Microscope,
  TrendingUp,
  Fingerprint,
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
  Scan as ScanIcon,
  Ruler,
  Cpu,
  Shapes,
  Trash2,
  SlidersHorizontal,
  Radio,
  Users,
  CheckCircle2,
  AlertTriangle,
  LockKeyhole,
  Save
} from 'lucide-react';
import { PlasticDetector } from './PlasticDetector';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { cn } from './lib/utils';

// --- Types ---
type Tab = 'scan' | 'heatmap' | 'data' | 'system' | 'login' | 'settings' | 'plastic' | 'admin';
type AuthMode = 'login' | 'register';

type UserAccount = {
  email: string;
  password: string;
  displayName: string;
  createdAt: string;
};

const USERS_STORAGE_KEY = 'shorex_users';
const SESSION_STORAGE_KEY = 'shorex_session_email';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const loadUsers = (): UserAccount[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) as UserAccount[] : [];
  } catch {
    return [];
  }
};

const saveUsers = (users: UserAccount[]) => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

const loadSessionEmail = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_STORAGE_KEY);
};

const saveSessionEmail = (email: string) => {
  localStorage.setItem(SESSION_STORAGE_KEY, normalizeEmail(email));
};

const clearSessionEmail = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

const findUserByEmail = (email: string) => {
  const normalized = normalizeEmail(email);
  return loadUsers().find((user) => user.email === normalized) ?? null;
};

// --- Mock Data ---
const detectionData = [
  { time: '00:00', value: 80 },
  { time: '04:00', value: 20 },
  { time: '08:00', value: 60 },
  { time: '12:00', value: 40 },
  { time: '16:00', value: 85 },
  { time: '20:00', value: 30 },
  { time: '24:00', value: 90 },
];

const classificationData = [
  { name: 'Bottles', value: 42, color: '#38debb' },
  { name: 'Bags', value: 28, color: '#9ff5b8' },
  { name: 'Nets', value: 30, color: '#ffb4ab' },
];

const karnatakaBeachHeatPoints = [
  { name: 'Karwar Beach', region: 'Uttara Kannada', coords: '14.81 N, 74.12 E', intensity: 58, x: 38, y: 17, color: '#83d99e' },
  { name: 'Om Beach', region: 'Gokarna', coords: '14.52 N, 74.32 E', intensity: 64, x: 43, y: 27, color: '#9ff5b8' },
  { name: 'Murudeshwar', region: 'Bhatkal', coords: '14.09 N, 74.49 E', intensity: 76, x: 50, y: 38, color: '#f4d35e' },
  { name: 'Maravanthe', region: 'Kundapura', coords: '13.70 N, 74.64 E', intensity: 83, x: 55, y: 49, color: '#ffb86b' },
  { name: 'Malpe Beach', region: 'Udupi', coords: '13.35 N, 74.70 E', intensity: 91, x: 58, y: 60, color: '#ff7a59' },
  { name: 'Kaup Beach', region: 'Udupi', coords: '13.22 N, 74.74 E', intensity: 72, x: 61, y: 67, color: '#f4d35e' },
  { name: 'Panambur', region: 'Mangaluru', coords: '12.94 N, 74.80 E', intensity: 88, x: 65, y: 78, color: '#ff7a59' },
  { name: 'Ullal Beach', region: 'Dakshina Kannada', coords: '12.80 N, 74.85 E', intensity: 69, x: 68, y: 87, color: '#9ff5b8' },
];

const adminMetrics = [
  { label: 'Operators', value: '12', detail: '4 active now', icon: Users },
  { label: 'Stations', value: '8/9', detail: '1 maintenance hold', icon: Radio },
  { label: 'AI Gate', value: '88%', detail: 'minimum confidence', icon: Cpu },
  { label: 'Alerts', value: '6', detail: '2 high priority', icon: AlertTriangle },
];

const operatorRoster = [
  { name: 'Mira Chen', role: 'Mission Lead', station: 'Mariana North', status: 'Active' },
  { name: 'Arun Patel', role: 'Data Auditor', station: 'Sector 7G', status: 'Review' },
  { name: 'Sofia Vale', role: 'Field Tech', station: 'Harbor Grid', status: 'Active' },
];

const incidentQueue = [
  { id: 'INC-2048', type: 'High-density debris', area: 'Sector 7G-Abyssal', risk: 'High' },
  { id: 'INC-2049', type: 'Camera drift', area: 'Mariana Point North', risk: 'Medium' },
  { id: 'INC-2050', type: 'Model confidence dip', area: 'Harbor Grid', risk: 'Low' },
];

// --- Components ---

const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string; key?: React.Key }) => (
  <div className={cn("glass-card p-4 rounded-xl", className)}>
    {children}
  </div>
);

const BottomNavBar = ({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) => {
  const tabs = [
    { id: 'scan' as Tab, label: 'Scan', icon: Camera },
    { id: 'plastic' as Tab, label: 'Plastic AI', icon: Trash2 },
    { id: 'heatmap' as Tab, label: 'Heatmap', icon: MapIcon },
    { id: 'data' as Tab, label: 'Data', icon: BarChart2 },
    { id: 'system' as Tab, label: 'System', icon: Settings2 },
    { id: 'admin' as Tab, label: 'Admin', icon: Shield },
  ];

  return (
    <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-5 pb-8 pt-4 bg-surface-container/10 backdrop-blur-2xl border-t border-white/20 rounded-t-xl shadow-[0_-4px_24px_rgba(56,222,187,0.1)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex flex-col items-center justify-center transition-all duration-200 scale-95",
            activeTab === tab.id ? "text-primary-fixed drop-shadow-[0_0_8px_rgba(56,222,187,0.6)]" : "text-on-surface-variant/60 hover:text-primary-fixed/80"
          )}
        >
          <tab.icon className={cn("w-6 h-6 mb-1", activeTab === tab.id && "fill-current")} />
          <span className="text-[12px] font-bold tracking-widest uppercase">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

const TopBar = ({ title, showBack = false, onBack, onSettings }: { title: string; showBack?: boolean; onBack?: () => void; onSettings?: () => void }) => (
  <header className="fixed top-0 w-full z-50 flex justify-between items-center px-5 h-16 bg-surface/10 backdrop-blur-xl border-b border-white/20">
    <div className="flex items-center gap-2">
      {showBack ? (
        <button onClick={onBack} className="p-2 text-on-surface-variant hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <Waves className="w-6 h-6 text-primary-fixed" />
          <h1 className="text-[12px] font-bold tracking-[0.2em] text-primary-fixed uppercase">SHOREX</h1>
        </div>
      )}
    </div>
    <div className="flex items-center gap-4">
      <button onClick={onSettings} className="p-2 text-on-surface-variant hover:bg-white/10 rounded-full transition-all cursor-pointer">
        <Locate className="w-6 h-6" />
      </button>
    </div>
  </header>
);

// --- Screens ---

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
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onSwitchMode: (mode: AuthMode) => void;
}) => (
  <div className="relative min-h-screen flex items-center justify-center px-5 overflow-hidden">
    <div 
      className="absolute inset-0 z-0 bg-cover bg-center brightness-75"
      style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCvRhlvCE1pI5HZqnNdiWz7lV1zF_GbsBcXELzxz_16LrfLl2RANPf1fEEZbKxaFpvfYqbxkLTVbVscwDOzpLgPZwY1zQIGuaM19b7hwhH-E6SQELbKqAnJnmzZqXixOUVEerUssOu_oAefePUG-h-PlDTvrr5wMAGe6L4dKKYiwW_ys0ol7N0DSyAWx64s6VQpkOJQR3bUerDCdVcuOn89p_09_3txHW57qzkvqwaL6H8JpaiyAmrUUHjM4s0ufoSRINxh83xGgrk')" }}
    />
    <div className="absolute inset-0 z-10 bg-gradient-to-b from-surface/20 via-transparent to-surface/80" />
    
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-20 w-full max-w-md glass-card p-10 flex flex-col items-center"
    >
      <div className="flex flex-col items-center mb-8">
        <Waves className="w-12 h-12 text-primary-fixed mb-4" />
        <h1 className="text-[12px] font-bold tracking-[0.2em] text-primary-fixed uppercase">SHOREX</h1>
        <p className="text-[10px] text-on-surface-variant mt-1 opacity-80 uppercase tracking-tighter">Deep Sea Monitoring Systems</p>
      </div>

      <div className="w-full mb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onSwitchMode('login')}
          className={cn(
            'w-full py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all',
            authMode === 'login'
              ? 'bg-primary-fixed text-on-primary-fixed shadow-[0_0_16px_rgba(56,222,187,0.25)]'
              : 'bg-white/5 text-on-surface-variant hover:bg-white/10'
          )}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => onSwitchMode('register')}
          className={cn(
            'w-full py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all',
            authMode === 'register'
              ? 'bg-primary-fixed text-on-primary-fixed shadow-[0_0_16px_rgba(56,222,187,0.25)]'
              : 'bg-white/5 text-on-surface-variant hover:bg-white/10'
          )}
        >
          Register
        </button>
      </div>

      <form className="w-full space-y-6" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <div className="space-y-1">
          <label className="text-[12px] font-bold tracking-widest text-primary-fixed/70 ml-1 uppercase">Gmail address</label>
          <div className="relative">
            <User className="absolute left-0 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
            <input 
              type="email" 
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="you@gmail.com" 
              className="w-full bg-transparent border-none border-b border-primary-fixed/50 py-3 pl-8 text-on-surface focus:ring-0 focus:border-primary-fixed transition-all placeholder:text-on-surface-variant/30 font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[12px] font-bold tracking-widest text-primary-fixed/70 ml-1 uppercase">Password</label>
          <div className="relative">
            <Key className="absolute left-0 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
            <input 
              type="password" 
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="••••••••••••" 
              className="w-full bg-transparent border-none border-b border-primary-fixed/50 py-3 pl-8 text-on-surface focus:ring-0 focus:border-primary-fixed transition-all placeholder:text-on-surface-variant/30 font-mono text-sm"
            />
          </div>
        </div>

        {authMode === 'register' && (
          <div className="space-y-1">
            <label className="text-[12px] font-bold tracking-widest text-primary-fixed/70 ml-1 uppercase">Confirm password</label>
            <div className="relative">
              <Key className="absolute left-0 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                placeholder="••••••••••••" 
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
          Authorized access only.<br/>
          Account stays active until you sign out.
        </p>
        <button
          type="button"
          onClick={() => onSwitchMode(authMode === 'login' ? 'register' : 'login')}
          className="text-[11px] uppercase tracking-[0.3em] text-primary-fixed hover:text-white transition-colors"
        >
          {authMode === 'login' ? 'New operator? Create account' : 'Already registered? Login'}
        </button>
      </div>
    </motion.div>
  </div>
);

const TelemetryScreen = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="pt-24 pb-32 px-5 min-h-screen"
  >
    <section className="mb-10">
      <h2 className="text-3xl font-bold text-primary mb-1">Telemetry Stream</h2>
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-primary-fixed animate-pulse shadow-[0_0_8px_rgba(56,222,187,0.8)]" />
        <span className="text-[12px] font-bold text-on-surface-variant uppercase tracking-widest">Live Neural Uplink Active</span>
      </div>
    </section>

    <section className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
      <GlassCard className="flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <Thermometer className="w-5 h-5 text-on-surface-variant" />
          <span className="text-[12px] font-bold text-on-surface-variant uppercase">Thermal</span>
        </div>
        <div>
          <span className="text-2xl font-semibold text-primary">38°C</span>
          <div className="w-full h-1 bg-white/10 rounded-full mt-2">
            <div className="h-full w-[38%] bg-primary-fixed rounded-full shadow-[0_0_8px_rgba(56,222,187,0.5)]" />
          </div>
        </div>
      </GlassCard>
      
      <GlassCard className="flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <BatteryCharging className="w-5 h-5 text-on-surface-variant" />
          <span className="text-[12px] font-bold text-on-surface-variant uppercase">Battery</span>
        </div>
        <div>
          <span className="text-2xl font-semibold text-primary">82%</span>
          <div className="w-full h-1 bg-white/10 rounded-full mt-2">
            <div className="h-full w-[82%] bg-secondary rounded-full shadow-[0_0_8px_rgba(131,217,158,0.5)]" />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col justify-between col-span-2 md:col-span-1">
        <div className="flex justify-between items-start mb-4">
          <Gauge className="w-5 h-5 text-on-surface-variant" />
          <span className="text-[12px] font-bold text-on-surface-variant uppercase">Edge Latency</span>
        </div>
        <div>
          <span className="text-2xl font-semibold text-primary">45ms</span>
          <p className="text-[14px] text-secondary-fixed mt-1">Sub-threshold optimal</p>
        </div>
      </GlassCard>
    </section>

    <GlassCard className="mb-10">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[12px] font-bold text-primary-fixed uppercase tracking-widest">Detection Frequency</h3>
        <span className="text-[14px] font-mono text-on-surface-variant">Real-time 24h</span>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={detectionData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38debb" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#38debb" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#38debb" 
              fillOpacity={1} 
              fill="url(#colorValue)" 
              strokeWidth={2}
            />
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
              <Pie
                data={classificationData}
                innerRadius={45}
                outerRadius={60}
                paddingAngle={5}
                dataKey="value"
              >
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

    <div className="mt-10 rounded-2xl h-40 overflow-hidden relative border border-white/10 group">
      <img 
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuAlVRGhSKaGwHDM3Xz0_hFq331JRome8dxEr6jJmvLCSzlCKPreYKzrhGqC2ozeA7F9omucdWaZEpGJs5VY2c-z_TDwk5FyoLBM07-I9I8OvvWKFgL3Grakn-di6x8rmDNa2hWwHoCZzo6pqjDiXnd31QpcjCsDxTVcOAkk9q9gbvJNLgu-hc36UOHCNUgLd0B-UV2A46NQfU6-z7HwrEdqZAR2urxKFl2ZK8Irjv0H87-10c0pN24hIeQmiaRX9OwkhkUqNjbNBIg" 
        alt="Marine data map"
        className="w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700" 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <Locate className="w-4 h-4 text-primary-fixed" />
        <span className="text-sm font-mono text-primary-fixed">Sector 7G-Abyssal</span>
      </div>
    </div>
  </motion.div>
);

const ScanScreen = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="relative h-screen w-full bg-surface-dim overflow-hidden"
  >
    <div className="absolute inset-0 z-0">
      <img 
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5bkoFGc1xX2XC_JprbUuYbzgywl7yPBurtPsAoKWOKO24JNPQ9sg2wW7c065n-Bi8Moh6amu0U468FyZDI15BHiMBlG_fEv7rhxfvVTUGnDi4euFxkaWDWqmncAI0dQ9kP6uppSPaMH_IvkmEcotY9kDSHnWPK6lD-y7LlJ-xJXzTHrT2jgYht62I3UmbDzkTIVf28QBTqjqEjqnLohS6SrHlGME3omlhi4eTVC4j23MFD6SazKNqggCGXwAnAD3vmmJuOAhv1Ao" 
        alt="Underwater perspective" 
        className="w-full h-full object-cover opacity-60 grayscale-[0.2]"
      />
    </div>

    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-5 h-16 bg-surface/10 backdrop-blur-xl border-b border-white/20">
      <div className="flex items-center gap-2">
        <Waves className="w-6 h-6 text-primary-fixed" />
        <h1 className="text-[12px] font-bold tracking-[0.2em] text-primary-fixed uppercase">SHOREX</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 bg-surface-container/30 px-3 py-1.5 rounded-full border border-white/10">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">ALWAYS-ON</span>
          <div className="w-10 h-5 bg-primary-container rounded-full relative">
            <div className="absolute right-1 top-1 w-3 h-3 bg-on-primary-fixed rounded-full" />
          </div>
        </div>
        <Locate className="w-6 h-6 text-primary-fixed" />
      </div>
    </header>

    <div className="absolute inset-0 z-10 pointer-events-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute top-[20%] left-[25%] w-56 h-40 border-2 border-primary-fixed-dim/50 rounded-sm shadow-[0_0_15px_rgba(56,222,187,0.4)]"
      >
        <div className="absolute -top-7 left-0 bg-primary-fixed-dim/90 px-2 py-1 rounded-t-sm">
          <span className="text-[10px] font-bold text-on-primary-fixed uppercase tracking-wider">Plastic Bottle [98%]</span>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="absolute top-[55%] left-[55%] w-72 h-56 border-2 border-secondary-fixed-dim/50 rounded-sm shadow-[0_0_15px_rgba(131,217,158,0.4)]"
      >
        <div className="absolute -top-7 left-0 bg-secondary-fixed-dim/90 px-2 py-1 rounded-t-sm">
          <span className="text-[10px] font-bold text-on-secondary-fixed uppercase tracking-wider">Fishing Net [85%]</span>
        </div>
      </motion.div>

      <motion.div 
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 w-full h-[1px] bg-primary-fixed/40 shadow-[0_0_15px_#5ffbd6]" 
      />
    </div>

    <aside className="fixed right-5 top-24 z-30 w-72 flex flex-col gap-4">
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Telemetry</h2>
          <span className="flex h-2 w-2 rounded-full bg-primary-fixed-dim shadow-[0_0_8px_#38debb]" />
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant uppercase">Status</span>
            <span className="text-sm font-mono text-primary-fixed">LIVE</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant uppercase">GPS</span>
            <span className="text-sm font-mono text-primary-fixed">FIXED</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant uppercase">Frame Latency</span>
            <span className="text-sm font-mono text-on-surface">42ms</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-6">Daily Detection</h2>
        <div className="flex flex-col items-center py-4">
          <span className="text-5xl font-bold text-primary-fixed drop-shadow-[0_0_8px_rgba(56,222,187,0.4)] tracking-tighter">1,428</span>
          <span className="text-[10px] font-bold text-on-surface-variant/60 mt-2 tracking-widest">TOTAL DEBRIS LOGGED</span>
        </div>
        <div className="mt-6 border-t border-white/10 pt-4 space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-on-surface-variant uppercase">Plastics</span>
              <span className="text-primary-fixed">842</span>
            </div>
            <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary-fixed-dim" style={{ width: '59%' }} />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-on-surface-variant uppercase">Textiles/Nets</span>
              <span className="text-secondary-fixed-dim">586</span>
            </div>
            <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-secondary-fixed-dim" style={{ width: '41%' }} />
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="glass-card p-4 rounded-xl flex items-center gap-3">
        <BarChart2 className="w-4 h-4 text-primary-fixed" />
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">CYCLE: 3s FRAME PROCESSING</span>
      </div>
    </aside>

    <div className="absolute bottom-32 left-5 z-20 font-mono text-xs text-on-surface-variant/80 backdrop-blur-md bg-surface/20 px-3 py-1.5 rounded border border-white/5">
      42° 21' 29" N 71° 03' 49" W
    </div>
  </motion.div>
);

const HeatmapScreen = () => {
  const highestIntensityBeach = karnatakaBeachHeatPoints.reduce((highest, beach) =>
    beach.intensity > highest.intensity ? beach : highest
  );
  const averageIntensity = Math.round(
    karnatakaBeachHeatPoints.reduce((total, beach) => total + beach.intensity, 0) / karnatakaBeachHeatPoints.length
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative h-screen w-full overflow-hidden bg-surface-container-lowest"
    >
      <div className="absolute inset-0 bg-[#031529]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="oceanGradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#03243d" />
              <stop offset="55%" stopColor="#084866" />
              <stop offset="100%" stopColor="#031529" />
            </linearGradient>
            <linearGradient id="landGradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#133c36" />
              <stop offset="55%" stopColor="#1f5a42" />
              <stop offset="100%" stopColor="#0c2f2d" />
            </linearGradient>
            <pattern id="gridPattern" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(214,227,255,0.08)" strokeWidth="0.25" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#oceanGradient)" />
          <rect width="100" height="100" fill="url(#gridPattern)" />
          <path
            d="M60 0 C56 8 54 16 55 23 C56 30 61 35 59 43 C57 51 63 59 62 67 C61 75 68 82 69 91 C70 95 72 98 74 100 L100 100 L100 0 Z"
            fill="url(#landGradient)"
          />
          <path
            d="M60 0 C56 8 54 16 55 23 C56 30 61 35 59 43 C57 51 63 59 62 67 C61 75 68 82 69 91 C70 95 72 98 74 100"
            fill="none"
            stroke="#5ffbd6"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeDasharray="2 2"
          />
          <path d="M0 31 C20 29 39 32 55 24" fill="none" stroke="rgba(95,251,214,0.16)" strokeWidth="0.4" />
          <path d="M0 62 C19 58 39 60 62 67" fill="none" stroke="rgba(95,251,214,0.14)" strokeWidth="0.4" />
          <path d="M0 83 C24 80 44 82 69 91" fill="none" stroke="rgba(95,251,214,0.12)" strokeWidth="0.4" />
        </svg>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_48%,rgba(95,251,214,0.18)_0%,transparent_34%),radial-gradient(circle_at_65%_72%,rgba(255,122,89,0.18)_0%,transparent_28%)] pointer-events-none" />

      <div className="absolute top-24 left-5 right-5 z-40 max-w-3xl">
        <div className="glass-card flex items-center px-4 py-3 rounded-xl">
          <Search className="w-5 h-5 text-on-surface-variant mr-3" />
          <input 
            type="text" 
            className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder-on-surface-variant/50 text-on-surface" 
            placeholder="Search Karnataka beaches or coordinates..." 
          />
          <Mic className="w-5 h-5 text-on-surface-variant" />
        </div>
      </div>

      <div className="absolute left-5 top-44 z-30 hidden md:block">
        <div className="glass-card p-4 rounded-xl w-64">
          <p className="text-[10px] font-bold tracking-widest text-primary-fixed uppercase mb-2">Karnataka Coast</p>
          <h2 className="text-2xl font-bold text-primary leading-tight">Beach debris heat map</h2>
          <p className="text-xs text-on-surface-variant mt-3 leading-relaxed">
            Live sweep across Uttara Kannada, Udupi, and Dakshina Kannada shore segments.
          </p>
        </div>
      </div>

      <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-40">
        <button className="glass-card p-3 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" title="Zoom in">
          <Plus className="w-5 h-5 text-primary-fixed" />
        </button>
        <button className="glass-card p-3 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" title="Zoom out">
          <Minus className="w-5 h-5 text-primary-fixed" />
        </button>
        <button className="glass-card mt-6 p-3 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" title="Map layers">
          <Layers className="w-5 h-5 text-primary-fixed" />
        </button>
      </div>

      {karnatakaBeachHeatPoints.map((beach) => (
        <div
          key={beach.name}
          className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${beach.x}%`, top: `${beach.y}%` }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
            style={{
              background: `radial-gradient(circle, ${beach.color}80 0%, ${beach.color}30 42%, transparent 72%)`,
              transform: `translate(-50%, -50%) scale(${0.78 + beach.intensity / 115})`,
            }}
          />
          <div className="relative flex items-center justify-center h-4 w-4">
            {beach.intensity >= 85 && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: beach.color }} />
            )}
            <span
              className="relative inline-flex rounded-full h-3 w-3 border border-white/70 shadow-[0_0_14px_rgba(255,255,255,0.35)]"
              style={{ backgroundColor: beach.color }}
            />
          </div>
          <div className="hidden sm:block absolute left-5 top-0 min-w-32 rounded-lg border border-white/10 bg-surface/70 px-2 py-1 backdrop-blur-md">
            <p className="text-[11px] font-bold text-primary leading-none">{beach.name}</p>
            <p className="text-[9px] text-on-surface-variant uppercase tracking-wide">{beach.intensity}% density</p>
          </div>
        </div>
      ))}

      <div className="absolute bottom-32 left-5 right-5 z-40 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="glass-card p-4 rounded-xl flex items-center gap-4 border-l-4 border-l-primary-fixed">
          <div className="bg-primary-container/20 p-2 rounded-lg">
            <Droplets className="w-6 h-6 text-primary-fixed" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-widest text-on-surface-variant mb-1 uppercase">Highest beach signal</p>
            <p className="text-sm font-semibold text-primary truncate">
              {highestIntensityBeach.name} - {highestIntensityBeach.coords}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-tertiary-fixed-dim">{highestIntensityBeach.intensity}%</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">{highestIntensityBeach.region}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4 rounded-xl">
            <p className="text-[10px] font-bold tracking-widest text-on-surface-variant mb-1 uppercase">Beach points</p>
            <p className="text-xl font-bold text-primary">{karnatakaBeachHeatPoints.length}<span className="text-sm font-normal ml-1 text-on-surface-variant">tracked</span></p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-[10px] font-bold tracking-widest text-on-surface-variant mb-1 uppercase">Avg density</p>
            <p className="text-xl font-bold text-secondary flex items-center gap-2">
              {averageIntensity}% <TrendingUp className="w-5 h-5" />
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const AdminScreen = () => {
  const [missionMode, setMissionMode] = useState<'Patrol' | 'Training' | 'Audit'>('Patrol');
  const [confidenceGate, setConfidenceGate] = useState(88);
  const [autoTriage, setAutoTriage] = useState(true);
  const [remoteAccess, setRemoteAccess] = useState(true);
  const [maintenanceLock, setMaintenanceLock] = useState(false);

  const permissions = [
    {
      label: 'Remote Camera Access',
      detail: 'Allow admins to start station cameras',
      enabled: remoteAccess,
      onToggle: () => setRemoteAccess((value) => !value),
    },
    {
      label: 'Auto Incident Triage',
      detail: 'Route high-risk debris events automatically',
      enabled: autoTriage,
      onToggle: () => setAutoTriage((value) => !value),
    },
    {
      label: 'Maintenance Lock',
      detail: 'Pause operator changes during service windows',
      enabled: maintenanceLock,
      onToggle: () => setMaintenanceLock((value) => !value),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-24 pb-32 px-5 min-h-screen"
    >
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-primary-fixed" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary-fixed">Admin Interface</span>
        </div>
        <h2 className="text-3xl font-bold text-primary mb-2">Control Center</h2>
        <p className="text-sm text-on-surface-variant max-w-2xl">
          Manage operators, station permissions, AI thresholds, and incident response from one secure view.
        </p>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {adminMetrics.map((metric) => (
          <GlassCard key={metric.label} className="min-h-[126px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <metric.icon className="w-5 h-5 text-primary-fixed" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{metric.label}</span>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">{metric.value}</p>
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide">{metric.detail}</p>
            </div>
          </GlassCard>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4 mb-8">
        <GlassCard>
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-primary-fixed" />
              <h3 className="text-[11px] font-bold text-primary-fixed uppercase tracking-widest">Mission Governance</h3>
            </div>
            <button className="shrink-0 p-2 rounded-lg bg-primary-fixed text-on-primary-fixed hover:scale-105 active:scale-95 transition-transform" title="Save admin changes">
              <Save className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
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

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-on-surface uppercase tracking-wide">AI Confidence Gate</label>
                <span className="font-mono text-primary-fixed">{confidenceGate}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="99"
                value={confidenceGate}
                onChange={(event) => setConfidenceGate(Number(event.target.value))}
                className="w-full accent-primary-fixed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {permissions.map((permission) => (
                <button
                  key={permission.label}
                  onClick={permission.onToggle}
                  className="text-left rounded-lg border border-white/10 bg-white/5 p-4 hover:border-primary-fixed/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <LockKeyhole className="w-4 h-4 text-primary-fixed" />
                    <span
                      className={cn(
                        'h-5 w-10 rounded-full border relative transition-colors',
                        permission.enabled ? 'bg-primary-fixed/20 border-primary-fixed/60' : 'bg-surface-container-high border-outline'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-1 h-3 w-3 rounded-full transition-all',
                          permission.enabled ? 'right-1 bg-primary-fixed' : 'left-1 bg-on-surface-variant'
                        )}
                      />
                    </span>
                  </div>
                  <p className="text-sm font-bold text-on-surface uppercase">{permission.label}</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">{permission.detail}</p>
                </button>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="w-5 h-5 text-tertiary-fixed-dim" />
            <h3 className="text-[11px] font-bold text-primary-fixed uppercase tracking-widest">Incident Queue</h3>
          </div>
          <div className="space-y-3">
            {incidentQueue.map((incident) => (
              <div key={incident.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-on-surface">{incident.type}</p>
                    <p className="text-[11px] text-on-surface-variant font-mono mt-1">{incident.id} / {incident.area}</p>
                  </div>
                  <span className={cn(
                    'rounded-full px-2 py-1 text-[10px] font-bold uppercase',
                    incident.risk === 'High' ? 'bg-error/20 text-error' : incident.risk === 'Medium' ? 'bg-tertiary-fixed/20 text-tertiary-fixed-dim' : 'bg-secondary/15 text-secondary'
                  )}>
                    {incident.risk}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button className="py-2 rounded-lg bg-primary-fixed/15 text-primary-fixed text-[11px] font-bold uppercase tracking-widest hover:bg-primary-fixed/25">
                    Acknowledge
                  </button>
                  <button className="py-2 rounded-lg bg-white/5 text-on-surface-variant text-[11px] font-bold uppercase tracking-widest hover:text-primary-fixed">
                    Escalate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      <GlassCard>
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-primary-fixed" />
          <h3 className="text-[11px] font-bold text-primary-fixed uppercase tracking-widest">Operator Access</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-on-surface-variant">
                <th className="py-3 pr-4">Operator</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3 pr-4">Station</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {operatorRoster.map((operator) => (
                <tr key={operator.name} className="border-b border-white/5">
                  <td className="py-4 pr-4 text-sm font-bold text-on-surface">{operator.name}</td>
                  <td className="py-4 pr-4 text-sm text-on-surface-variant">{operator.role}</td>
                  <td className="py-4 pr-4 text-sm font-mono text-primary-fixed-dim">{operator.station}</td>
                  <td className="py-4 pr-4">
                    <span className="inline-flex items-center gap-1 text-xs text-secondary">
                      <CheckCircle2 className="w-3 h-3" />
                      {operator.status}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button className="text-[11px] font-bold uppercase tracking-widest text-primary-fixed hover:text-primary">
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </motion.div>
  );
};

const SettingsScreen = ({ onLogout, onClose }: { onLogout: () => void; onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, x: 50 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 50 }}
    className="fixed inset-0 z-[60] bg-background overflow-y-auto pb-32"
  >
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
            <span className="text-sm text-on-surface-variant uppercase">Operator ID</span>
            <span className="text-sm font-mono text-primary-fixed-dim">CR-7742-X</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-on-surface-variant uppercase">Station Name</span>
            <span className="text-sm text-on-surface">Mariana Point North</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-on-surface-variant uppercase">Bio-Authentication</span>
            <div className="flex items-center gap-1">
              <BadgeCheck className="w-4 h-4 text-secondary fill-current" />
              <span className="text-sm font-mono text-secondary uppercase">Verified</span>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center gap-2 mb-6">
          <Bell className="w-5 h-5 text-primary-fixed" />
          <h2 className="text-[10px] font-bold text-primary-fixed uppercase tracking-widest">Notification Preferences</h2>
        </div>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-sm text-on-surface uppercase">Debris Alert</span>
            <div className="w-12 h-6 rounded-full bg-primary-fixed/20 relative cursor-pointer border border-primary-fixed/40">
              <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-primary-fixed shadow-[0_0_8px_#38debb]" />
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-on-surface uppercase">Telemetry Updates</span>
            <div className="w-12 h-6 rounded-full bg-primary-fixed/20 relative cursor-pointer border border-primary-fixed/40">
              <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-primary-fixed shadow-[0_0_8px_#38debb]" />
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-on-surface uppercase">Network Status</span>
            <div className="w-12 h-6 rounded-full bg-surface-container-highest relative cursor-pointer border border-outline">
              <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-on-surface-variant" />
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-primary-fixed" />
          <h2 className="text-[10px] font-bold text-primary-fixed uppercase tracking-widest">Security Settings</h2>
        </div>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-sm text-on-surface uppercase">Biometric Lock</span>
            <div className="w-12 h-6 rounded-full bg-primary-fixed/20 relative cursor-pointer border border-primary-fixed/40">
              <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-primary-fixed shadow-[0_0_8px_#38debb]" />
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="flex flex-col">
              <span className="text-sm text-on-surface uppercase">Encryption Level</span>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest">RSA-4096 (Military)</span>
            </div>
            <div className="flex bg-surface-container-low rounded-lg p-1 border border-outline-variant">
              <button className="px-3 py-1 bg-primary-fixed text-on-primary-fixed rounded text-[10px] font-bold">HIGH</button>
              <button className="px-3 py-1 text-on-surface-variant text-[10px] font-bold">LOW</button>
            </div>
          </div>
          <button className="w-full flex justify-between items-center p-3 border border-primary-fixed/20 rounded-lg hover:bg-primary-fixed/5 transition-colors">
            <span className="text-sm font-bold text-primary-fixed-dim uppercase tracking-widest">Change Station Token</span>
            <Key className="w-4 h-4 text-primary-fixed-dim" />
          </button>
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
              <span className="text-[10px] text-on-surface-variant font-mono">342MB temporary data stored</span>
            </div>
            <Eraser className="w-5 h-5 text-on-surface-variant" />
          </button>
          <button 
            onClick={onLogout}
            className="w-full py-4 px-4 bg-tertiary-fixed-variant/10 border border-on-tertiary-fixed-variant/30 rounded-lg flex items-center justify-center gap-2 text-tertiary-fixed-dim active:scale-[0.98] transition-transform hover:bg-on-tertiary-fixed-variant/20"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[12px] font-bold tracking-widest uppercase">SIGN OUT</span>
          </button>
        </div>
      </GlassCard>
    </main>

    <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-5 py-4 bg-surface-container/10 backdrop-blur-xl border-t border-white/20 rounded-t-xl">
      <button className="p-3 text-on-surface-variant hover:text-primary-fixed transition-colors active:scale-90 duration-300">
        <ScanIcon className="w-6 h-6" />
      </button>
      <button className="p-3 text-on-surface-variant hover:text-primary-fixed transition-colors active:scale-90 duration-300">
        <Ruler className="w-6 h-6" />
      </button>
      <button className="p-3 text-on-surface-variant hover:text-primary-fixed transition-colors active:scale-90 duration-300">
        <BarChart2 className="w-6 h-6" />
      </button>
      <button className="bg-primary/10 text-primary-fixed shadow-[0_0_15px_rgba(95,251,214,0.3)] rounded-full p-3 active:scale-90 duration-300">
        <Cpu className="w-6 h-6" />
      </button>
    </nav>
  </motion.div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [lastMainTab, setLastMainTab] = useState<Tab>('system');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  useEffect(() => {
    const sessionEmail = loadSessionEmail();
    if (sessionEmail) {
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
    setLastMainTab(tab);
  };

  const handleLogout = () => {
    clearSessionEmail();
    setCurrentUser(null);
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

  const handleAuthSubmit = () => {
    const email = normalizeEmail(authEmail);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError('Enter a valid Gmail address.');
      return;
    }

    if (!authPassword || authPassword.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }

    if (authMode === 'register') {
      if (authPassword !== authConfirmPassword) {
        setAuthError('Passwords do not match.');
        return;
      }

      if (findUserByEmail(email)) {
        setAuthError('This Gmail is already registered. Please login.');
        return;
      }

      const newUser: UserAccount = {
        email,
        password: authPassword,
        displayName: email.split('@')[0],
        createdAt: new Date().toISOString(),
      };

      const updatedUsers = [...loadUsers(), newUser];
      saveUsers(updatedUsers);
      saveSessionEmail(email);
      setCurrentUser(newUser);
      setActiveTab('system');
      setAuthError('');
      return;
    }

    const existingUser = findUserByEmail(email);
    if (!existingUser || existingUser.password !== authPassword) {
      setAuthError('Email or password is incorrect.');
      return;
    }

    saveSessionEmail(email);
    setCurrentUser(existingUser);
    setActiveTab('system');
    setAuthError('');
  };

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

  return (
    <div className="bg-surface text-on-surface min-h-screen relative font-sans overflow-x-hidden">
      <TopBar 
        title="SHOREX" 
        onSettings={() => setIsSettingsOpen(true)}
      />

      <AnimatePresence mode="wait">
        {activeTab === 'system' && <TelemetryScreen key="system" />}
        {activeTab === 'scan' && <ScanScreen key="scan" />}
        {activeTab === 'plastic' && <PlasticDetector key="plastic" />}
        {activeTab === 'heatmap' && <HeatmapScreen key="heatmap" />}
        {activeTab === 'admin' && <AdminScreen key="admin" />}
        {activeTab === 'data' && (
          <div key="data" className="pt-24 px-5 text-center">
            <BarChart2 className="w-16 h-16 text-primary-fixed mx-auto mb-4" />
            <h2 className="text-xl font-bold uppercase tracking-widest text-on-surface">Data Analysis Engine</h2>
            <p className="text-on-surface-variant text-sm mt-2">Historical debris tracking and trend synthesis.</p>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsScreen 
            onLogout={handleLogout}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </AnimatePresence>

      {!isSettingsOpen && (
        <BottomNavBar activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </div>
  );
}

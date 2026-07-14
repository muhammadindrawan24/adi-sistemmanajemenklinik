import { HeartPulse, Shield } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-800">
        {/* Decorative medical cross pattern */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg className="absolute top-0 left-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="crosses" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                <rect x="24" y="12" width="12" height="36" rx="2" fill="white"/>
                <rect x="12" y="24" width="36" height="12" rx="2" fill="white"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#crosses)"/>
          </svg>
        </div>

        {/* Glowing orbs */}
        <div className="absolute top-20 left-16 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-32 right-20 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-white/5 rounded-full blur-2xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Top — Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
                <HeartPulse className="h-6 w-6 text-white relative z-10" />
              </div>
              <div className="absolute inset-0 rounded-xl bg-white/10 animate-ping" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">KlinikSehat</h1>
              <p className="text-xs text-teal-200">Sistem Manajemen Klinik</p>
            </div>
          </div>

          {/* Center — Hero text + illustration */}
          <div className="flex-1 flex flex-col justify-center max-w-md">
            {/* Animated ECG Monitor */}
            <div className="mb-8 relative h-24">
              {/* Glow background */}
              <div className="absolute inset-0 bg-gradient-to-r from-teal-400/0 via-teal-400/20 to-teal-400/0 blur-2xl animate-pulse" />
              
              {/* ECG SVG */}
              <svg viewBox="0 0 400 80" className="w-full h-full relative" fill="none">
                <defs>
                  {/* Main gradient */}
                  <linearGradient id="ecgMain" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                    <stop offset="35%" stopColor="rgba(255,255,255,0.3)" />
                    <stop offset="50%" stopColor="rgba(45,212,191,1)" />
                    <stop offset="65%" stopColor="rgba(255,255,255,0.3)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </linearGradient>
                  {/* Glow filter */}
                  <filter id="ecgGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur"/>
                    <feMerge>
                      <feMergeNode in="blur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                {/* Static background line */}
                <path 
                  d="M0,40 L60,40 L80,40 L95,15 L110,65 L120,25 L130,55 L145,40 L170,40 L220,40 L240,40 L255,15 L270,65 L280,25 L290,55 L305,40 L330,40 L400,40" 
                  stroke="rgba(255,255,255,0.15)" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                
                {/* Animated ECG line */}
                <path 
                  d="M0,40 L60,40 L80,40 L95,15 L110,65 L120,25 L130,55 L145,40 L170,40 L220,40 L240,40 L255,15 L270,65 L280,25 L290,55 L305,40 L330,40 L400,40" 
                  stroke="url(#ecgMain)" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  filter="url(#ecgGlow)"
                  strokeDasharray="800"
                  strokeDashoffset="800"
                  style={{animation: 'ecgPulse 4s linear infinite'}}
                />
                
                {/* Moving pulse dot */}
                <circle r="4" fill="#2dd4bf" filter="url(#ecgGlow)">
                  <animateMotion 
                    dur="4s" 
                    repeatCount="indefinite"
                    path="M0,40 L60,40 L80,40 L95,15 L110,65 L120,25 L130,55 L145,40 L170,40 L220,40 L240,40 L255,15 L270,65 L280,25 L290,55 L305,40 L330,40 L400,40"
                  />
                  <animate attributeName="r" values="3;5;3" dur="0.5s" repeatCount="indefinite"/>
                </circle>
                
                {/* Trail effect */}
                <circle r="6" fill="none" stroke="#2dd4bf" strokeWidth="1" opacity="0.3">
                  <animateMotion 
                    dur="4s" 
                    repeatCount="indefinite"
                    path="M0,40 L60,40 L80,40 L95,15 L110,65 L120,25 L130,55 L145,40 L170,40 L220,40 L240,40 L255,15 L270,65 L280,25 L290,55 L305,40 L330,40 L400,40"
                  />
                  <animate attributeName="r" values="6;10;6" dur="0.5s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.3;0;0.3" dur="0.5s" repeatCount="indefinite"/>
                </circle>
              </svg>
              
              <style>{`
                @keyframes ecgPulse {
                  0% { stroke-dashoffset: 800; }
                  100% { stroke-dashoffset: 0; }
                }
              `}</style>
            </div>

            <h2 className="text-3xl font-bold text-white leading-tight mb-4">
              Kelola klinik Anda<br/>
              <span className="text-teal-300">dengan lebih mudah</span>
            </h2>
            <p className="text-teal-100/70 text-sm leading-relaxed">
              Sistem manajemen klinik terintegrasi untuk mengelola antrian, rekam medis, jadwal dokter, dan laporan — semuanya dalam satu platform.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-6">
              {["Antrian Realtime", "Rekam Medis", "Laporan Otomatis"].map((feat) => (
                <span key={feat} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 px-3 py-1.5 text-xs font-medium text-teal-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
                  {feat}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom — Trust badge */}
          <div className="flex items-center gap-2 text-teal-200/50 text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>Data terlindungi dengan enkripsi end-to-end</span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.015]">
          <svg className="absolute top-0 left-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#0f766e"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)"/>
          </svg>
        </div>

        <div className="relative z-10 w-full max-w-md">
          {/* Mobile logo — shown only on small screens */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-teal-600 to-emerald-600 rounded-2xl mb-3 shadow-lg">
              <HeartPulse className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">KlinikSehat</h1>
            <p className="text-sm text-slate-500 mt-0.5">Sistem Manajemen Klinik</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

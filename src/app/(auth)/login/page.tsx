"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  UserPlus,
  Shield,
  Clock,
  Stethoscope,
} from "lucide-react";

const loginSchema = z.object({
  email: z.email("Email tidak valid"),
  password: z
    .string()
    .min(6, "Password minimal 6 karakter"),
});

type LoginForm = z.infer<typeof loginSchema>;

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const features = [
  { icon: Clock, label: "Ambil Antrian Online", desc: "Daftar antrian dari rumah" },
  { icon: Stethoscope, label: "Jadwal Dokter", desc: "Cek jadwal praktek" },
  { icon: Shield, label: "Rekam Medis", desc: "Akses riwayat kesehatan" },
];

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        showToast("error", "Email atau password salah. Silakan coba lagi.");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      const role = profile?.role ?? "pasien";

      await logAudit('login', 'auth', authData.user.id, null, { email: data.email, role });

      showToast("success", "Login berhasil! Mengarahkan ke dashboard...");

      setTimeout(() => {
        switch (role) {
          case "admin":
            router.push("/admin");
            break;
          case "petugas":
            router.push("/petugas");
            break;
          case "dokter":
            router.push("/dokter");
            break;
          default:
            router.push("/pasien");
        }
      }, 800);
    } catch {
      showToast("error", "Terjadi kesalahan. Silakan coba lagi nanti.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          className="fixed top-4 right-4 z-[100]"
        >
          <div className={`flex items-center gap-2 rounded-xl px-5 py-3.5 text-sm font-medium text-white shadow-xl ${toast.type === "success" ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-red-500 to-rose-500"}`}>
            {toast.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-white/70 hover:text-white"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}

      <div className="p-8 sm:p-10">
        {/* Header */}
        <motion.div 
          initial="hidden" 
          animate="visible" 
          variants={fadeIn} 
          custom={0}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-500 to-teal-600 shadow-xl shadow-teal-500/30">
                <LogIn className="h-7 w-7 text-white" />
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 opacity-30 blur-lg" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Selamat Datang
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Masuk ke akun Anda untuk melanjutkan
              </p>
            </div>
          </div>
          {/* Decorative line */}
          <div className="mt-5 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </motion.div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email */}
          <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={1}>
            <label
              htmlFor="email"
              className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"
            >
              Email
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
              </div>
              <input
                id="email"
                type="email"
                placeholder="nama@email.com"
                {...register("email")}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              />
            </div>
            {errors.email && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-xs text-red-500 flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.email.message}
              </motion.p>
            )}
          </motion.div>

          {/* Password */}
          <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={2}>
            <label
              htmlFor="password"
              className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"
            >
              Password
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Masukkan password"
                {...register("password")}
                className="w-full pl-11 pr-12 py-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-xs text-red-500 flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.password.message}
              </motion.p>
            )}
          </motion.div>

          {/* Forgot Password */}
          <motion.div 
            initial="hidden" 
            animate="visible" 
            variants={fadeIn} 
            custom={3}
            className="flex justify-end"
          >
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
            >
              Lupa password?
            </Link>
          </motion.div>

          {/* Submit Button */}
          <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={4}>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#0d9488] via-[#0f766e] to-[#0d9488] hover:from-[#0f766e] hover:via-[#115e59] hover:to-[#0f766e] text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-300 shadow-lg shadow-teal-600/30 hover:shadow-xl hover:shadow-teal-600/40 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <div className="spinner spinner-sm" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4.5 w-4.5" />
                  <span className="text-sm">Masuk</span>
                </>
              )}
            </button>
          </motion.div>
        </form>

        {/* Info untuk Pasien */}
        <motion.div 
          initial="hidden" 
          animate="visible" 
          variants={fadeIn} 
          custom={5}
          className="mt-6 rounded-2xl bg-gradient-to-r from-teal-50/80 to-emerald-50/80 border border-teal-100/80 p-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-teal-400/10 to-emerald-400/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/25 shrink-0">
              <UserPlus className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-teal-800">
                Pasien baru?
              </p>
              <Link 
                href="/register" 
                className="text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors inline-flex items-center gap-1 mt-0.5"
              >
                Daftar sekarang untuk ambil antrian online
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}

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
  UserPlus,
} from "lucide-react";

const loginSchema = z.object({
  email: z.email("Email tidak valid"),
  password: z
    .string()
    .min(6, "Password minimal 6 karakter"),
});

type LoginForm = z.infer<typeof loginSchema>;

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

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

      <div className="p-6 sm:p-8">
        {/* Header */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          custom={0}
          className="mb-5"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="relative">
              {/* Pulse ring animation */}
              <motion.div
                className="absolute inset-0 rounded-xl bg-teal-400"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 via-emerald-500 to-teal-600 shadow-lg shadow-teal-500/30"
                whileHover={{ rotate: -10, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <motion.div
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <LogIn className="h-5 w-5 text-white" />
                </motion.div>
              </motion.div>
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">
                <motion.span
                  className="text-slate-800"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  Selamat
                </motion.span>{" "}
                <motion.span
                  className="text-teal-600"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                >
                  Datang
                </motion.span>
              </h2>
              <motion.p
                className="text-xs text-slate-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                Masuk ke akun Anda untuk melanjutkan
              </motion.p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <motion.div
              className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            />
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 h-1 rounded-full bg-teal-400"
                  animate={{
                    y: [0, -4, 0],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
            <motion.div
              className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            />
          </div>
        </motion.div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={1}>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-600 mb-1.5"
            >
              Email
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
              </div>
              <input
                id="email"
                type="email"
                placeholder="nama@email.com"
                {...register("email")}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 focus:outline-none"
              />
            </div>
            {errors.email && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1.5 text-xs text-red-500 flex items-center gap-1"
              >
                <AlertCircle className="w-3 h-3" />
                {errors.email.message}
              </motion.p>
            )}
          </motion.div>

          {/* Password */}
          <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={2}>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-600 mb-1.5"
            >
              Password
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Masukkan password"
                {...register("password")}
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
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
                className="mt-1.5 text-xs text-red-500 flex items-center gap-1"
              >
                <AlertCircle className="w-3 h-3" />
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
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
            >
              Lupa password?
            </Link>
          </motion.div>

          {/* Submit Button */}
          <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={4}>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#0d9488] via-[#0f766e] to-[#0d9488] hover:from-[#0f766e] hover:via-[#115e59] hover:to-[#0f766e] text-white font-semibold py-3 px-4 rounded-2xl transition-all duration-300 shadow-lg shadow-teal-600/30 hover:shadow-xl hover:shadow-teal-600/40 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <div className="spinner spinner-sm" />
                  <span className="text-sm">Memproses...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
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
          className="mt-4"
        >
          <Link href="/register" className="block w-full">
            <div className="w-full rounded-2xl bg-teal-50 border border-teal-200 p-3 flex items-center gap-3 hover:bg-teal-100 transition-colors cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-md shadow-teal-500/25 shrink-0">
                <UserPlus className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-teal-800">
                Pasien baru? <span className="text-teal-600">Daftar sekarang</span>
              </p>
            </div>
          </Link>
        </motion.div>
      </div>
    </>
  );
}

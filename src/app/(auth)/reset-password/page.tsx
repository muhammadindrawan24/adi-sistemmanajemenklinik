"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Heart,
  Loader2,
} from "lucide-react";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .regex(/[A-Z]/, "Harus mengandung huruf besar")
      .regex(/[0-9]/, "Harus mengandung angka"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSessionValid, setIsSessionValid] = useState<boolean | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // Check if there is a valid recovery session
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setIsSessionValid(!!data.session);
    });
  }, []);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const onSubmit = async (data: ResetPasswordForm) => {
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        showToast("error", "Gagal mengupdate password. Silakan coba lagi.");
        return;
      }

      setIsSuccess(true);
      showToast("success", "Password berhasil diupdate!");

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch {
      showToast("error", "Terjadi kesalahan. Silakan coba lagi nanti.");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while checking session
  if (isSessionValid === null) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  // No valid session
  if (!isSessionValid) {
    return (
      <div className="p-8 text-center animate-fadeIn">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-danger/10 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-danger" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Tautan Tidak Valid
        </h3>
        <p className="text-sm text-foreground/60 mb-6">
          Tautan reset password sudah kedaluwarsa atau tidak valid. Silakan
          minta tautan baru.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-2 btn-primary py-2.5 text-sm"
        >
          <KeyRound className="w-4 h-4" />
          Minta Tautan Baru
        </Link>
      </div>
    );
  }

  return (
    <>
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === "success" ? (
              <CheckCircle className="toast-icon text-success" />
            ) : (
              <AlertCircle className="toast-icon text-danger" />
            )}
            <span className="toast-message">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="toast-close text-foreground/50 hover:text-foreground"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-50 rounded-xl mb-3">
            <Heart className="w-6 h-6 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Reset Password
          </h2>
          <p className="text-sm text-foreground/60 mt-1">
            Masukkan password baru Anda di bawah ini
          </p>
        </div>

        {isSuccess ? (
          /* Success State */
          <div className="text-center animate-fadeIn">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Password Berhasil Diupdate!
            </h3>
            <p className="text-sm text-foreground/60 mb-6">
              Anda akan diarahkan ke halaman login dalam beberapa saat...
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Masuk sekarang
            </Link>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Password Baru
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-foreground/30" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimal 8 karakter"
                  {...register("password")}
                  className="w-full pl-10 pr-11 py-2.5 bg-surface border border-border rounded-xl text-sm text-foreground placeholder:text-foreground/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-foreground/30 hover:text-foreground/60 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                Konfirmasi Password Baru
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-foreground/30" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Ulangi password baru"
                  {...register("confirmPassword")}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-foreground placeholder:text-foreground/30 transition-all"
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 btn-primary py-2.5 text-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Back to Login */}
        {!isSuccess && (
          <div className="text-center mt-6">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke halaman login
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

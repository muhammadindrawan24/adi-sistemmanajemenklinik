"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  ArrowLeft,
  Send,
  AlertCircle,
  CheckCircle,
  Heart,
} from "lucide-react";

const forgotPasswordSchema = z.object({
  email: z.email("Email tidak valid"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        showToast("error", "Gagal mengirim email. Silakan coba lagi.");
        return;
      }

      setIsSuccess(true);
    } catch {
      showToast("error", "Terjadi kesalahan. Silakan coba lagi nanti.");
    } finally {
      setIsLoading(false);
    }
  };

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
          <h2 className="text-xl font-bold text-foreground">Lupa Password</h2>
          <p className="text-sm text-foreground/60 mt-1">
            Masukkan email Anda untuk menerima tautan reset password
          </p>
        </div>

        {isSuccess ? (
          /* Success State */
          <div className="text-center animate-fadeIn">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Email Terkirim!
            </h3>
            <p className="text-sm text-foreground/60 mb-2">
              Kami telah mengirim tautan reset password ke:
            </p>
            <p className="text-sm font-medium text-primary-600 mb-6">
              {getValues("email")}
            </p>
            <p className="text-xs text-foreground/40 mb-6">
              Silakan cek inbox email Anda. Tautan akan kedaluwarsa dalam 1 jam.
              Jika tidak ada email, cek folder spam.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke halaman login
            </Link>
          </div>
        ) : (
          /* Form State */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground/80 mb-1.5"
              >
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-foreground/30" />
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  {...register("email")}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-foreground placeholder:text-foreground/30 transition-all"
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 btn-primary py-2.5 text-sm"
            >
              {isLoading ? (
                <>
                  <div className="spinner spinner-sm" />
                  <span>Mengirim...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Kirim Tautan Reset</span>
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  MapPin,
  CreditCard,
  Calendar,
  Users,
  Droplets,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  CheckCircle,
  Loader2,
  Heart,
} from "lucide-react";

// ─── Zod Schemas per Step ───
const step1Schema = z
  .object({
    email: z.email("Email tidak valid"),
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

const step2Schema = z.object({
  fullName: z.string().min(3, "Nama lengkap minimal 3 karakter"),
  phone: z
    .string()
    .regex(/^0[0-9]{9,12}$/, "Nomor telepon tidak valid (contoh: 08123456789)"),
  address: z.string().min(10, "Alamat minimal 10 karakter"),
});

const step3Schema = z.object({
  nik: z
    .string()
    .regex(/^[0-9]{16}$/, "NIK harus 16 digit angka"),
  birthDate: z.string().min(1, "Tanggal lahir wajib diisi"),
  gender: z.enum(["laki_laki", "perempuan"], {
    message: "Jenis kelamin wajib dipilih",
  }),
  bloodType: z.enum(["A", "B", "AB", "O"], {
    message: "Golongan darah wajib dipilih",
  }),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;
type Step3 = z.infer<typeof step3Schema>;

const BLOOD_TYPES = ["A", "B", "AB", "O"] as const;
const GENDERS = [
  { value: "laki_laki", label: "Laki-laki" },
  { value: "perempuan", label: "Perempuan" },
] as const;

function generateRMNumber(): string {
  const now = new Date();
  const datePart =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0");
  const seq = Math.floor(Math.random() * 999 + 1)
    .toString()
    .padStart(3, "0");
  return `RM${datePart}${seq}`;
}

export default function RegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Combined form data
  const [formData, setFormData] = useState<
    Partial<Step1 & Step2 & Step3>
  >({});

  // Per-step forms
  const step1Form = useForm<Step1>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const step2Form = useForm<Step2>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      fullName: "",
      phone: "",
      address: "",
    },
  });

  const step3Form = useForm<Step3>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      nik: "",
      birthDate: "",
      gender: undefined,
      bloodType: undefined,
    },
  });

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleNextStep = async () => {
    let isValid = false;

    if (currentStep === 1) {
      isValid = await step1Form.trigger();
      if (isValid) {
        setFormData((prev) => ({ ...prev, ...step1Form.getValues() }));
      }
    } else if (currentStep === 2) {
      isValid = await step2Form.trigger();
      if (isValid) {
        setFormData((prev) => ({ ...prev, ...step2Form.getValues() }));
      }
    }

    if (isValid && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmitStep3 = async (data: Step3) => {
    setIsLoading(true);
    const allData = { ...formData, ...data };

    try {
      const supabase = createClient();

      // 1. Create auth user
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email: allData.email!,
          password: allData.password!,
          options: {
            data: {
              full_name: allData.fullName,
              role: 'pasien',
            },
          },
        });

      if (authError) {
        if (authError.message.includes("already registered")) {
          showToast(
            "error",
            "Email sudah terdaftar. Gunakan email lain atau masuk."
          );
        } else {
          showToast("error", `Gagal mendaftar: ${authError.message}`);
        }
        return;
      }

      if (!authData.user) {
        showToast("error", "Gagal membuat akun. Silakan coba lagi.");
        return;
      }

      const userId = authData.user.id;

      // 2. Upsert into users table (trigger may have created it)
      const { error: userError } = await supabase.from("users").upsert({
        id: userId,
        email: allData.email!,
        role: "pasien",
        is_active: true,
      }, { onConflict: 'id' });

      if (userError) {
        showToast("error", "Gagal menyimpan data pengguna.");
        return;
      }

      // 3. Upsert profiles (trigger handle_new_user may have created it)
      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: userId,
        full_name: allData.fullName!,
        phone: allData.phone!,
        address: allData.address!,
      }, { onConflict: 'user_id' });

      if (profileError) {
        showToast("error", "Gagal menyimpan profil pengguna.");
        return;
      }

      // 4. Insert into patients table
      const { error: patientError } = await supabase.from("patients").insert({
        user_id: userId,
        medical_record_number: generateRMNumber(),
        nik: allData.nik || null,
        date_of_birth: allData.birthDate!,
        gender: allData.gender!,
        blood_type: allData.bloodType!,
      });

      if (patientError) {
        showToast("error", "Gagal menyimpan data pasien.");
        return;
      }

      showToast(
        "success",
        "Pendaftaran berhasil! Mengarahkan ke halaman login..."
      );

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch {
      showToast("error", "Terjadi kesalahan. Silakan coba lagi nanti.");
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { number: 1, label: "Akun" },
    { number: 2, label: "Data Diri" },
    { number: 3, label: "Data Medis" },
  ];

  return (
    <>
      {/* Toast */}
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

      <div className="p-8 sm:p-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl mb-3 shadow-md shadow-teal-500/20">
            <Heart className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Daftar Akun Baru</h2>
          <p className="text-sm text-slate-500 mt-1">
            Buat akun untuk mengakses layanan klinik
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-8 px-2">
          {steps.map((step, i) => (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    currentStep > step.number
                      ? "bg-primary-600 text-white"
                      : currentStep === step.number
                      ? "bg-primary-600 text-white ring-4 ring-primary-100"
                      : "bg-border text-slate-400"
                  }`}
                >
                  {currentStep > step.number ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1.5 font-medium transition-colors ${
                    currentStep >= step.number
                      ? "text-primary-700"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 mx-2 mt-[-14px]">
                  <div
                    className={`h-0.5 rounded-full transition-all duration-300 ${
                      currentStep > step.number
                        ? "bg-primary-500"
                        : "bg-border"
                    }`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Account */}
        {currentStep === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleNextStep();
            }}
            className="space-y-4 animate-fadeIn"
          >
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  placeholder="nama@email.com"
                  {...step1Form.register("email")}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              {step1Form.formState.errors.email && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {step1Form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimal 8 karakter"
                  {...step1Form.register("password")}
                  className="w-full pl-10 pr-11 py-2.5 bg-surface border border-border rounded-xl text-sm text-foreground placeholder:text-slate-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-500 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {step1Form.formState.errors.password && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {step1Form.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Konfirmasi Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Ulangi password"
                  {...step1Form.register("confirmPassword")}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              {step1Form.formState.errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {step1Form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold py-2.5 text-sm rounded-xl transition-all duration-200 shadow-md shadow-teal-600/25 hover:shadow-lg hover:shadow-teal-600/30 hover:-translate-y-0.5 mt-2"
            >
              <span>Lanjutkan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Step 2: Personal Info */}
        {currentStep === 2 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleNextStep();
            }}
            className="space-y-4 animate-fadeIn"
          >
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nama Lengkap
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap"
                  {...step2Form.register("fullName")}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              {step2Form.formState.errors.fullName && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {step2Form.formState.errors.fullName.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nomor Telepon
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Phone className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="tel"
                  placeholder="08123456789"
                  {...step2Form.register("phone")}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              {step2Form.formState.errors.phone && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {step2Form.formState.errors.phone.message}
                </p>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Alamat Lengkap
              </label>
              <div className="relative">
                <div className="absolute top-3 left-0 pl-3.5 flex items-start pointer-events-none">
                  <MapPin className="w-4 h-4 text-slate-400" />
                </div>
                <textarea
                  placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota"
                  rows={3}
                  {...step2Form.register("address")}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all resize-none hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              {step2Form.formState.errors.address && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {step2Form.formState.errors.address.message}
                </p>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handlePrevStep}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold py-2.5 text-sm rounded-xl transition-all duration-200 shadow-md shadow-teal-600/25 hover:shadow-lg hover:shadow-teal-600/30 hover:-translate-y-0.5"
              >
                <span>Lanjutkan</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Medical Data */}
        {currentStep === 3 && (
          <form
            onSubmit={step3Form.handleSubmit(onSubmitStep3)}
            className="space-y-4 animate-fadeIn"
          >
            {/* NIK */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                NIK (Nomor Induk Kependudukan)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="16 digit NIK"
                  maxLength={16}
                  {...step3Form.register("nik")}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 transition-all hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              {step3Form.formState.errors.nik && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {step3Form.formState.errors.nik.message}
                </p>
              )}
            </div>

            {/* Birth Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tanggal Lahir
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="date"
                  {...step3Form.register("birthDate")}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-foreground transition-all"
                />
              </div>
              {step3Form.formState.errors.birthDate && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {step3Form.formState.errors.birthDate.message}
                </p>
              )}
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Jenis Kelamin
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <select
                  {...step3Form.register("gender")}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 transition-all appearance-none hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Pilih jenis kelamin</option>
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              {step3Form.formState.errors.gender && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {step3Form.formState.errors.gender.message}
                </p>
              )}
            </div>

            {/* Blood Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Golongan Darah
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Droplets className="w-4 h-4 text-slate-400" />
                </div>
                <select
                  {...step3Form.register("bloodType")}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 transition-all appearance-none hover:border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Pilih golongan darah</option>
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </div>
              {step3Form.formState.errors.bloodType && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {step3Form.formState.errors.bloodType.message}
                </p>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handlePrevStep}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold py-2.5 text-sm rounded-xl transition-all duration-200 shadow-md shadow-teal-600/25 hover:shadow-lg hover:shadow-teal-600/30 hover:-translate-y-0.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mendaftar...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Daftar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Login Link */}
        <div className="text-center mt-6">
          <p className="text-sm text-slate-500">
            Sudah punya akun?{" "}
            <Link
              href="/login"
              className="text-teal-600 hover:text-teal-700 font-semibold transition-colors"
            >
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

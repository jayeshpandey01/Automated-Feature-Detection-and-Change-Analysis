"use client"

import React, { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Loader2, ShieldCheck, Mail, KeyRound, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LoginPage() {
  const { sendOTP, verifyOTP, loginWithFirebaseMock, error } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    const success = await sendOTP(email);
    setLoading(false);

    if (success) {
      toast.success("OTP sent to your email!");
      setStep("otp");
    } else {
      toast.error(error || "Failed to send OTP. Please check your backend.");
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    setLoading(true);
    const success = await verifyOTP(email, otp);
    setLoading(false);

    if (success) {
      toast.success("Successfully logged in!");
      router.push("/dashboard");
    } else {
      toast.error(error || "Invalid OTP code. Please try again.");
    }
  };

  const handleDemoFirebaseLogin = async () => {
    if (!email) {
      toast.error("Please enter your email to run the mock Firebase login.");
      return;
    }
    setLoading(true);
    const success = await loginWithFirebaseMock(email);
    setLoading(false);

    if (success) {
      toast.success("Firebase authentication successful!");
      router.push("/dashboard");
    } else {
      toast.error(error || "Firebase authentication failed.");
    }
  };

  return (
    <main className="min-h-screen bg-background relative overflow-hidden flex flex-col justify-between">
      <Header />
      
      {/* Visual background neon glow effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-neon-cyan/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-neon-blue/10 blur-[100px] pointer-events-none" />

      <section className="pt-40 pb-20 flex-grow flex items-center justify-center px-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md glass-panel p-8 md:p-10 rounded-3xl border border-glass-border/40 relative overflow-hidden bg-black/40 backdrop-blur-lg"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan mb-4">
              <ShieldCheck size={28} />
            </div>
            <h1 className="font-serif text-3xl font-light tracking-wide neon-text">COMMAND CENTER</h1>
            <p className="text-xs tracking-[0.2em] text-muted-foreground mt-2 uppercase">GlacioWatch Authentication</p>
          </div>

          <AnimatePresence mode="wait">
            {step === "email" ? (
              <motion.form
                key="email-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleSendOTP}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-xs tracking-[0.2em] text-muted-foreground uppercase block font-semibold">
                    EMAIL ADDRESS
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-4 h-4" />
                    <input
                      type="email"
                      required
                      placeholder="name@organization.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-secondary/20 border border-glass-border rounded-xl py-3.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-neon-cyan focus:outline-none transition-colors font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:border-neon-cyan rounded-xl text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-50 font-semibold"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Send Verification Code <ArrowRight size={14} />
                    </>
                  )}
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-glass-border"></div>
                  <span className="flex-shrink mx-4 text-[10px] tracking-widest text-muted-foreground uppercase">or sign in with</span>
                  <div className="flex-grow border-t border-glass-border"></div>
                </div>

                <button
                  type="button"
                  onClick={handleDemoFirebaseLogin}
                  disabled={loading}
                  className="w-full py-3.5 bg-neon-blue/5 hover:bg-neon-blue/15 text-neon-blue border border-neon-blue/30 hover:border-neon-blue/60 rounded-xl text-[11px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Demo Authenticate (Mock Firebase)
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="otp-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleVerifyOTP}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-xs tracking-[0.2em] text-muted-foreground uppercase block font-semibold">
                    ENTER 6-DIGIT OTP
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-4 h-4" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      pattern="\d{6}"
                      placeholder="------"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-secondary/20 border border-glass-border rounded-xl py-3.5 pl-11 pr-4 text-center text-lg tracking-[0.5em] text-foreground font-mono focus:border-neon-cyan focus:outline-none transition-colors"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/80 mt-1">
                    Sent to: <span className="text-foreground font-mono">{email}</span>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:border-neon-cyan rounded-xl text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-50 font-semibold"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Verify & Access Command Center"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="w-full text-center text-[10px] tracking-widest text-muted-foreground hover:text-foreground uppercase transition-colors"
                >
                  Change Email / Go Back
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      <Footer />
    </main>
  );
}

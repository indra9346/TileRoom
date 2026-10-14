import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams, Navigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TileScene } from "@/components/ui/TileScene";
import { SDSLogo } from "@/components/ui/SDSLogo";

/** Self-serve account creation: anyone can register and gets a private workspace (own designs, tiles and credits). */
const SIGNUP_ENABLED = true;

const perks = [
  "Upload a photo of your unfinished room",
  "Browse genuine tiles from verified showroom catalogs",
  "See a photorealistic preview before the first tile is fixed",
  "Compare 3 tiles in your real space to choose with confidence",
];

function EyeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function EyeOffIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

export function LoginPage() {
  const { user, signInWithPassword, signUpWithPassword, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname: string } } };

  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    SIGNUP_ENABLED && params.get("mode") === "signup" ? "signup" : "signin"
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const destination = location.state?.from?.pathname ?? "/projects";

  if (user) return <Navigate to={destination} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setAwaitingConfirmation(false);

    if (mode === "signup") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify your password.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error: err } = await signInWithPassword(email, password);
        if (err) {
          setError(err);
        } else {
          navigate(destination);
        }
      } else {
        const { error: err, needsConfirmation } = await signUpWithPassword(email, password, fullName);
        if (err) {
          setError(err);
        } else if (needsConfirmation) {
          setAwaitingConfirmation(true);
          setInfo("Account created! Check your email for a confirmation link to sign in.");
        } else {
          navigate(destination);
        }
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (!email) return;
    const { error: err } = await resendConfirmation(email);
    if (err) setError(err);
    else setInfo(`Confirmation email re-sent to ${email.trim()}.`);
  }

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[#F1ECE3] lg:block">
        <TileScene scene="terrazzo" className="absolute inset-0 h-full w-full" />
        <div className="relative flex h-full flex-col justify-between p-10 text-stone-900">
          <div className="flex items-center">
            <div className="rounded-2xl bg-white/85 px-4 py-3 shadow-lg backdrop-blur-md">
              <SDSLogo size="lg" variant="dark" subtitle="Virtual Trial Room" />
            </div>
          </div>

          <div className="mb-4 rounded-2xl bg-white/85 p-7 shadow-lg backdrop-blur-md">
            <span className="rounded-full border border-clay-300 bg-clay-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-clay-800">
              The Virtual Trial Room for Your Home
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-stone-900">
              See your finished room before the first tile is laid.
            </h2>
            <ul className="mt-6 space-y-3 text-stone-700">
              {perks.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-clay-600 text-xs font-bold text-white">✓</span>
                  <span className="text-sm">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-stone-700">
            &copy; {new Date().getFullYear()} TileRoom. All rights reserved.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden">
            <SDSLogo size="md" variant="dark" subtitle="Virtual Trial Room" />
          </div>

          {/* Mode Switcher Tabs */}
          {SIGNUP_ENABLED && (
            <div className="mb-6 grid grid-cols-2 rounded-xl bg-stone-100 p-1 border border-stone-200">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfo(null);
                  setAwaitingConfirmation(false);
                }}
                className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                  mode === "signin"
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfo(null);
                  setAwaitingConfirmation(false);
                }}
                className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                  mode === "signup"
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          <h1 className="font-display text-3xl font-bold text-stone-900 sm:text-4xl">
            {mode === "signin" ? "Welcome Back" : "Create Your Account"}
          </h1>
          <p className="mt-2 text-stone-600">
            {mode === "signin"
              ? "Sign in to continue your virtual trial projects."
              : "Register your showroom account to start rendering rooms with real tiles."}
          </p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            {mode === "signup" && (
              <div>
                <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-stone-700">
                  Full Name / Showroom Name
                </label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="e.g. Indra Tiles & Studio"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-stone-700">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-stone-700">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder={mode === "signup" ? "Create a password (min. 6 characters)" : "Your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition focus:outline-none"
                >
                  {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-stone-700">
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
                {passwordsMatch && (
                  <p className="mt-1 text-xs text-emerald-600 font-medium">✓ Passwords match</p>
                )}
                {passwordsMismatch && (
                  <p className="mt-1 text-xs text-amber-600 font-medium">Passwords do not match yet</p>
                )}
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 border border-red-200">
                {error}
              </p>
            )}
            {info && (
              <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 border border-emerald-200">
                {info}
              </p>
            )}
            {awaitingConfirmation && email && (
              <button
                type="button"
                onClick={onResend}
                className="text-sm font-medium text-clay-700 underline underline-offset-2 hover:text-clay-900"
              >
                Resend confirmation email
              </button>
            )}

            <Button type="submit" size="lg" className="w-full shadow-md" loading={submitting}>
              {mode === "signin" ? "Sign In to Trial Room →" : "Create Account & Start Trial →"}
            </Button>
          </form>

          {SIGNUP_ENABLED && (
            <p className="mt-6 text-center text-sm text-stone-600">
              {mode === "signin" ? "New to TileRoom? " : "Already have an account? "}
              <button
                type="button"
                className="font-semibold text-clay-700 hover:underline"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                  setInfo(null);
                  setAwaitingConfirmation(false);
                }}
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
          )}

          <div className="mt-8 border-t border-stone-200 pt-6 text-center">
            <Link to="/" className="text-xs text-stone-500 hover:text-stone-900 transition">
              ← Back to TileRoom Home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

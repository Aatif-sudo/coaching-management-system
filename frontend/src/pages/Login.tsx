import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { pushToast } = useToast();
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("Admin@123");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const user = await login(email, password);
      pushToast("success", "Login successful");
      navigate(user.role === "STUDENT" ? "/student" : "/admin");
    } catch (error) {
      pushToast("error", "Invalid credentials or server unavailable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-mist via-cream to-sand px-4">
      <div className="w-full max-w-md rounded-2xl border border-sand bg-white p-6 shadow-card sm:p-8">
        <h1 className="font-display text-2xl text-charcoal">Welcome Back</h1>
        <p className="mt-1 text-sm text-charcoal/70">Login to manage your coaching institute operations.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-charcoal/70">
              Email
            </label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-charcoal/70">
              Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-5 rounded-lg border border-sand bg-mist px-3 py-2 text-xs text-charcoal/80">
          Demo credentials:
          <p>`admin@demo.com / Admin@123`</p>
          <p>`teacher@demo.com / Teacher@123`</p>
          <p>`student1@demo.com / Student@123`</p>
        </div>
      </div>
    </div>
  );
}


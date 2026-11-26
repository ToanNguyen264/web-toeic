import { Eye, EyeOff, LockKeyhole, Mail, MoveRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { toUserMessage } from "../utils/errors";
import { validateEmail } from "../utils/validation";

type LocationState = { from?: { pathname?: string } } | null;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { signIn } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!validateEmail(email)) nextErrors.email = "Email không đúng định dạng.";
    if (!password) nextErrors.password = "Vui lòng nhập mật khẩu.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      setLoading(true);
      await signIn(email, password);
      showToast("Đăng nhập thành công.", "success");
      const state = location.state as LocationState;
      navigate(state?.from?.pathname || "/listen", { replace: true });
    } catch (error) {
      showToast(toUserMessage(error, "Không thể đăng nhập. Vui lòng thử lại."), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          Chào mừng trở lại
        </span>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
          Đăng nhập để tiếp tục
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Mở lại kho từ vựng và luyện nghe của riêng bạn.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="email"
          name="email"
          label="Địa chỉ email"
          type="email"
          autoComplete="email"
          placeholder="ban@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          leadingIcon={<Mail className="h-4 w-4" />}
        />
        <TextField
          id="password"
          name="password"
          label="Mật khẩu"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          leadingIcon={<LockKeyhole className="h-4 w-4" />}
          trailingContent={
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <Button
          type="submit"
          loading={loading}
          className="w-full"
        >
          Đăng nhập
          {!loading && <MoveRight className="h-4 w-4" />}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">
        Chưa có tài khoản?{" "}
        <Link
          to="/register"
          className="font-bold text-indigo-600 transition hover:text-indigo-700 hover:underline dark:text-indigo-400"
        >
          Đăng ký ngay
        </Link>
      </p>
    </AuthLayout>
  );
}

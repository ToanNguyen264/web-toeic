import { Eye, EyeOff, LockKeyhole, Mail, MoveRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { toUserMessage } from "../utils/errors";
import { validateEmail } from "../utils/validation";

type RegisterErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const { signUp } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: RegisterErrors = {};
    if (!validateEmail(email)) nextErrors.email = "Email không đúng định dạng.";
    if (password.length < 8)
      nextErrors.password = "Mật khẩu phải có ít nhất 8 ký tự.";
    if (confirmPassword !== password)
      nextErrors.confirmPassword = "Mật khẩu xác nhận chưa khớp.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      setLoading(true);
      await signUp(email, password);
      showToast("Tạo tài khoản thành công.", "success");
      navigate("/listen", { replace: true });
    } catch (error) {
      showToast(toUserMessage(error, "Không thể tạo tài khoản. Vui lòng thử lại."), "error");
    } finally {
      setLoading(false);
    }
  }

  const passwordScore = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password ? 1 : 0;

  return (
    <AuthLayout>
      <div className="mb-8">
        <span className="inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
          Bắt đầu miễn phí
        </span>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
          Tạo kho từ vựng riêng
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Không cần xác minh email. Đăng ký và bắt đầu lưu từ ngay.
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
          autoComplete="new-password"
          placeholder="Tối thiểu 8 ký tự"
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
        <div
          role="meter"
          aria-label="Độ mạnh mật khẩu"
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={passwordScore}
          aria-valuetext={
            passwordScore === 3
              ? "Mạnh"
              : passwordScore === 2
                ? "Đạt yêu cầu"
                : passwordScore === 1
                  ? "Yếu"
                  : "Chưa nhập"
          }
          className="grid grid-cols-3 gap-2"
        >
          {[1, 2, 3].map((level) => (
            <span
              key={level}
              aria-hidden="true"
              className={`h-1.5 rounded-full transition ${
                passwordScore >= level
                  ? passwordScore === 3
                    ? "bg-emerald-500"
                    : "bg-indigo-500"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
        <TextField
          id="confirm-password"
          name="confirmPassword"
          label="Xác nhận mật khẩu"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
          leadingIcon={<LockKeyhole className="h-4 w-4" />}
        />
        <Button
          type="submit"
          loading={loading}
          className="w-full"
        >
          Tạo tài khoản
          {!loading && <MoveRight className="h-4 w-4" />}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">
        Đã có tài khoản?{" "}
        <Link
          to="/login"
          className="font-bold text-indigo-600 transition hover:text-indigo-700 hover:underline dark:text-indigo-400"
        >
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}

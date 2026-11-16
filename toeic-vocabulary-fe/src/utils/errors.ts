export function toUserMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.toLowerCase();

  if (message.includes("email hoặc mật khẩu") || message.includes("invalid credentials")) {
    return "Email hoặc mật khẩu không đúng.";
  }
  if (message.includes("đã được đăng ký") || message.includes("email exists")) {
    return "Email này đã được đăng ký.";
  }
  if (message.includes("password should be")) {
    return "Mật khẩu chưa đáp ứng yêu cầu tối thiểu.";
  }
  if (message.includes("kết nối") || message.includes("failed to fetch") || message.includes("network")) {
    return "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.";
  }
  return error.message || fallback;
}

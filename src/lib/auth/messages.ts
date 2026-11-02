export function authMessage(message: string | undefined, fallback: string) {
  const text = message ?? "";
  if (/already|exist/i.test(text)) return "这个邮箱已经注册";
  if (/invalid email or password|invalid credentials/i.test(text)) return "邮箱或密码不正确";
  if (/password/i.test(text)) return "密码不符合要求";
  return text || fallback;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email)
}

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password.length > 0 && password === confirmPassword
}

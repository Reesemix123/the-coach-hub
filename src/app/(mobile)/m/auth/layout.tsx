/**
 * Auth layout — inherits from the (mobile) layout which hides header/nav
 * on /m/auth/* paths. This is a pass-through; ThemeProvider comes from parent.
 */
export default function MobileAuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

// app/admin/layout.tsx
import AuthWrapper from '@/components/admin/auth-wrapper';
import { isAuthenticated } from '@/app/actions/config';

// Force dynamic rendering to prevent static generation issues with cookies
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authenticated = await isAuthenticated();
  
  return <AuthWrapper isAuthenticated={authenticated}>{children}</AuthWrapper>
}

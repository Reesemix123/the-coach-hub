// Server component wrapper - forces dynamic rendering
export const dynamic = 'force-dynamic';

import HomePage from '@/components/home/HomePage';

export default function Page() {
  return <HomePage />;
}

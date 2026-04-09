import { redirect } from 'next/navigation';

export default function GenerateRedirect() {
  redirect('/test-hub/admin?tab=generate');
}

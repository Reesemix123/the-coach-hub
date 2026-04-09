import { redirect } from 'next/navigation';

export default function ReviewRedirect() {
  redirect('/test-hub/admin?tab=review');
}

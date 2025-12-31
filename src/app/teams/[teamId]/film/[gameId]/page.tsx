// Redirect /teams/{teamId}/film/{gameId} to /teams/{teamId}/film/{gameId}/tag
// This prevents 404 errors when users have old bookmarks or manually type URLs

import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ teamId: string; gameId: string }>;
}

export default async function GameFilmRedirect({ params }: Props) {
  const { teamId, gameId } = await params;
  redirect(`/teams/${teamId}/film/${gameId}/tag`);
}

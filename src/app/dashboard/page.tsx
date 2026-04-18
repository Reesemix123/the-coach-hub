import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Video } from 'lucide-react';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import DashboardAvatar from './DashboardAvatar';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TeamRow {
  id: string;
  name: string;
  level: string | null;
  sport: string | null;
}

interface UpcomingGame {
  id: string;
  opponent: string | null;
  date: string;
  start_time: string | null;
  game_result: string | null;
  team_score: number | null;
  opponent_score: number | null;
}

interface RecentGame {
  id: string;
  opponent: string | null;
  date: string;
  game_result: string | null;
  team_score: number | null;
  opponent_score: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(timeStr: string): string {
  // timeStr is HH:MM:SS or HH:MM from Postgres time column
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return minute === '00' ? `${displayHour} ${ampm}` : `${displayHour}:${minute} ${ampm}`;
}

function getSmartContext(
  nextGame: UpcomingGame | null,
  lastGame: RecentGame | null,
  gamesCount: number
): string {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  if (nextGame) {
    if (nextGame.date === today) {
      const time = nextGame.start_time ? formatTime(nextGame.start_time) : '';
      return `Game day · vs. ${nextGame.opponent ?? 'TBD'}${time ? ` · ${time}` : ''}`;
    }
    if (nextGame.date <= nextWeek) {
      const day = new Date(nextGame.date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
      });
      return `Next up · vs. ${nextGame.opponent ?? 'TBD'} · ${day}`;
    }
  }

  if (
    lastGame?.date === yesterday &&
    lastGame.game_result &&
    lastGame.team_score != null &&
    lastGame.opponent_score != null
  ) {
    const resultLabel =
      lastGame.game_result === 'win'
        ? 'Win'
        : lastGame.game_result === 'loss'
        ? 'Loss'
        : 'Tie';
    return `Last · vs. ${lastGame.opponent ?? 'TBD'} · ${resultLabel} ${lastGame.team_score}–${lastGame.opponent_score}`;
  }

  if (gamesCount > 0) return `${gamesCount} game${gamesCount !== 1 ? 's' : ''} this season`;
  return 'Get started with your first season';
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();

  // Auth — layout already checks, but we need the user object for queries
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single();

  // Film Capture access
  const { data: captureProfile } = await supabase
    .from('profiles')
    .select('film_capture_access')
    .eq('id', user.id)
    .maybeSingle();
  const hasFilmCapture = captureProfile?.film_capture_access === true;

  // Check if coach also has a parent profile (for dual-role card)
  const serviceClient = createServiceClient();
  const { data: parentProfile } = await serviceClient
    .from('parent_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  let parentAthleteLabel: string | null = null;
  if (parentProfile) {
    const { data: athletes } = await serviceClient
      .from('athlete_profiles')
      .select('athlete_first_name')
      .eq('created_by_parent_id', parentProfile.id);

    if (athletes && athletes.length === 1) {
      parentAthleteLabel = athletes[0].athlete_first_name;
    } else if (athletes && athletes.length > 1) {
      parentAthleteLabel = `${athletes.length} athletes`;
    } else {
      parentAthleteLabel = 'Set up athlete profile';
    }
  }

  // Owned teams
  const { data: ownedTeams } = await supabase
    .from('teams')
    .select('id, name, level, sport')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Member teams (not owned)
  const { data: membershipRows } = await supabase
    .from('team_memberships')
    .select('team_id, teams(id, name, level, sport)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const memberTeams: TeamRow[] = (membershipRows ?? [])
    .map((row) => {
      const t = row.teams as unknown as TeamRow | null;
      return t ?? null;
    })
    .filter((t): t is TeamRow => t !== null);

  const allTeams: TeamRow[] = [...(ownedTeams ?? []), ...memberTeams];

  // Primary team — first owned, otherwise first membership
  const primaryTeam: TeamRow | null = allTeams[0] ?? null;
  const primaryTeamId = primaryTeam?.id ?? null;

  // Per-team game data (only if we have a primary team)
  let nextGame: UpcomingGame | null = null;
  let lastGame: RecentGame | null = null;
  let gamesCount = 0;

  if (primaryTeamId) {
    const now = new Date().toISOString().split('T')[0];

    const [upcomingResult, recentResult, countResult] = await Promise.all([
      supabase
        .from('games')
        .select('id, opponent, date, start_time, game_result, team_score, opponent_score')
        .eq('team_id', primaryTeamId)
        .eq('game_type', 'team')
        .gte('date', now)
        .order('date', { ascending: true })
        .limit(1),

      supabase
        .from('games')
        .select('id, opponent, date, game_result, team_score, opponent_score')
        .eq('team_id', primaryTeamId)
        .eq('game_type', 'team')
        .lt('date', now)
        .order('date', { ascending: false })
        .limit(1),

      supabase
        .from('games')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', primaryTeamId)
        .eq('game_type', 'team'),
    ]);

    nextGame = (upcomingResult.data?.[0] as UpcomingGame) ?? null;
    lastGame = (recentResult.data?.[0] as RecentGame) ?? null;
    gamesCount = countResult.count ?? 0;
  }

  // Derived display values
  const fullName = profile?.full_name || profile?.email || user.email || 'Coach';
  const lastName = fullName.split(' ').pop() || fullName;
  const initial = fullName.charAt(0).toUpperCase();
  const greeting = getGreeting();
  const hasMultipleTeams = allTeams.length > 1;

  return (
    <div
      className="min-h-screen bg-[#1a1410]"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif" }}
    >
      {/* Background image */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 bg-cover bg-no-repeat"
          style={{
            backgroundImage: 'url(/marketing/friday-night-lacrosse-v2.png)',
            backgroundPosition: 'center 40%',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1410]/40 via-[#1a1410]/60 to-[#1a1410]/95" />
      </div>

      {/* Navbar */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm"
        style={{
          background: 'rgba(26,20,16,.65)',
          borderBottom: '1px solid rgba(255,255,255,.08)',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-8 flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <img
              src="/logo-darkmode.png"
              alt="Youth Coach Hub"
              className="h-8 sm:h-10 w-auto"
            />
            <span className="hidden sm:inline text-white font-semibold text-lg tracking-tight">
              youth<span style={{ color: '#B8CA6E' }}>coach</span>hub
            </span>
          </div>
          <DashboardAvatar initial={initial} fullName={fullName} hasParentProfile={!!parentProfile} />
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-8 pt-24 pb-16">
        {/* Greeting */}
        <div className="mt-8">
          <p className="text-lg font-semibold" style={{ color: 'rgba(249,250,251,0.72)' }}>
            {greeting}
          </p>
          <h1
            className="text-4xl font-black tracking-tight mt-1"
            style={{ color: '#F9FAFB' }}
          >
            Coach {lastName}
          </h1>
        </div>

        {/* YOUR TEAMS label */}
        <div className="flex items-center justify-between mt-10 mb-4">
          <p
            className="text-xs font-black tracking-widest uppercase"
            style={{ color: '#B8CA6E' }}
          >
            Your Teams
          </p>
          {hasMultipleTeams && (
            <a
              href="/football/teams"
              className="text-xs font-semibold transition-opacity hover:opacity-100"
              style={{ color: '#B8CA6E', opacity: 0.8 }}
            >
              View all teams &rarr;
            </a>
          )}
        </div>

        {/* Team Cards — one per team */}
        {allTeams.length > 0 ? (
          <div className="flex flex-col gap-3">
            {allTeams.map((team) => (
              <div
                key={team.id}
                className="rounded-xl border-l-[3px] overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderLeft: '3px solid #B8CA6E',
                }}
              >
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg leading-none">🏈</span>
                        <span
                          className="text-xs font-black tracking-widest uppercase"
                          style={{ color: 'rgba(249,250,251,0.50)' }}
                        >
                          Football
                        </span>
                        {team.level && (
                          <span
                            className="text-xs font-medium rounded-full px-2 py-0.5"
                            style={{
                              background: 'rgba(255,255,255,0.08)',
                              color: 'rgba(249,250,251,0.60)',
                            }}
                          >
                            {team.level}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-lg font-bold leading-snug truncate"
                        style={{ color: '#F9FAFB' }}
                      >
                        {team.name}
                      </p>
                    </div>
                    <a
                      href={`/football/teams/${team.id}`}
                      className="flex-shrink-0 self-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                      style={{ background: '#B8CA6E', color: '#1a1410' }}
                    >
                      Open &rarr;
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* No teams empty state */
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div className="px-5 py-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl leading-none">🏈</span>
                    <span
                      className="text-xs font-black tracking-widest uppercase"
                      style={{ color: 'rgba(249,250,251,0.50)' }}
                    >
                      Football
                    </span>
                  </div>
                  <p className="text-base font-semibold" style={{ color: '#F9FAFB' }}>
                    Get started with your first team
                  </p>
                  <p
                    className="text-sm mt-1"
                    style={{ color: 'rgba(249,250,251,0.50)' }}
                  >
                    Create a team to unlock the full platform.
                  </p>
                </div>
                <a
                  href="/setup"
                  className="flex-shrink-0 self-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: '#B8CA6E', color: '#1a1410' }}
                >
                  Create team &rarr;
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Parent view card — only shown if coach also has a parent profile */}
        {parentProfile && (
          <div
            className="rounded-xl overflow-hidden mt-4"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div className="px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg leading-none">👤</span>
                    <span
                      className="text-xs font-black tracking-widest uppercase"
                      style={{ color: 'rgba(249,250,251,0.50)' }}
                    >
                      Parent view
                    </span>
                  </div>
                  <p
                    className="text-base font-bold leading-snug truncate"
                    style={{ color: '#F9FAFB' }}
                  >
                    {parentAthleteLabel}
                  </p>
                </div>
                <a
                  href="/parent"
                  className="flex-shrink-0 self-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: '#B8CA6E', color: '#1a1410' }}
                >
                  Switch →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Film Capture card — only shown if user has film_capture_access */}
        {hasFilmCapture && (
          <div
            className="rounded-xl overflow-hidden mt-4"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div className="px-5 py-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Video className="w-5 h-5" style={{ color: '#B8CA6E' }} />
                    <span
                      className="text-xs font-black tracking-widest uppercase"
                      style={{ color: 'rgba(249,250,251,0.50)' }}
                    >
                      Film Capture
                    </span>
                  </div>
                  <p className="text-base font-semibold" style={{ color: '#F9FAFB' }}>
                    Upload and manage game film
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(249,250,251,0.50)' }}>
                    Across all sports.
                  </p>
                </div>
                <Link
                  href="/film-capture"
                  className="flex-shrink-0 self-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: '#B8CA6E', color: '#1a1410' }}
                >
                  Open →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* MORE SPORTS label */}
        <p
          className="text-xs font-black tracking-widest uppercase mt-8 mb-4"
          style={{ color: '#B8CA6E' }}
        >
          More Sports
        </p>

        {/* Coming soon grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Baseball card */}
          <a
            href="/baseball"
            className="rounded-xl px-5 py-4 flex items-center gap-3 transition-colors"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span className="text-2xl leading-none">⚾</span>
            <div>
              <p className="text-sm font-bold" style={{ color: '#F9FAFB' }}>
                Baseball
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(249,250,251,0.40)' }}>
                Coming soon
              </p>
            </div>
          </a>

          {/* Basketball card */}
          <div
            className="rounded-xl px-5 py-4 flex items-center gap-3"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span className="text-2xl leading-none">🏀</span>
            <div>
              <p className="text-sm font-bold" style={{ color: '#F9FAFB' }}>
                Basketball
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(249,250,251,0.40)' }}>
                Coming soon
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          className="mt-10 mb-6"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        />

        {/* Account strip */}
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { label: 'Profile', href: '/settings/profile' },
            { label: 'Billing', href: '/settings/billing' },
            { label: 'Notifications', href: '/settings/notifications' },
            { label: 'Support', href: '/support' },
          ].map((link, index, arr) => (
            <span key={link.href} className="flex items-center">
              <a
                href={link.href}
                className="text-sm transition-colors hover:opacity-100"
                style={{ color: 'rgba(249,250,251,0.45)' }}
              >
                {link.label}
              </a>
              {index < arr.length - 1 && (
                <span
                  className="mx-2 text-xs select-none"
                  style={{ color: 'rgba(255,255,255,0.15)' }}
                >
                  ·
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

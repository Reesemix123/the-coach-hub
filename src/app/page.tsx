'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { createClient } from '@/utils/supabase/client';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    checkUserTeams();
  }, []);

  async function checkUserTeams() {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in - show homepage
        setLoading(false);
        return;
      }

      // Check if user owns any teams
      const { data: ownedTeams } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (ownedTeams && ownedTeams.length > 0) {
        // User has a team - redirect to first team
        router.push(`/teams/${ownedTeams[0].id}`);
        return;
      }

      // TODO: Later check for invited teams via team_memberships table
      // For now, show homepage if no owned teams
      setLoading(false);
    } catch (error) {
      console.error('Error checking teams:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="bg-white">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-8 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-semibold text-gray-900 mb-4 tracking-tight">
            Football Coaching
            <span className="block mt-2">Made More Efficient</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            So you can do what matters most: COACH
          </p>

          <div className="flex flex-col items-center gap-4">
            <Link
              href="/pricing"
              className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
            >
              View solutions and pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-3xl font-semibold text-gray-900 text-center mb-12">
            Everything you need to coach effectively
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="text-center">
              <div className="mb-6">
                <svg className="w-12 h-12 text-gray-900 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Team Management</h3>
              <p className="text-gray-600 leading-relaxed">
                Organize your teams, track rosters, and manage schedules all in one place.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6">
                <svg className="w-12 h-12 text-gray-900 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Digital Playbook</h3>
              <p className="text-gray-600 leading-relaxed">
                Build and organize your playbook with visual diagrams and play codes.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6">
                <svg className="w-12 h-12 text-gray-900 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Game Planning</h3>
              <p className="text-gray-600 leading-relaxed">
                Create game plans, build wristbands, and organize practice schedules.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6">
                <svg className="w-12 h-12 text-gray-900 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Film Analysis</h3>
              <p className="text-gray-600 leading-relaxed">
                Upload and review game film, tag plays, and track performance analytics.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
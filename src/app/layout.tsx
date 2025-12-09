import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import ScrollingNavbar from "@/components/ScrollingNavbar";
import UserMenu from "@/components/UserMenu";
import TeamSwitcher from "@/components/TeamSwitcher";
import ConsoleLink from "@/components/ConsoleLink";
import AdminLink from "@/components/AdminLink";
import TourButton from "@/components/TourButton";
import { GlobalOnboardingProvider, OnboardingTourModal, OnboardingChecklist } from "@/components/onboarding";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Youth Coach Hub",
  description: "Football coaching made simple",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <GlobalOnboardingProvider>
        <ScrollingNavbar>
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex justify-between items-center h-20">
              {/* Logo/Brand */}
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Image
                    src="/icon-512.png"
                    alt="Youth Coach Hub"
                    width={44}
                    height={44}
                    className="rounded-lg"
                    priority
                  />
                  <span className="text-2xl font-semibold text-gray-900 tracking-tight hidden sm:inline">
                    Youth Coach Hub
                  </span>
                </Link>

                {/* Team Context */}
                <div className="hidden md:flex items-center gap-6">
                  <TeamSwitcher />
                  <TourButton />
                  <ConsoleLink />
                  <AdminLink />
                </div>
              </div>
              {/* User Menu */}
              <UserMenu />
            </div>
          </div>
        </ScrollingNavbar>

        <main className="pt-24">
          {children}
        </main>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />

        {/* Onboarding components */}
        <OnboardingTourModal />
        <OnboardingChecklist />
        </GlobalOnboardingProvider>
      </body>
    </html>
  );
}
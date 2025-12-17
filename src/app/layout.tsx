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
import NavbarUtilities from "@/components/NavbarUtilities";
import PaymentWarningBanner from "@/components/PaymentWarningBanner";
import { GlobalOnboardingProvider, OnboardingTourModal, OnboardingChecklist } from "@/components/onboarding";
import { GuideProvider } from "@/contexts/GuideContext";
import { GuideSlideOver } from "@/components/guide";
import { ChatWidget } from "@/components/chat";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Youth Coach Hub",
  description: "Football coaching made simple",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
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
        <GuideProvider>
        <GlobalOnboardingProvider>
        <ScrollingNavbar>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20">
              {/* Logo/Brand */}
              <div className="flex items-center gap-8">
                <Link href="/" className="flex-shrink-0 flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Image
                    src="/apple-touch-icon.png"
                    alt="Youth Coach Hub"
                    width={40}
                    height={40}
                    className="rounded-lg"
                    priority
                  />
                  <span className="text-2xl font-semibold text-gray-900 tracking-tight hidden sm:inline">
                    Youth Coach Hub
                  </span>
                </Link>

                {/* Team Context - Desktop */}
                <div className="hidden md:flex items-center gap-6">
                  <TeamSwitcher />
                  <ConsoleLink />
                  <AdminLink />
                </div>
                {/* Admin/Console - Mobile (always visible for authorized users) */}
                <div className="flex md:hidden items-center gap-3 ml-4">
                  <ConsoleLink />
                  <AdminLink />
                </div>
              </div>
              {/* User Utilities */}
              <div className="flex items-center gap-2">
                <TourButton />
                <NavbarUtilities />
                <UserMenu />
              </div>
            </div>
          </div>
        </ScrollingNavbar>

        {/* Payment warning banner - shows when payment is past due or suspended */}
        <div className="fixed top-20 left-0 right-0 z-40">
          <PaymentWarningBanner />
        </div>

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

        {/* Guide slide-over panel */}
        <GuideSlideOver />

        {/* Floating AI Assistant Chat Widget */}
        <ChatWidget />
        </GuideProvider>
      </body>
    </html>
  );
}
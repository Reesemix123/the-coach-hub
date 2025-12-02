import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import ScrollingNavbar from "@/components/ScrollingNavbar";
import UserMenu from "@/components/UserMenu";
import TeamSwitcher from "@/components/TeamSwitcher";
import ConsoleLink from "@/components/ConsoleLink";
import AdminLink from "@/components/AdminLink";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "The Coach Hub",
  description: "Football coaching made simple",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <ScrollingNavbar>
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex justify-between items-center h-20">
              {/* Logo/Brand */}
              <div className="flex items-center gap-8">
                <Link href="/" className="text-2xl font-semibold text-gray-900 hover:text-gray-700 transition-colors tracking-tight">
                  The Coach Hub
                </Link>

                {/* Team Context */}
                <div className="hidden md:flex items-center gap-6">
                  <TeamSwitcher />
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
      </body>
    </html>
  );
}
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import TeamSwitcher from "@/components/TeamSwitcher";
import ConsoleLink from "@/components/ConsoleLink";

export const metadata: Metadata = {
  title: "Titan First Read",
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
        <nav className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex justify-between items-center h-20">
              {/* Logo/Brand */}
              <div className="flex items-center gap-12">
                <Link href="/" className="text-2xl font-semibold text-gray-900 hover:text-indigo-600 transition-colors tracking-tight">
                  Titan First Read
                </Link>
                
                {/* Navigation Links */}
                <div className="hidden md:flex items-center gap-10">
                  <Link
                    href="/"
                    className="text-gray-800 hover:text-black font-medium text-lg transition-colors"
                  >
                    Home
                  </Link>
                  <TeamSwitcher />
                  <Link
                    href="/playbook"
                    className="text-gray-800 hover:text-black font-medium text-lg transition-colors"
                  >
                    Playbook Builder
                  </Link>
                  <Link
                    href="/film"
                    className="text-gray-800 hover:text-black font-medium text-lg transition-colors"
                  >
                    Film
                  </Link>
                  <ConsoleLink />
                </div>
              </div>
              {/* User Menu */}
              <UserMenu />
            </div>
          </div>
        </nav>
        
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
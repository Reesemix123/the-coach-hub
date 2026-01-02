/**
 * Contact Form API Route
 *
 * POST /api/contact
 * Handles public contact form submissions.
 * Saves to Supabase contact_submissions table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface ContactFormData {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

// Simple rate limiting using in-memory store (resets on server restart)
// For production, consider using Redis or database-based rate limiting
const submissions = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_SUBMISSIONS_PER_WINDOW = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const userSubmissions = submissions.get(ip) || [];

  // Filter out old submissions
  const recentSubmissions = userSubmissions.filter(
    time => now - time < RATE_LIMIT_WINDOW
  );

  submissions.set(ip, recentSubmissions);

  return recentSubmissions.length >= MAX_SUBMISSIONS_PER_WINDOW;
}

function recordSubmission(ip: string): void {
  const userSubmissions = submissions.get(ip) || [];
  userSubmissions.push(Date.now());
  submissions.set(ip, userSubmissions);
}

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Check rate limit
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = (await request.json()) as ContactFormData;
    const { name, email, subject, message } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Basic spam check - reject if message contains too many links
    const linkCount = (message.match(/https?:\/\//g) || []).length;
    if (linkCount > 3) {
      return NextResponse.json(
        { error: 'Message contains too many links' },
        { status: 400 }
      );
    }

    // Save to database
    const supabase = await createClient();

    const { error } = await supabase
      .from('contact_submissions')
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject?.trim() || null,
        message: message.trim(),
      });

    if (error) {
      console.error('Error saving contact submission:', error);
      return NextResponse.json(
        { error: 'Failed to submit form. Please try again.' },
        { status: 500 }
      );
    }

    // Record submission for rate limiting
    recordSubmission(ip);

    return NextResponse.json(
      { success: true, message: 'Thank you for your message! We\'ll get back to you soon.' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

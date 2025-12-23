// src/app/api/admin/feedback-email/route.ts
// Sends email notification to platform admins when new feedback is submitted

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { sendEmail, getNewFeedbackEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedbackId, type, description, pageUrl } = body;

    if (!feedbackId || !type || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get platform admin emails
    const { data: admins, error: adminError } = await supabase
      .from('profiles')
      .select('email')
      .eq('is_platform_admin', true);

    if (adminError) {
      console.error('Error fetching admin emails:', adminError);
      return NextResponse.json(
        { error: 'Failed to fetch admin emails' },
        { status: 500 }
      );
    }

    if (!admins || admins.length === 0) {
      console.log('No platform admins found to notify');
      return NextResponse.json({ success: true, message: 'No admins to notify' });
    }

    // Get admin emails (filter out nulls)
    const adminEmails = admins
      .map(a => a.email)
      .filter((email): email is string => !!email);

    if (adminEmails.length === 0) {
      console.log('No admin emails found');
      return NextResponse.json({ success: true, message: 'No admin emails found' });
    }

    // Generate email content
    const { subject, html, text } = getNewFeedbackEmail({
      feedbackType: type,
      description,
      pageUrl,
      feedbackId,
    });

    // Send email to all admins
    const result = await sendEmail({
      to: adminEmails,
      subject,
      html,
      text,
      tags: [
        { name: 'type', value: 'feedback-notification' },
        { name: 'feedback_id', value: feedbackId },
      ],
    });

    if (!result.success) {
      console.error('Failed to send feedback email:', result.error);
      return NextResponse.json(
        { error: 'Failed to send email', details: result.error },
        { status: 500 }
      );
    }

    console.log(`Feedback email sent to ${adminEmails.length} admin(s)`);
    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      recipientCount: adminEmails.length,
    });
  } catch (error) {
    console.error('Feedback email error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

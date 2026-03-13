/**
 * API: /api/communication/webhooks/twilio
 * POST - Twilio inbound SMS webhook
 *
 * Handles incoming SMS messages. SMS is one-way only — auto-responds
 * telling people to message their coach through the app.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import twilio from 'twilio';

const AUTO_RESPONSE_MESSAGE =
  "This number doesn't receive replies. Message your coach through the Youth Coach Hub app.";
const RATE_LIMIT_WINDOW_HOURS = 1;
const RATE_LIMIT_MAX_MESSAGES = 3;

export async function POST(request: NextRequest) {
  try {
    // Parse form-encoded body (Twilio sends application/x-www-form-urlencoded)
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    const from = params.From;
    const to = params.To;
    const body = params.Body || '';

    if (!from || !to) {
      return new NextResponse(twiml(null), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Validate Twilio signature
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = request.headers.get('x-twilio-signature');

    if (authToken && signature) {
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      const host = request.headers.get('host');
      const url = `${protocol}://${host}/api/communication/webhooks/twilio`;

      const isValid = twilio.validateRequest(authToken, signature, url, params);
      if (!isValid) {
        console.error('Twilio webhook: Invalid signature');
        return new NextResponse(twiml(null), {
          status: 403,
          headers: { 'Content-Type': 'text/xml' },
        });
      }
    } else if (!authToken) {
      console.warn('TWILIO_AUTH_TOKEN not configured — skipping signature validation');
    }

    // Rate limiting: max 3 auto-responses per phone per hour
    const supabase = await createClient();
    const oneHourAgo = new Date(
      Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: recentMessages } = await supabase
      .from('sms_auto_responses')
      .select('id')
      .eq('from_phone', from)
      .gte('created_at', oneHourAgo);

    const isRateLimited =
      recentMessages && recentMessages.length >= RATE_LIMIT_MAX_MESSAGES;

    // Log the inbound message
    await supabase.from('sms_auto_responses').insert({
      from_phone: from,
      to_phone: to,
      inbound_body: body,
      auto_response_sent: !isRateLimited,
    });

    if (isRateLimited) {
      return new NextResponse(twiml(null), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    return new NextResponse(twiml(AUTO_RESPONSE_MESSAGE), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('Twilio webhook error:', error);
    return new NextResponse(twiml(null), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

function twiml(message: string | null): string {
  if (!message) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>';
  }
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Message>${escaped}</Message>\n</Response>`;
}

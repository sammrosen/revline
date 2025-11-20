import { NextRequest, NextResponse } from 'next/server';
import { GROUP_ID_MAP } from '@/app/_config/mailerlite';
import { addSubscriberToGroup, validateMailerLiteConfig } from '@/app/_lib/mailerlite';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, source } = body;

    // Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // Get API key from environment variables
    const apiKey = process.env.MAILERLITE_API_KEY;

    // Map source identifier to group ID (server-side only)
    const sourceKey = (source || 'DEFAULT').toUpperCase();
    const groupId = GROUP_ID_MAP[sourceKey];

    // Validate configuration
    const configValidation = validateMailerLiteConfig(apiKey, groupId);
    if (!configValidation.valid) {
      console.error(`Configuration error for source ${sourceKey}:`, configValidation.error);
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Add subscriber to MailerLite group
    const result = await addSubscriberToGroup({
      email,
      name,
      groupId: groupId!,
      apiKey: apiKey!,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to subscribe' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        message: result.message || 'Successfully subscribed!',
        subscriber: {
          email,
          id: result.subscriberId,
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Subscribe API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


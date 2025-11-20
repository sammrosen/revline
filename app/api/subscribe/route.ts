import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, listId } = body;

    // Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // Get API key from environment variables
    const apiKey = process.env.MAILERLITE_API_KEY;
    
    if (!apiKey) {
      console.error('MAILERLITE_API_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Use provided listId or default from env
    const groupId = listId || process.env.MAILERLITE_GROUP_ID;

    if (!groupId) {
      console.error('MAILERLITE_GROUP_ID is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Call MailerLite API v2
    // Docs: https://developers.mailerlite.com/docs/subscribers
    const response = await fetch(
      `https://api.mailerlite.com/api/v2/groups/${groupId}/subscribers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MailerLite-ApiKey': apiKey,
        },
        body: JSON.stringify({
          email,
          name: name || '',
          resubscribe: false,
          autoresponders: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // MailerLite returns specific error messages
      console.error('MailerLite API error:', data);
      
      // Handle common errors gracefully
      if (data.error?.message?.includes('already exists')) {
        return NextResponse.json(
          { message: 'You are already subscribed!' },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: data.error?.message || 'Failed to subscribe' },
        { status: response.status }
      );
    }

    return NextResponse.json(
      { 
        message: 'Successfully subscribed!',
        subscriber: {
          email: data.email,
          id: data.id,
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


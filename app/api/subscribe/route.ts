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

    // Call MailerLite API
    // Docs: https://developers.mailerlite.com/docs/subscribers
    const response = await fetch(
      `https://connect.mailerlite.com/api/subscribers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Version': '2024-11-20', // Lock API version to current date
        },
        body: JSON.stringify({
          email,
          fields: {
            name: name || '',
          },
          groups: [groupId],
          status: 'active',
        }),
      }
    );

    // Log rate limit headers for monitoring
    const rateLimit = response.headers.get('X-RateLimit-Limit');
    const rateRemaining = response.headers.get('X-RateLimit-Remaining');
    const retryAfter = response.headers.get('Retry-After');
    
    if (rateRemaining && parseInt(rateRemaining) < 10) {
      console.warn(`MailerLite rate limit warning: ${rateRemaining}/${rateLimit} requests remaining`);
    }

    const data = await response.json();

    if (!response.ok) {
      // MailerLite returns specific error messages
      console.error('MailerLite API error:', {
        status: response.status,
        data,
        rateLimit: { limit: rateLimit, remaining: rateRemaining }
      });
      
      // Handle rate limiting
      if (response.status === 429) {
        return NextResponse.json(
          { error: `Too many requests. Please try again in ${retryAfter || 60} seconds.` },
          { status: 429 }
        );
      }

      // Handle duplicate subscriber (422 validation error)
      if (response.status === 422 && data.message?.toLowerCase().includes('already')) {
        return NextResponse.json(
          { message: 'You are already subscribed!' },
          { status: 200 }
        );
      }

      // Handle validation errors
      if (response.status === 422) {
        const errorMessage = data.message || 'Invalid email address or data';
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: data.message || 'Failed to subscribe' },
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


/**
 * Test Action API Route
 * 
 * Fires a RevLine action for testing purposes and returns detailed results.
 * Used by the client test suite modal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { dispatchAction } from '@/app/_lib/actions/dispatcher';
import { RevLineAction, ActionPayload } from '@/app/_lib/actions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id: clientId } = await params;

  try {
    // Parse request body
    const body = await request.json();
    const { action, email, name } = body;

    // Validate required fields
    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Build payload
    const payload: ActionPayload = {
      email,
      name: name || undefined,
      source: 'test-suite',
    };

    // Dispatch the action
    const result = await dispatchAction(
      clientId,
      action as RevLineAction,
      payload
    );

    const duration = Date.now() - startTime;

    return NextResponse.json({
      action: result.action,
      results: result.results,
      allSucceeded: result.allSucceeded,
      duration,
    });
  } catch (error) {
    console.error('Test action error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


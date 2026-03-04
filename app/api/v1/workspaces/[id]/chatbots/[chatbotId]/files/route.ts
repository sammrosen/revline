/**
 * Chatbot Reference Files API
 *
 * GET  /api/v1/workspaces/[id]/chatbots/[chatbotId]/files -- List files
 * POST /api/v1/workspaces/[id]/chatbots/[chatbotId]/files -- Upload file
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { extractText, isSupportedMimeType } from '@/app/_lib/chatbot/file-extract';

const MAX_FILES_PER_CHATBOT = 5;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

type RouteParams = { params: Promise<{ id: string; chatbotId: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId, chatbotId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const chatbot = await prisma.chatbot.findFirst({
    where: { id: chatbotId, workspaceId },
    select: { id: true },
  });
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
  }

  const files = await prisma.chatbotFile.findMany({
    where: { chatbotId },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      textContent: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    data: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      charCount: f.textContent.length,
      createdAt: f.createdAt,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: workspaceId, chatbotId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const chatbot = await prisma.chatbot.findFirst({
    where: { id: chatbotId, workspaceId },
    select: { id: true },
  });
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
  }

  const existingCount = await prisma.chatbotFile.count({ where: { chatbotId } });
  if (existingCount >= MAX_FILES_PER_CHATBOT) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES_PER_CHATBOT} files per chatbot` },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Expected multipart/form-data with a file field' },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'Missing "file" field in form data' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  const mimeType = file.type || 'application/octet-stream';
  if (!isSupportedMimeType(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}. Upload PDF, TXT, CSV, or DOCX files.` },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extraction = await extractText(buffer, mimeType);

    const record = await prisma.chatbotFile.create({
      data: {
        chatbotId,
        filename: file.name || 'unnamed',
        mimeType,
        sizeBytes: file.size,
        textContent: extraction.text,
      },
    });

    return NextResponse.json({
      data: {
        id: record.id,
        filename: record.filename,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        charCount: extraction.charCount,
        truncated: extraction.truncated,
        createdAt: record.createdAt,
      },
    });
  } catch (err) {
    console.error('File extraction error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process file' },
      { status: 500 }
    );
  }
}

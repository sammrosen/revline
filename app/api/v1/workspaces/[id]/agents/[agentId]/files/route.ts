/**
 * Agent Reference Files API
 *
 * GET  /api/v1/workspaces/[id]/agents/[agentId]/files -- List files
 * POST /api/v1/workspaces/[id]/agents/[agentId]/files -- Upload file
 */

import { NextRequest } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { prisma } from '@/app/_lib/db';
import { extractText, isSupportedMimeType } from '@/app/_lib/agent/file-extract';
import { ApiResponse, ErrorCodes } from '@/app/_lib/utils/api-response';
import { logStructured } from '@/app/_lib/reliability';

const MAX_FILES_PER_AGENT = 5;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

type RouteParams = { params: Promise<{ id: string; agentId: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, agentId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
    select: { id: true },
  });
  if (!agent) return ApiResponse.error('Agent not found', 404, ErrorCodes.NOT_FOUND);

  const files = await prisma.agentFile.findMany({
    where: { agentId },
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

  return ApiResponse.success(
    files.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      charCount: f.textContent.length,
      createdAt: f.createdAt,
    }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) return ApiResponse.unauthorized();

  const { id: workspaceId, agentId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return ApiResponse.error('Workspace not found', 404, ErrorCodes.NOT_FOUND);

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
    select: { id: true },
  });
  if (!agent) return ApiResponse.error('Agent not found', 404, ErrorCodes.NOT_FOUND);

  const existingCount = await prisma.agentFile.count({ where: { agentId } });
  if (existingCount >= MAX_FILES_PER_AGENT) {
    return ApiResponse.error(
      `Maximum ${MAX_FILES_PER_AGENT} files per agent`,
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return ApiResponse.error(
      'Expected multipart/form-data with a file field',
      400,
      ErrorCodes.INVALID_INPUT
    );
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return ApiResponse.error(
      'Missing "file" field in form data',
      400,
      ErrorCodes.MISSING_REQUIRED
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return ApiResponse.error(
      `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  const mimeType = file.type || 'application/octet-stream';
  if (!isSupportedMimeType(mimeType)) {
    return ApiResponse.error(
      `Unsupported file type: ${mimeType}. Upload PDF, TXT, CSV, or DOCX files.`,
      400,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extraction = await extractText(buffer, mimeType);

    const record = await prisma.agentFile.create({
      data: {
        agentId,
        filename: file.name || 'unnamed',
        mimeType,
        sizeBytes: file.size,
        textContent: extraction.text,
      },
    });

    return ApiResponse.success({
      id: record.id,
      filename: record.filename,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      charCount: extraction.charCount,
      truncated: extraction.truncated,
      createdAt: record.createdAt,
    });
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'agent_file_extraction_error',
      workspaceId,
      provider: 'agent',
      error: err instanceof Error ? err.message : 'Failed to process file',
      metadata: { agentId },
    });
    return ApiResponse.error(
      err instanceof Error ? err.message : 'Failed to process file',
      500
    );
  }
}

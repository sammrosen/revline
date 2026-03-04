import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const MAX_CHARS = 50_000;

const SUPPORTED_TYPES: Record<string, string> = {
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

export interface ExtractionResult {
  text: string;
  charCount: number;
  truncated: boolean;
}

export function isSupportedMimeType(mimeType: string): boolean {
  return mimeType in SUPPORTED_TYPES;
}

export function getSupportedFormats(): string[] {
  return Object.values(SUPPORTED_TYPES);
}

export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(
      `Unsupported file type: ${mimeType}. Supported: ${Object.keys(SUPPORTED_TYPES).join(', ')}`
    );
  }

  let raw: string;

  switch (mimeType) {
    case 'text/plain':
    case 'text/csv':
      raw = buffer.toString('utf-8');
      break;

    case 'application/pdf': {
      const pdf = await pdfParse(buffer);
      raw = pdf.text;
      break;
    }

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      const result = await mammoth.extractRawText({ buffer });
      raw = result.value;
      break;
    }

    default:
      throw new Error(`Unhandled mime type: ${mimeType}`);
  }

  const cleaned = raw.replace(/\r\n/g, '\n').trim();
  const truncated = cleaned.length > MAX_CHARS;
  const text = truncated ? cleaned.slice(0, MAX_CHARS) : cleaned;

  return {
    text,
    charCount: text.length,
    truncated,
  };
}

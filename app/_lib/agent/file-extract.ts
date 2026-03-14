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

  try {
    switch (mimeType) {
      case 'text/plain':
      case 'text/csv':
        raw = buffer.toString('utf-8');
        break;

      case 'application/pdf': {
        // Dynamic require avoids canvas/DOMMatrix issues at build time
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
        const pdf = await pdfParse(buffer);
        raw = pdf.text;
        break;
      }

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mammoth = require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
        const result = await mammoth.extractRawText({ buffer });
        raw = result.value;
        break;
      }

      default:
        throw new Error(`Unhandled mime type: ${mimeType}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown extraction error';
    throw new Error(`Failed to extract text from ${SUPPORTED_TYPES[mimeType] || mimeType} file: ${message}`);
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

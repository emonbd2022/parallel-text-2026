export interface ParsedCsvRow {
  rowNumber: number;
  label: string;
  key: string;
  maskedKey: string;
  status: 'valid' | 'duplicate_existing' | 'duplicate_in_file' | 'invalid';
  reason?: string;
}

export interface CsvParseResult {
  success: boolean;
  errorMessage?: string;
  rows: ParsedCsvRow[];
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
}

/**
 * Standard CSV line parser that handles quotes, escaped quotes, and commas.
 */
function parseCsvLines(csvText: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentField);
      if (currentRow.some(field => field.trim().length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(field => field.trim().length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

/**
 * Parses and validates an API key CSV file.
 * Expects two columns: API Label and API Key (case-insensitive).
 */
export function parseApiKeysCsv(
  csvText: string,
  existingKeys: { key: string; label?: string }[]
): CsvParseResult {
  if (!csvText || !csvText.trim()) {
    return {
      success: false,
      errorMessage: 'The CSV file is empty.',
      rows: [],
      totalRows: 0,
      validCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
    };
  }

  const rawRows = parseCsvLines(csvText);
  if (rawRows.length === 0) {
    return {
      success: false,
      errorMessage: 'No data rows found in the CSV file.',
      rows: [],
      totalRows: 0,
      validCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
    };
  }

  // Identify headers
  const headerRow = rawRows[0].map(col => col.trim().toLowerCase().replace(/['"]/g, ''));

  let labelIdx = -1;
  let keyIdx = -1;

  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i];
    if (
      h === 'api label' ||
      h === 'apilabel' ||
      h === 'api_label' ||
      h === 'label' ||
      h === 'key label' ||
      h === 'key_label' ||
      h === 'name' ||
      h === 'key name' ||
      h === 'key_name'
    ) {
      if (labelIdx === -1) labelIdx = i;
    } else if (
      h === 'api key' ||
      h === 'apikey' ||
      h === 'api_key' ||
      h === 'key' ||
      h === 'secret' ||
      h === 'api secret' ||
      h === 'api_secret' ||
      h === 'token'
    ) {
      if (keyIdx === -1) keyIdx = i;
    }
  }

  if (labelIdx === -1 || keyIdx === -1) {
    return {
      success: false,
      errorMessage: "Invalid CSV: Required columns ('API Label' and 'API Key') could not be identified in the header row.",
      rows: [],
      totalRows: 0,
      validCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
    };
  }

  const existingKeySet = new Set(existingKeys.map(k => k.key.trim()));
  const seenInFileSet = new Set<string>();

  const parsedRows: ParsedCsvRow[] = [];
  let validCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const rawLabel = row[labelIdx] !== undefined ? row[labelIdx].trim() : '';
    const rawKey = row[keyIdx] !== undefined ? row[keyIdx].trim() : '';

    const maskedKey = rawKey.length > 8
      ? `${rawKey.substring(0, 6)}••••••••${rawKey.substring(rawKey.length - 4)}`
      : rawKey.length > 0
      ? '••••••••'
      : '(empty)';

    // Validation
    if (!rawLabel && !rawKey) {
      parsedRows.push({
        rowNumber: r + 1,
        label: '(empty)',
        key: '',
        maskedKey: '(empty)',
        status: 'invalid',
        reason: 'Both label and key are missing'
      });
      invalidCount++;
      continue;
    }

    if (!rawLabel) {
      parsedRows.push({
        rowNumber: r + 1,
        label: '(empty)',
        key: rawKey,
        maskedKey,
        status: 'invalid',
        reason: 'Missing API Label'
      });
      invalidCount++;
      continue;
    }

    if (!rawKey) {
      parsedRows.push({
        rowNumber: r + 1,
        label: rawLabel,
        key: '',
        maskedKey: '(empty)',
        status: 'invalid',
        reason: 'Missing API Key'
      });
      invalidCount++;
      continue;
    }

    if (rawKey.length < 5) {
      parsedRows.push({
        rowNumber: r + 1,
        label: rawLabel,
        key: rawKey,
        maskedKey,
        status: 'invalid',
        reason: 'API Key is too short'
      });
      invalidCount++;
      continue;
    }

    // Duplicate check against existing keys
    if (existingKeySet.has(rawKey)) {
      parsedRows.push({
        rowNumber: r + 1,
        label: rawLabel,
        key: rawKey,
        maskedKey,
        status: 'duplicate_existing',
        reason: 'Already exists in API Keys'
      });
      duplicateCount++;
      continue;
    }

    // Duplicate check within CSV
    if (seenInFileSet.has(rawKey)) {
      parsedRows.push({
        rowNumber: r + 1,
        label: rawLabel,
        key: rawKey,
        maskedKey,
        status: 'duplicate_in_file',
        reason: 'Duplicate key in this CSV'
      });
      duplicateCount++;
      continue;
    }

    // Valid unique new key
    seenInFileSet.add(rawKey);
    parsedRows.push({
      rowNumber: r + 1,
      label: rawLabel,
      key: rawKey,
      maskedKey,
      status: 'valid'
    });
    validCount++;
  }

  return {
    success: true,
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount,
    duplicateCount,
    invalidCount
  };
}

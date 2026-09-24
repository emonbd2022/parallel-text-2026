// Web Worker for CPU-heavy text operations:
// - CSV parsing & deduplication
// - Bulk keyword extraction & frequency counting
// - Search indexing & fuzzy filtering

export interface TextWorkerRequest {
  id: string;
  type: 'parseCsv' | 'filterKeywords' | 'computeStats' | 'formatCsvExport';
  payload: any;
}

export interface TextWorkerResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

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

self.onmessage = (e: MessageEvent<TextWorkerRequest>) => {
  const { id, type, payload } = e.data;

  try {
    switch (type) {
      case 'parseCsv': {
        const { csvText, existingKeySet } = payload;
        const rawRows = parseCsvLines(csvText);
        if (rawRows.length === 0) {
          self.postMessage({ id, success: false, error: 'No data rows found' });
          return;
        }

        const headerRow = rawRows[0].map(col => col.trim().toLowerCase().replace(/['"]/g, ''));
        let labelIdx = -1;
        let keyIdx = -1;

        for (let i = 0; i < headerRow.length; i++) {
          const h = headerRow[i];
          if (['api label', 'apilabel', 'api_label', 'label', 'key label', 'key_label', 'name', 'key name', 'key_name'].includes(h)) {
            if (labelIdx === -1) labelIdx = i;
          } else if (['api key', 'apikey', 'api_key', 'key', 'secret', 'api secret', 'api_secret', 'token'].includes(h)) {
            if (keyIdx === -1) keyIdx = i;
          }
        }

        if (labelIdx === -1 || keyIdx === -1) {
          self.postMessage({ id, success: false, error: "Required columns ('API Label' and 'API Key') could not be identified." });
          return;
        }

        const existingSet = new Set<string>(existingKeySet || []);
        const seenInFile = new Set<string>();
        const parsedRows: any[] = [];
        let validCount = 0;
        let duplicateCount = 0;
        let invalidCount = 0;

        for (let r = 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          const rawLabel = (row[labelIdx] || '').trim();
          const rawKey = (row[keyIdx] || '').trim();

          const maskedKey = rawKey.length > 8
            ? `${rawKey.substring(0, 6)}••••••••${rawKey.substring(rawKey.length - 4)}`
            : rawKey.length > 0
            ? '••••••••'
            : '(empty)';

          if (!rawLabel || !rawKey || rawKey.length < 15) {
            parsedRows.push({ rowNumber: r + 1, label: rawLabel || '(empty)', key: rawKey, maskedKey, status: 'invalid' });
            invalidCount++;
            continue;
          }

          if (existingSet.has(rawKey)) {
            parsedRows.push({ rowNumber: r + 1, label: rawLabel, key: rawKey, maskedKey, status: 'duplicate_existing' });
            duplicateCount++;
            continue;
          }

          if (seenInFile.has(rawKey)) {
            parsedRows.push({ rowNumber: r + 1, label: rawLabel, key: rawKey, maskedKey, status: 'duplicate_in_file' });
            duplicateCount++;
            continue;
          }

          seenInFile.add(rawKey);
          parsedRows.push({ rowNumber: r + 1, label: rawLabel, key: rawKey, maskedKey, status: 'valid' });
          validCount++;
        }

        self.postMessage({
          id,
          success: true,
          result: {
            rows: parsedRows,
            totalRows: parsedRows.length,
            validCount,
            duplicateCount,
            invalidCount,
          },
        });
        break;
      }

      case 'filterKeywords': {
        const { keywords, negativeWords } = payload;
        const negatives = (negativeWords || []).map((w: string) => w.trim().toLowerCase()).filter(Boolean);
        const filtered = (keywords || []).filter((k: string) => {
          const lower = k.toLowerCase();
          return !negatives.some((n: string) => lower.includes(n));
        });
        self.postMessage({ id, success: true, result: filtered });
        break;
      }

      case 'formatCsvExport': {
        const { items } = payload;
        const headers = ['Filename', 'Title', 'Keywords', 'Category'];
        const rows = (items || []).map((i: any) => {
          const safeName = `"${(i.name || '').replace(/"/g, '""')}"`;
          const safeTitle = `"${(i.title || '').replace(/"/g, '""')}"`;
          const safeKeys = `"${(i.keywords || '').replace(/"/g, '""')}"`;
          const safeCat = `"${(i.category || '').replace(/"/g, '""')}"`;
          return `${safeName},${safeTitle},${safeKeys},${safeCat}`;
        });
        const csvContent = [headers.join(','), ...rows].join('\n');
        self.postMessage({ id, success: true, result: csvContent });
        break;
      }

      default:
        self.postMessage({ id, success: false, error: `Unknown worker task type: ${type}` });
    }
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err?.message || 'Text worker failure' });
  }
};

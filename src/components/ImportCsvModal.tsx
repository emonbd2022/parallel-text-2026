import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, CheckCircle2, AlertTriangle, AlertCircle, FileSpreadsheet, KeyRound } from 'lucide-react';
import { CsvParseResult } from '../utils/csvKeyParser';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  parseResult: CsvParseResult | null;
  fileName: string;
  onConfirmImport: (validKeys: { label: string; key: string }[]) => void;
}

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({
  isOpen,
  onClose,
  parseResult,
  fileName,
  onConfirmImport
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'duplicates' | 'invalid'>('all');

  if (!isOpen || !parseResult) return null;

  const validRows = parseResult.rows.filter(r => r.status === 'valid');
  const duplicateRows = parseResult.rows.filter(r => r.status === 'duplicate_existing' || r.status === 'duplicate_in_file');
  const invalidRows = parseResult.rows.filter(r => r.status === 'invalid');

  const displayedRows = parseResult.rows.filter(r => {
    if (filterStatus === 'valid') return r.status === 'valid';
    if (filterStatus === 'duplicates') return r.status === 'duplicate_existing' || r.status === 'duplicate_in_file';
    if (filterStatus === 'invalid') return r.status === 'invalid';
    return true;
  });

  const handleImport = () => {
    const keysToAdd = validRows.map(r => ({ label: r.label, key: r.key }));
    if (keysToAdd.length > 0) {
      onConfirmImport(keysToAdd);
    }
  };

  const modalContent = (
    <div 
      id="csv-import-modal-backdrop"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="csv-import-modal-dialog"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl shadow-black/80 overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Import API Keys
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
                {fileName} • Preview & confirm keys
              </p>
            </div>
          </div>
          <button 
            id="csv-modal-close-btn"
            onClick={onClose}
            aria-label="Close CSV import modal"
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metric Summary Chips */}
        <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950/40 shrink-0">
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              id="filter-all-keys-btn"
              onClick={() => setFilterStatus('all')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-slate-800 border-slate-600 shadow-sm ring-1 ring-slate-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-slate-400">Total</div>
              <div className="text-base sm:text-lg font-bold text-white mt-0.5">{parseResult.totalRows}</div>
            </button>

            <button
              type="button"
              id="filter-valid-keys-btn"
              onClick={() => setFilterStatus('valid')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStatus === 'valid'
                  ? 'bg-emerald-950/50 border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/30'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span className="truncate">New Valid</span>
              </div>
              <div className="text-base sm:text-lg font-bold text-emerald-300 mt-0.5">{parseResult.validCount}</div>
            </button>

            <button
              type="button"
              id="filter-duplicate-keys-btn"
              onClick={() => setFilterStatus('duplicates')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStatus === 'duplicates'
                  ? 'bg-amber-950/50 border-amber-500/60 shadow-sm ring-1 ring-amber-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-amber-500/30'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="truncate">Duplicates</span>
              </div>
              <div className="text-base sm:text-lg font-bold text-amber-300 mt-0.5">{parseResult.duplicateCount}</div>
            </button>

            <button
              type="button"
              id="filter-invalid-keys-btn"
              onClick={() => setFilterStatus('invalid')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                filterStatus === 'invalid'
                  ? 'bg-rose-950/50 border-rose-500/60 shadow-sm ring-1 ring-rose-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-rose-500/30'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">Invalid</span>
              </div>
              <div className="text-base sm:text-lg font-bold text-rose-300 mt-0.5">{parseResult.invalidCount}</div>
            </button>
          </div>
        </div>

        {/* Preview List Table */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 custom-scrollbar space-y-2.5 bg-slate-950/20">
          {displayedRows.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No keys match the selected filter.
            </div>
          ) : (
            displayedRows.map((row) => {
              const isValid = row.status === 'valid';
              const isDuplicate = row.status === 'duplicate_existing' || row.status === 'duplicate_in_file';
              const isInvalid = row.status === 'invalid';

              return (
                <div
                  key={row.rowNumber}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                    isValid
                      ? 'bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
                      : isDuplicate
                      ? 'bg-amber-950/20 border-amber-500/20'
                      : 'bg-rose-950/20 border-rose-500/20'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 truncate">{row.label}</span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">Row #{row.rowNumber}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{row.maskedKey}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {isValid && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Valid
                      </span>
                    )}
                    {isDuplicate && (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Already Exists
                        </span>
                        {row.reason && (
                          <span className="text-[9px] text-amber-400/80">{row.reason}</span>
                        )}
                      </div>
                    )}
                    {isInvalid && (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Invalid
                        </span>
                        {row.reason && (
                          <span className="text-[9px] text-rose-400/90">{row.reason}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 backdrop-blur shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            {validRows.length > 0 ? (
              <span>
                Ready to append <strong className="text-emerald-400 font-bold">{validRows.length}</strong> new {validRows.length === 1 ? 'key' : 'keys'}.
              </span>
            ) : (
              <span className="text-amber-400 font-medium">No new valid keys found to import.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              id="cancel-csv-import-btn"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer border border-slate-700 text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              id="confirm-csv-import-btn"
              onClick={handleImport}
              disabled={validRows.length === 0}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>Import {validRows.length} {validRows.length === 1 ? 'Key' : 'Keys'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

import React, { useState } from 'react';
import { X, Upload, CheckCircle2, AlertTriangle, AlertCircle, FileSpreadsheet, KeyRound } from 'lucide-react';
import { CsvParseResult, ParsedCsvRow } from '../utils/csvKeyParser';

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

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Import API Keys
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {fileName} • Preview and confirm keys to append
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metric Summary Chips */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/30">
          <div className="grid grid-cols-4 gap-2.5">
            <button
              onClick={() => setFilterStatus('all')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                filterStatus === 'all'
                  ? 'bg-slate-800 border-slate-600 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-slate-400">Found Keys</div>
              <div className="text-lg font-bold text-white mt-0.5">{parseResult.totalRows}</div>
            </button>

            <button
              onClick={() => setFilterStatus('valid')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                filterStatus === 'valid'
                  ? 'bg-emerald-950/40 border-emerald-500/50 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/30'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                New Valid
              </div>
              <div className="text-lg font-bold text-emerald-300 mt-0.5">{parseResult.validCount}</div>
            </button>

            <button
              onClick={() => setFilterStatus('duplicates')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                filterStatus === 'duplicates'
                  ? 'bg-amber-950/40 border-amber-500/50 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 hover:border-amber-500/30'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Duplicates
              </div>
              <div className="text-lg font-bold text-amber-300 mt-0.5">{parseResult.duplicateCount}</div>
            </button>

            <button
              onClick={() => setFilterStatus('invalid')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                filterStatus === 'invalid'
                  ? 'bg-rose-950/40 border-rose-500/50 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 hover:border-rose-500/30'
              }`}
            >
              <div className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Invalid
              </div>
              <div className="text-lg font-bold text-rose-300 mt-0.5">{parseResult.invalidCount}</div>
            </button>
          </div>
        </div>

        {/* Preview List Table */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-2">
          {displayedRows.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
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
                      ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      : isDuplicate
                      ? 'bg-amber-950/10 border-amber-500/20'
                      : 'bg-rose-950/10 border-rose-500/20'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 truncate">{row.label}</span>
                      <span className="text-[10px] text-slate-500 font-mono">Row #{row.rowNumber}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{row.maskedKey}</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {isValid && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Valid
                      </span>
                    )}
                    {isDuplicate && (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Already Exists
                        </span>
                        {row.reason && (
                          <span className="text-[9px] text-amber-500/80">{row.reason}</span>
                        )}
                      </div>
                    )}
                    {isInvalid && (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Invalid
                        </span>
                        {row.reason && (
                          <span className="text-[9px] text-rose-400">{row.reason}</span>
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
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {validRows.length > 0 ? (
              <span>
                Ready to append <strong className="text-emerald-400 font-bold">{validRows.length}</strong> new {validRows.length === 1 ? 'key' : 'keys'}.
              </span>
            ) : (
              <span className="text-amber-400">No new valid keys to import.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={validRows.length === 0}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-purple-600/20 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" />
              Import {validRows.length} {validRows.length === 1 ? 'Key' : 'Keys'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

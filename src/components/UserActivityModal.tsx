import React from 'react';
import { X, Activity } from 'lucide-react';
import { UserData } from '../contexts/AuthContext';

export const UserActivityModal: React.FC<{ user: UserData; onClose: () => void }> = ({ user, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
             <Activity className="w-5 h-5 text-purple-400" />
             <h2 className="text-xl font-bold text-white">Activity: {user.email}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="space-y-6">
             <div className="grid grid-cols-1 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center">
                   <div className="text-sm text-slate-400 mb-1">Total Processed Images</div>
                   <div className="text-2xl font-bold text-emerald-400">{user.totalProcessedImages || 0}</div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

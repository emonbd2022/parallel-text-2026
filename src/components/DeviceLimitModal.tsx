import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Laptop, Smartphone, LogOut, AlertTriangle, Lock, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getOrCreateDeviceId, formatDeviceId, detectDeviceMetadata, MAX_DEVICES_PER_ACCOUNT } from '../utils/deviceManager';

export const DeviceLimitModal: React.FC = () => {
  const { user, userData, logout, refreshUserData } = useAuth();
  const [checking, setChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState<string | null>(null);

  const currentDeviceId = getOrCreateDeviceId();
  const currentMeta = detectDeviceMetadata(currentDeviceId);
  const registeredIds = Array.isArray(userData?.deviceIds) ? userData.deviceIds : [];

  const handleManualCheck = async () => {
    setChecking(true);
    setCheckStatus('Checking device slots with server...');
    try {
      const updated = await refreshUserData(true);
      if (updated && !updated.deviceLimitReached) {
        setCheckStatus('Access granted! Entering app...');
      } else {
        setCheckStatus('Device slots still full. Ask administrator to reset your devices.');
      }
    } catch (e: any) {
      setCheckStatus('Failed to verify. Please try again.');
    } finally {
      setTimeout(() => setChecking(false), 600);
    }
  };

  // Automatic background poll while modal is visible so admin resets unlock instantly
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await refreshUserData(true);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [refreshUserData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
      >
        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <Lock className="w-3 h-3" /> Security Enforcement
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Device Limit Reached
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              1 Account = Maximum {MAX_DEVICES_PER_ACCOUNT} Active Devices
            </p>
          </div>
        </div>

        {/* Status Explanation */}
        <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2.5">
          <p className="text-slate-300 text-sm leading-relaxed">
            Your account <strong className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded text-xs">{user?.email || userData?.email || 'this account'}</strong> currently has <strong className="text-rose-400">{MAX_DEVICES_PER_ACCOUNT} registered devices</strong>.
          </p>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-200 leading-relaxed font-medium">
            Strict multi-device protection is enabled. When an administrator resets your device authorization slots, click <strong>"Check & Re-verify Access"</strong> below or wait a moment for automatic login.
          </div>
          {checkStatus && (
            <div className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${checkStatus.includes('granted') ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
              {checkStatus.includes('granted') ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <RefreshCw className={`w-3.5 h-3.5 text-slate-400 shrink-0 ${checking ? 'animate-spin' : ''}`} />}
              <span>{checkStatus}</span>
            </div>
          )}
        </div>

        {/* Device Status Breakdown */}
        <div className="space-y-2.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Current Device Slots ({Math.min(registeredIds.length, MAX_DEVICES_PER_ACCOUNT)} of {MAX_DEVICES_PER_ACCOUNT} in use)
          </span>

          <div className="space-y-2">
            {registeredIds.slice(0, 2).map((devId, idx) => {
              const meta = Array.isArray(userData?.devices) ? userData.devices.find(d => d.id === devId) : null;
              return (
                <div
                  key={devId}
                  className="flex items-center justify-between p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-300">
                      {idx === 0 ? <Laptop className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {meta?.name || `Authorized Device #${idx + 1}`}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        ID: {formatDeviceId(devId)}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
              );
            })}

            {/* Current Unregistered Device */}
            <div className="flex items-center justify-between p-3.5 bg-rose-950/30 rounded-xl border border-rose-500/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-300">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-rose-200 block flex items-center gap-1.5">
                    This Machine (Pending Reset)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {currentMeta.name} • {formatDeviceId(currentDeviceId)}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Slot Full
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={handleManualCheck}
            disabled={checking}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking Slots...' : 'Check & Re-verify Access'}</span>
          </button>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out & Switch Account</span>
          </button>
        </div>

        {/* Footer Support */}
        <div className="text-center text-[11px] text-slate-500 pt-1">
          Need help? Contact an administrator to reset your authorized device slots.
        </div>
      </motion.div>
    </div>
  );
};

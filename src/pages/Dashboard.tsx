import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Calendar, Image as ImageIcon, Zap, Crown, BarChart2, ShieldCheck, Laptop, Smartphone, RefreshCw, CheckCircle2 } from 'lucide-react';
import { StatisticsModal } from '../components/StatisticsModal';
import { getOrCreateDeviceId, formatDeviceId, detectDeviceMetadata, MAX_DEVICES_PER_ACCOUNT } from '../utils/deviceManager';

const MODELS = [
  { id: 'turbo', name: 'Turbo' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' }
];

export const Dashboard: React.FC = () => {
  const { userData, resetUserDevices } = useAuth();
  const [showStats, setShowStats] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isResettingDevices, setIsResettingDevices] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const currentDeviceId = getOrCreateDeviceId();
  const currentDeviceMeta = detectDeviceMetadata(currentDeviceId);
  const registeredDeviceIds = Array.isArray(userData?.deviceIds) ? userData.deviceIds : [];

  const handleResetDevices = async () => {
    if (!window.confirm("Are you sure you want to reset your authorized devices? This will keep only this current device registered.")) {
      return;
    }

    setIsResettingDevices(true);
    setResetMessage(null);
    try {
      if (resetUserDevices) {
        await resetUserDevices();
        setResetMessage("Authorized devices updated: only this device is now active.");
      }
    } catch (e: any) {
      setResetMessage("Failed to reset devices: " + (e.message || e));
    } finally {
      setIsResettingDevices(false);
      setTimeout(() => setResetMessage(null), 5000);
    }
  };
  

  useEffect(() => {
    try {
      setLogs(JSON.parse(localStorage.getItem('parrarel_logs_v1') || '[]'));
    } catch {}
  }, [userData?.totalProcessedImages, showStats]);

  if (!userData) return null;

  const joinDate = new Date(userData.joinDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 overflow-y-auto p-8 custom-scrollbar"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <User className="w-8 h-8 text-purple-400" />
            My Dashboard
          </h1>
          <button
            onClick={() => setShowStats(true)}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all font-semibold flex items-center gap-2 border border-slate-700 hover:border-slate-600 shadow-lg"
          >
            <BarChart2 className="w-5 h-5" />
            View Statistics
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-6">
              <img src={userData.photoURL || 'https://via.placeholder.com/100'} alt="Profile" className="w-24 h-24 rounded-2xl shadow-lg border-2 border-slate-700" />
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{userData.name}</h2>
                <p className="text-slate-400 mb-2">{userData.email}</p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-sm font-medium text-slate-300">
                  <User className="w-4 h-4" />
                  {userData.nickname}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-3xl p-8 shadow-xl relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-colors"></div>
            <h3 className="text-slate-400 font-medium flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-amber-400" /> Current Plan
            </h3>
            <div className="text-4xl font-black text-white mb-2 capitalize">
              {userData.plan && userData.plan !== 'free' ? userData.plan : (userData.unlimited ? 'Unlimited' : 'Free')}
            </div>
            {userData.plan && userData.plan !== 'free' ? (
              <p className="text-slate-400">
                {userData.planEndDate ? (
                   userData.plan === 'unlimited' ? <>Lifetime</> : <>Valid until <strong className="text-white">{new Date(userData.planEndDate).toLocaleDateString()}</strong></>
                ) : (
                   'Active Subscription'
                )}
              </p>
            ) : (
              <p className="text-slate-400">
                You are on the free plan. Upgrade for more credits.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {userData.unlimited ? '∞' : userData.credits}
            </div>
            <div className="text-slate-400 text-sm">Available Credits</div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {userData.totalProcessedImages || 0}
            </div>
            <div className="text-slate-400 text-sm">Images Processed</div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="text-lg font-bold text-white mb-1">
              {joinDate}
            </div>
            <div className="text-slate-400 text-sm">Member Since</div>
          </div>
        </div>

        {/* Multi-Device Protection & Device Management Card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Authorized Devices
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {registeredDeviceIds.length} / {MAX_DEVICES_PER_ACCOUNT} Max
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Multiple Device Protection: 1 Gmail account is strictly limited to a maximum of 2 devices.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetDevices}
              disabled={isResettingDevices}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Reset slots and register only this device"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResettingDevices ? 'animate-spin' : ''}`} />
              <span>Reset Device Slots</span>
            </button>
          </div>

          {resetMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{resetMessage}</span>
            </div>
          )}

          {/* Slots List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Slot 1 */}
            <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">Device Slot 1</span>
                    {registeredDeviceIds[0] === currentDeviceId && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        This Device
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                    {registeredDeviceIds[0] ? formatDeviceId(registeredDeviceIds[0]) : 'Empty Slot'}
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${registeredDeviceIds[0] ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}>
                {registeredDeviceIds[0] ? 'Registered' : 'Available'}
              </span>
            </div>

            {/* Slot 2 */}
            <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">Device Slot 2</span>
                    {registeredDeviceIds[1] === currentDeviceId && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        This Device
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                    {registeredDeviceIds[1] ? formatDeviceId(registeredDeviceIds[1]) : 'Empty Slot'}
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${registeredDeviceIds[1] ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}>
                {registeredDeviceIds[1] ? 'Registered' : 'Available'}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-950/40 p-3 rounded-xl border border-slate-800/40 flex items-center justify-between">
            <span>Current Browser & OS: <strong className="text-slate-300">{currentDeviceMeta.name}</strong></span>
            <span className="font-mono text-slate-400">ID: {formatDeviceId(currentDeviceId)}</span>
          </div>
        </div>
      </div>
      
      {showStats && (
        <StatisticsModal 
          logs={logs} 
          modelStats={{}} 
          models={MODELS} 
          onClose={() => setShowStats(false)} 
        />
      )}
    </motion.div>
  );
};

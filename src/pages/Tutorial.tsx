import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, Key, Image as ImageIcon, Settings, Zap, 
  Download, Activity, CheckCircle, AlertTriangle, 
  Layers, ChevronRight, HelpCircle
} from 'lucide-react';

export const Tutorial: React.FC = () => {
  const [activeSection, setActiveSection] = useState('getting-started');

  const sections = [
    { id: 'getting-started', title: '1. Getting Started', icon: BookOpen },
    { id: 'api-keys', title: '2. Managing API Keys', icon: Key },
    { id: 'configuration', title: '3. Configuration & Turbo', icon: Settings },
    { id: 'uploading', title: '4. Uploading Images', icon: ImageIcon },
    { id: 'processing', title: '5. The Processing Pipeline', icon: Activity },
    { id: 'fallback', title: '6. Bidirectional Fallback', icon: Zap },
    { id: 'review-export', title: '7. Review & Export', icon: Download },
    { id: 'troubleshooting', title: '8. Troubleshooting', icon: AlertTriangle },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col md:flex-row h-full overflow-hidden bg-slate-950 text-slate-300"
    >
      {/* Sidebar TOC */}
      <div className="w-full md:w-64 border-r border-slate-800 bg-slate-900/50 p-4 overflow-y-auto shrink-0">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-purple-400" />
          How to Use
        </h2>
        <nav className="space-y-1">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === s.id 
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <s.icon className={`w-4 h-4 ${activeSection === s.id ? 'text-purple-400' : ''}`} />
              <span className="text-left">{s.title}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar relative">
        <div className="max-w-4xl mx-auto space-y-10 pb-20">
          
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Parallel Text Tutorial</h1>
            <p className="text-slate-400 text-lg">
              Welcome to Parallel Text! This guide will help you automate your stock photography metadata (Titles, Keywords, and Categories) using our highly optimized AI pipeline.
            </p>
          </div>

          {/* 1. Getting Started */}
          <Section id="getting-started" active={activeSection}>
            <h2 className="text-2xl font-bold text-white mb-4 border-b border-slate-800 pb-2">1. Getting Started</h2>
            <div className="space-y-4">
              <p>Parallel Text is designed to save you hours by generating metadata for your images completely locally in your browser. All image processing happens locally, and only lightweight compressed thumbnails are sent to the AI API.</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Sign In:</strong> First, sign in using your account. You will receive an initial balance of credits.</li>
                <li><strong>Credits:</strong> Processing images requires credits. You can check your remaining credits in the top right corner.</li>
                <li><strong>Local Storage:</strong> Your active workspace is automatically saved to your browser. If you accidentally close the tab, your pending and completed items will remain intact when you return!</li>
              </ul>
              
              <div className="bg-orange-950/30 border border-orange-500/30 rounded-xl p-5 mt-6">
                <h3 className="text-lg font-bold text-orange-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Terms & Conditions: Device Limits
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-3">
                  To prevent account sharing and piracy, <strong>each account is strictly limited to a maximum of 2 unique devices/browsers</strong>. 
                </p>
                <ul className="text-sm text-slate-400 list-disc pl-5 space-y-1">
                  <li>When you log in, your device is securely registered.</li>
                  <li>Normal usage (refreshing, restarting the browser, passive sessions) on a registered device will not count as a new device.</li>
                  <li>Attempting to log in from a 3rd distinct device will automatically block your account.</li>
                  <li>Once an account is blocked, you must contact support to appeal. Device registrations cannot be manually removed by users.</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* 2. API Keys */}
          <Section id="api-keys" active={activeSection}>
            <h2 className="text-2xl font-bold text-white mb-4 border-b border-slate-800 pb-2">2. Managing API Keys</h2>
            <div className="space-y-4">
              <p>To generate metadata, you need to provide your own Google Gemini API keys. Here is how to get and add them:</p>
              
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mt-4">
                <h3 className="text-lg font-bold text-emerald-400 mb-3">How to get a Gemini API Key</h3>
                <ol className="list-decimal pl-5 space-y-3 text-slate-300">
                  <li>Go to <strong><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a></strong> and sign in with your Google account.</li>
                  <li>Click on the <strong>"Get API key"</strong> button (usually on the left menu).</li>
                  <li>Click <strong>"Create API key"</strong>. You can create it in a new or existing Google Cloud project.</li>
                  <li>Once generated, <strong>Copy</strong> the long string of text (your API key).</li>
                </ol>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mt-4">
                <h3 className="text-lg font-bold text-blue-400 mb-3">How to add it to Parallel Text</h3>
                <ol className="list-decimal pl-5 space-y-3 text-slate-300">
                  <li>Open the <strong>left sidebar</strong> in Parallel Text.</li>
                  <li>Locate the <strong>API Keys</strong> section at the top.</li>
                  <li>Paste your copied key into the text box and click the <strong>Add Key</strong> button (or press Enter).</li>
                  <li>Your key will now appear in the list below.</li>
                </ol>
              </div>
              
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mt-4">
                <h3 className="text-lg font-bold text-purple-300 mb-2">Two Pools of Keys</h3>
                <p className="mb-3">When you add keys, the system automatically divides them into two pools:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li><strong>Title & Keyword Pool (First Half):</strong> Dedicated primarily to generating Titles and Keywords.</li>
                  <li><strong>Category Pool (Second Half):</strong> Dedicated primarily to determining the correct stock category.</li>
                </ol>
              </div>
              
              <p className="text-emerald-400 font-medium flex items-center gap-2 mt-4">
                <CheckCircle className="w-5 h-5" /> Tip: Add multiple API keys (e.g., 4 or 8) to process images much faster in parallel.
              </p>
            </div>
          </Section>

          {/* 3. Configuration & Turbo */}
          <Section id="configuration" active={activeSection}>
            <h2 className="text-2xl font-bold text-white mb-4 border-b border-slate-800 pb-2">3. Configuration & Turbo Mode</h2>
            <div className="space-y-4">
              <p>Before uploading images, configure your settings in the sidebar:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Model Selection:</strong> Choose which Gemini model to use. We recommend the Flash Lite models for speed and cost efficiency.</li>
                <li><strong>Title Prefix/Suffix:</strong> Automatically prepend or append text to every generated title.</li>
                <li><strong>Keywords Count:</strong> Choose how many keywords to generate per image.</li>
                <li><strong>Target Extension:</strong> Automatically change your output filenames (e.g., set to ".jpg" if you upload PNGs but intend to sell them as JPGs).</li>
              </ul>

              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-5 mt-6">
                <h3 className="text-lg font-bold text-fuchsia-300 mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5" /> What is Turbo Mode?
                </h3>
                <p>
                  When you select <strong>Turbo</strong> as your model, Parallel Text automatically tests multiple AI models in real-time. It continuously monitors response speeds and intelligently routes your images to whichever model is currently responding the fastest. You don't have to guess which model is best—Turbo does it for you.
                </p>
              </div>
            </div>
          </Section>

          {/* 4. Uploading Images */}
          <Section id="uploading" active={activeSection}>
            <h2 className="text-2xl font-bold text-white mb-4 border-b border-slate-800 pb-2">4. Uploading Images</h2>
            <div className="space-y-4">
              <p>Adding images is simple:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Click the large <strong>Upload</strong> area in the center of the dashboard.</li>
                <li>Or simply <strong>Drag and Drop</strong> images from your computer directly into the app.</li>
              </ul>
              <p className="text-sm text-slate-400 mt-2">
                Note: When you upload images, they are instantly compressed locally in your browser. The original high-resolution files never leave your computer.
              </p>
            </div>
          </Section>

          {/* 5. Processing Pipeline */}
          <Section id="processing" active={activeSection}>
            <h2 className="text-2xl font-bold text-white mb-4 border-b border-slate-800 pb-2">5. The Processing Pipeline</h2>
            <div className="space-y-4">
              <p>Once you click the <strong>Play</strong> button in the sidebar, the AI pipeline activates. There are two distinct steps for every image:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h4 className="font-bold text-emerald-400 mb-2">Step 1: Title & Keywords</h4>
                  <p className="text-sm text-slate-300">The system analyzes your image and generates a descriptive title and highly relevant keywords.</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h4 className="font-bold text-blue-400 mb-2">Step 2: Categorization</h4>
                  <p className="text-sm text-slate-300">Immediately after Step 1 finishes, the AI determines the exact Adobe Stock / Shutterstock category code for the image.</p>
                </div>
              </div>

              <p className="mt-4">
                <strong>Simultaneous Processing:</strong> You do not have to wait for all titles to finish before categories begin. As soon as Image 1 finishes its Title, its Category generation begins instantly while Image 2 is still generating its Title.
              </p>
            </div>
          </Section>

          {/* 6. Bidirectional Fallback */}
          <Section id="fallback" active={activeSection}>
            <h2 className="text-2xl font-bold text-white mb-4 border-b border-slate-800 pb-2">6. The Bidirectional Fallback System</h2>
            <div className="space-y-4">
              <p>Parallel Text features an advanced, highly optimized <strong>Zero-Idle Scheduler</strong> to ensure your images process as fast as physically possible.</p>
              
              <ul className="list-disc pl-6 space-y-3">
                <li>Normally, Title Keys only do Title work, and Category Keys only do Category work.</li>
                <li>However, if the Category queue is temporarily empty, those <strong>Category keys will immediately jump in to help generate Titles.</strong></li>
                <li>Conversely, if Titles are finished but Categories are still pending, <strong>Title keys will instantly switch over to help finish the Categories.</strong></li>
              </ul>
              
              <p className="font-medium text-purple-300">
                What this means for you: No healthy API key will ever sit idle while work is pending. You get absolute maximum speed out of your keys.
              </p>
            </div>
          </Section>

          {/* 7. Review & Export */}
          <Section id="review-export" active={activeSection}>
            <h2 className="text-2xl font-bold text-white mb-4 border-b border-slate-800 pb-2">7. Review & Export</h2>
            <div className="space-y-4">
              <p>As images complete, they appear in the grid.</p>
              
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Editing:</strong> Click any generated Title, Keyword string, or Category directly in the UI to edit it manually.</li>
                <li><strong>Removing:</strong> Click the "X" on any image to remove it from the workspace.</li>
                <li><strong>Exporting:</strong> Click the <strong>Export CSV</strong> button at the top to download a formatted CSV file. This CSV is immediately ready for upload to Adobe Stock, Shutterstock, and other major stock agencies.</li>
                <li><strong>Auto-Export:</strong> If enabled in settings, the CSV will automatically download the moment the last image finishes processing.</li>
              </ul>
            </div>
          </Section>

          {/* 8. Troubleshooting */}
          <Section id="troubleshooting" active={activeSection}>
            <h2 className="text-2xl font-bold text-white mb-4 border-b border-slate-800 pb-2">8. Troubleshooting</h2>
            <div className="space-y-4">
              <div className="bg-slate-900 border border-red-500/30 rounded-xl p-5">
                <h4 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Rate Limits & Cooldowns
                </h4>
                <p className="text-sm mb-2">If an API key hits a provider rate limit (e.g., Google quota), the system does not crash.</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>The affected key is automatically placed in a temporary <strong>Cooldown</strong>.</li>
                  <li>The failed image is immediately given to another healthy key.</li>
                  <li>The interface will notify you if it is waiting for cooldowns to expire.</li>
                </ul>
              </div>

              <h4 className="font-bold text-white mt-4">Common Issues:</h4>
              <ul className="list-disc pl-6 space-y-2 text-slate-300 text-sm">
                <li><strong>"Missing Image Data":</strong> If you refresh the browser while processing, the original files cannot be restored (for security reasons). Simply drag and drop the same images back into the window; they will link back up with their saved titles automatically.</li>
                <li><strong>"Invalid Key":</strong> Double check that your Gemini API key was copied correctly from Google AI Studio.</li>
                <li><strong>Stuck Processing:</strong> Ensure you have sufficient credits on your account, and that your API keys have not hit their daily free-tier limits.</li>
              </ul>
            </div>
          </Section>

        </div>
      </div>
    </motion.div>
  );
};

// Helper component to only render the active section
const Section: React.FC<{ id: string; active: string; children: React.ReactNode }> = ({ id, active, children }) => {
  if (active !== id) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
};

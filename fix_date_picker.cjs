const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { Shield, Search, RefreshCw, Calendar } from 'lucide-react';",
  `import { Shield, Search, RefreshCw, Calendar } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';`
);

// 2. Change state to Date | null
code = code.replace(
  `const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');`,
  `const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);`
);

// 3. Replace inputs
const dateInputs = `<input type="date" className="bg-slate-950 border border-slate-700 text-xs rounded px-1 text-slate-300" value={startDate} onChange={e => setStartDate(e.target.value)} />
                 <span className="text-slate-500">-</span>
                 <input type="date" className="bg-slate-950 border border-slate-700 text-xs rounded px-1 text-slate-300" value={endDate} onChange={e => setEndDate(e.target.value)} />`;

const newDateInputs = `<DatePicker
                    selected={startDate}
                    onChange={(date) => setStartDate(date)}
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    placeholderText="Start Date"
                    className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-slate-300 w-24 focus:outline-none focus:border-purple-500"
                 />
                 <span className="text-slate-500">-</span>
                 <DatePicker
                    selected={endDate}
                    onChange={(date) => setEndDate(date)}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate}
                    placeholderText="End Date"
                    className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-slate-300 w-24 focus:outline-none focus:border-purple-500"
                 />`;

code = code.replace(dateInputs, newDateInputs);
fs.writeFileSync('src/pages/AdminDashboard.tsx', code);

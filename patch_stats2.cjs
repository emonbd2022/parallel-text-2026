const fs = require('fs');
let content = fs.readFileSync('src/components/StatisticsModal.tsx', 'utf8');

const targetComp = `export const StatisticsModal: React.FC<Props> = ({ logs, modelStats, models, onClose }) => {`;
const replacementComp = `export const StatisticsModal: React.FC<Props> = ({ logs, modelStats, models, onClose }) => {
    const [isListExpanded, setIsListExpanded] = useState(false);`;

content = content.replace(targetComp, replacementComp);

fs.writeFileSync('src/components/StatisticsModal.tsx', content);

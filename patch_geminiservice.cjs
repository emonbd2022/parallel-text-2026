const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const regexSign = /export const generateMetadataBatch = async \(\s*apiKey: string,\s*items: BatchItem\[\],\s*config: \{\s*model: string;\s*titleMaxLen: number;\s*keywordsCount: number;\s*titlePrefix\?: string;\s*titleSuffix\?: string;\s*negativeTitleWords\?: string;\s*negativeKeywords\?: string;\s*forceTransparency\?: boolean;\s*\}\s*\): Promise<Record<string, GeminiResponse>> => \{/g;

const replacementSign = `export const generateMetadataBatch = async (
  apiKey: string,
  items: BatchItem[],
  config: {
    model: string;
    titleMaxLen: number;
    keywordsCount: number;
    titlePrefix?: string;
    titleSuffix?: string;
    negativeTitleWords?: string;
    negativeKeywords?: string;
    forceTransparency?: boolean;
  },
  onProgress?: (progressMsg: string) => void
): Promise<Record<string, GeminiResponse>> => {`;
content = content.replace(regexSign, replacementSign);

const resultsRegex = /\/\/ Process and Map results back to IDs\s*const results: Record<string, GeminiResponse> = \{\};\s*jsonArray\.forEach\(\(resItem\) => \{[\s\S]*?return results;\s*\} catch \(error: any\) \{/g;

const resultsReplacement = `
    // Process generated titles
    const results: Record<string, GeminiResponse> = {};
    const titlesForCategory: string[] = [];
    
    jsonArray.forEach((resItem) => {
       const index = resItem.index;
       if (index >= 0 && index < items.length) {
          const originalId = items[index].id;
          
          let title = resItem.title || "";
          let keywordsList = resItem.keywords || [];
          if (!Array.isArray(keywordsList)) keywordsList = String(keywordsList).split(',').map((s: string) => s.trim());

          // Filter Negative Title
          if (config.negativeTitleWords) {
            const negatives = config.negativeTitleWords.split(',').map((w: string) => w.trim()).filter(Boolean);
            negatives.forEach((neg: string) => {
              const regex = new RegExp(\`\\\\b\${neg}\\\\b\`, 'gi');
              title = title.replace(regex, '');
            });
            title = title.replace(/\\s+/g, ' ').trim();
          }

          // Filter Negative Keywords
          if (config.negativeKeywords) {
            const negatives = config.negativeKeywords.split(',').map((w: string) => w.trim().toLowerCase()).filter(Boolean);
            keywordsList = keywordsList.filter((k: string) => {
              const lowerK = k.toLowerCase();
              return !negatives.some((neg: string) => lowerK.includes(neg));
            });
          }

          // Apply Prefix / Suffix
          if (config.titlePrefix) title = \`\${config.titlePrefix.trim()} \${title}\`;
          if (config.titleSuffix) title = \`\${title} \${config.titleSuffix.trim()}\`;
          
          let finalTitle = title.trim();
          const maxLen = config.titleMaxLen || 180;
          if (finalTitle.length > maxLen) {
              let truncated = finalTitle.substring(0, maxLen - 1);
              const lastSpace = truncated.lastIndexOf(' ');
              if (lastSpace > 0) {
                  truncated = truncated.substring(0, lastSpace);
              }
              finalTitle = truncated.replace(/[\\s,.;:-]+$/, '') + '.';
          }

          const maxKeywords = 45;
          if (keywordsList.length > maxKeywords) {
              keywordsList = keywordsList.slice(0, maxKeywords);
          }

          results[originalId] = {
            title: finalTitle,
            keywords: keywordsList.join(', '),
            category: ""
          };
          
          titlesForCategory.push(\`Index \${index}: \${finalTitle}\`);
       }
    });
    
    if (onProgress) onProgress("Getting specific categories...");
    
    // Step 2: Request Categories
    const categoryPromptText = \`
      I will provide \${items.length} titles. Please categorize each into exactly one of these 21 options:
      "Animals", "Buildings and Architecture", "Business", "Drinks", "The Environment", "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure", "Industry", "Landscapes", "Lifestyle", "People", "Plants and Flowers", "Culture and Religion", "Science", "Social Issues", "Sports", "Technology", "Transport", "Travel"
      
      Titles:
      \${titlesForCategory.join('\\n')}
      
      Return a strictly valid JSON array where each object contains:
      - "index": integer (0-based index)
      - "category": string
    \`;
    
    const catResponse = await ai.models.generateContent({
      model: config.model,
      contents: categoryPromptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.INTEGER },
              category: { type: Type.STRING }
            },
            required: ["index", "category"]
          }
        }
      }
    });
    
    const catText = catResponse.text;
    if (catText) {
       try {
           const catArray = JSON.parse(catText);
           if (Array.isArray(catArray)) {
               catArray.forEach(catItem => {
                   const idx = catItem.index;
                   if (idx >= 0 && idx < items.length) {
                       const originalId = items[idx].id;
                       if (results[originalId]) {
                           results[originalId].category = catItem.category || "";
                       }
                   }
               });
           }
       } catch (e) {
           console.warn("Failed to parse categories", e);
       }
    }

    return results;
  } catch (error: any) {`;
content = content.replace(resultsRegex, resultsReplacement);

const initialProgressRegex = /const ai = new GoogleGenAI\(\{ apiKey \}\);/;
const initialProgressReplacement = `const ai = new GoogleGenAI({ apiKey });\n    if (onProgress) onProgress("Creating titles & keywords...");`;
content = content.replace(initialProgressRegex, initialProgressReplacement);

fs.writeFileSync('src/services/geminiService.ts', content);

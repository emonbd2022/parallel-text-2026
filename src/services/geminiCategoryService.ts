import { GoogleGenAI, Type } from '@google/genai';

const AUTHORITATIVE_CATEGORIES = [
  "Animals",
  "Buildings and Architecture",
  "Business",
  "Drinks",
  "The Environment",
  "States of Mind",
  "Food",
  "Graphic Resources",
  "Hobbies and Leisure",
  "Industry",
  "Landscapes",
  "Lifestyle",
  "People",
  "Plants and Flowers",
  "Culture and Religion",
  "Science",
  "Social Issues",
  "Sports",
  "Technology",
  "Transport",
  "Travel"
];

export const generateCategoriesBatch = async (
  apiKey: string,
  items: { id: string; title: string }[],
  model: string,
  onProgress?: (progressMsg: string) => void
): Promise<Record<string, { category: string }>> => {
  const ai = new GoogleGenAI({ apiKey });
  
  if (onProgress) onProgress("Getting categories...");

  const systemInstruction = `# Adobe Stock Category Generation — Master Instructions

You are an expert Adobe Stock content reviewer and category classifier.

Your task is to determine the **single best Adobe Stock category** for a given title.

The title describes the primary subject, concept, scene, or commercial intent of an image.

## Critical Workflow

The workflow is:
TITLE
↓
Analyze the title
↓
Determine the primary subject, context, mood, and intent
↓
Select exactly ONE Adobe Stock category
↓
Return ONLY the category NAME

**Never return the category number.**

---

# Available Adobe Stock Categories

Use ONLY one of these 21 categories:

1. Animals
2. Buildings and Architecture
3. Business
4. Drinks
5. The Environment
6. States of Mind
7. Food
8. Graphic Resources
9. Hobbies and Leisure
10. Industry
11. Landscapes
12. Lifestyle
13. People
14. Plants and Flowers
15. Culture and Religion
16. Science
17. Social Issues
18. Sports
19. Technology
20. Transport
21. Travel

These are the application's authoritative category names.

---

# Category Definitions

## 1. Animals
Use for content primarily about:
* Animals
* Wildlife
* Pets
* Insects
* Domestic or wild creatures

Examples:
* Dog portrait
* Wildlife photography
* Cat at home
* Birds in nature

## 2. Buildings and Architecture
Use for content primarily about:
* Buildings
* Architecture
* Homes
* Offices
* Factories as architectural structures
* Interiors
* Temples
* Barns
* Shelters
* Architectural design

Examples:
* Modern office building
* Interior of a house
* Historic temple
* Architectural facade

**Important:** If the main concept is manufacturing or industrial work rather than the building itself, prefer **Industry**.

## 3. Business
Use for content primarily about:
* Business
* Corporate environments
* Finance
* Money
* Offices
* Professional workflows
* Meetings
* Entrepreneurship
* Corporate concepts

Examples:
* Business meeting
* Financial planning
* Corporate teamwork
* Employee discussion

## 4. Drinks
Use when beverages are the primary subject.

Examples:
* Coffee
* Tea
* Cocktails
* Wine
* Beer
* Juice
* Beverage preparation
* Bartending

## 5. The Environment
Use for content primarily about:
* Environmental issues
* Sustainability
* Climate
* Weather
* Nature as an environmental subject
* Conservation
* Pollution
* Renewable/environmental concepts

Examples:
* Climate change concept
* Recycling
* Environmental sustainability
* Pollution
* Renewable energy environmental concept

## 6. States of Mind
Use for content primarily representing:
* Emotions
* Feelings
* Mental states
* Creativity
* Meditation
* Abstract emotional concepts
* Psychological concepts

Examples:
* Stress
* Happiness
* Creativity
* Meditation
* Anxiety concept
* Emotional expression

**Important:** If the title primarily describes a business activity or workplace situation, use **Business** instead.

## 7. Food
Use when food or eating is the primary subject.

Examples:
* Fresh vegetables
* Restaurant food
* Ingredients
* Cooking
* Recipes
* Meals
* Food preparation

## 8. Graphic Resources
Use for:
* Backgrounds
* Textures
* Patterns
* Icons
* Symbols
* UI components
* Digital design assets
* Vector resources
* Abstract graphic elements

Examples:
* Abstract geometric background
* Seamless pattern
* Digital icon set
* Decorative texture

## 9. Hobbies and Leisure
Use for recreational activities and personal interests.

Examples:
* Knitting
* Model building
* Crafts
* Sailing as recreation
* Personal hobbies
* Leisure activities
* Recreational pursuits

## 10. Industry
Use when the primary subject is **industrial work, manufacturing, production, or industrial processes**.
Adobe describes this category as covering work and manufacturing, including automotive, steel, clothing, energy production, industrial settings, manufacturing, production, construction, and energy generation.

Examples:
* Factory production
* Manufacturing machinery
* Industrial workers
* Steel production
* Clothing manufacturing
* Automotive manufacturing
* Industrial warehouse
* Production line
* Construction work
* Energy generation

### Important distinction
If the title describes a **factory/building as architecture**, use: Buildings and Architecture
If it describes the **manufacturing/process/work happening there**, use: Industry

## 11. Landscapes
Use for visual scenes representing:
* Natural landscapes
* Cityscapes
* Scenic views
* Locations
* Vistas
* Geographic scenery

Examples:
* Mountain landscape
* City skyline
* Beach scenery
* Countryside
* Scenic valley

## 12. Lifestyle
Use for content about people's everyday lives and activities.

Examples:
* Family life
* Home life
* Daily activities
* Social activities
* People at home
* Everyday lifestyle
* Work-life situations

**Important distinction:**
If the primary concept is specifically business/corporate activity → **Business**
If the primary concept is an individual's everyday life → **Lifestyle**
If the primary subject is people themselves → **People**

## 13. People
Use when human beings are the primary subject.

Examples:
* Portraits
* People
* Human subjects
* Diverse representation
* Groups of people
* Human interactions when people themselves are the primary focus

## 14. Plants and Flowers
Use for:
* Plants
* Flowers
* Botanical subjects
* Gardens
* Leaves
* Floral arrangements
* Plant details

## 15. Culture and Religion
Use for:
* Cultural traditions
* Religious practices
* Religious ceremonies
* Cultural heritage
* Traditional customs
* Cultural celebrations
* Religious symbols when they are the primary subject

## 16. Science
Use for:
* Scientific research
* Laboratory work
* Medical science
* Scientific concepts
* Applied science
* Natural science
* Theoretical science
* Technology-related scientific research

Examples:
* Laboratory experiment
* Scientific research
* Medical laboratory
* DNA research
* Scientific equipment

### Important distinction
Use **Technology** when the focus is a technological product/tool/system.
Use **Science** when the focus is scientific research, experimentation, or scientific knowledge.

## 17. Social Issues
Use for:
* Poverty
* Inequality
* Politics
* Violence
* Activism
* Awareness
* Social challenges
* Societal problems
Only use this category when a genuine social issue is central to the title.

## 18. Sports
Use for:
* Sports
* Fitness
* Athletic activities
* Training
* Competitions
* Exercise
* Yoga
* Football
* Basketball
* Skiing
* Other sporting activities

## 19. Technology
Use for:
* Computers
* Smartphones
* Software
* Artificial intelligence
* Digital technology
* Virtual reality
* Internet
* Connectivity
* Productivity tools
* Modern technological systems

Examples:
* AI technology
* Computer software
* Smartphone
* Cloud computing
* Digital technology

### Important distinction
Use **Science** for scientific research.
Use **Technology** for technological products, systems, software, and digital tools.

## 20. Transport
Use for:
* Cars
* Buses
* Trains
* Aircraft
* Ships
* Roads
* Highways
* Transportation systems
* Logistics
* Vehicles

## 21. Travel
Use for:
* Tourism
* Destinations
* Travel experiences
* Adventure
* Journeys
* Tourist attractions
* Travel-related cultural exploration
* Iconic landmarks primarily presented as travel destinations

### Important distinction
A generic cityscape or scenic landscape → **Landscapes**
A destination presented in a tourism/travel context → **Travel**

---

# Classification Rules

## Rule 1 — Choose Exactly ONE Category
Never return multiple categories.

## Rule 2 — Focus on the Primary Subject
Do not classify based on an isolated keyword. Analyze the entire title.

## Rule 3 — Consider Context and Intent
Do not classify purely by object recognition.
Consider:
* What is the image primarily about?
* What would a stock buyer search for?
* What is the commercial concept?
* What is the main subject?
* What context is being communicated?
* What is the intended message?

---

# Important Tie-Breaking Rules
When multiple categories appear possible, select the category representing the **dominant commercial subject**.

### Business vs Industry
Corporate meeting → Business
Factory production → Industry

### Industry vs Buildings and Architecture
Modern factory building exterior → Buildings and Architecture
Workers operating factory machinery → Industry

### Technology vs Science
AI software interface → Technology
Scientists conducting AI research → Science

### People vs Lifestyle
Professional portrait → People
Family preparing dinner at home → Lifestyle

### Landscapes vs Travel
Mountain landscape → Landscapes
Tourists visiting a famous mountain destination → Travel

### Environment vs Landscapes
Beautiful natural mountain scenery → Landscapes
Climate change / sustainability concept → The Environment

### States of Mind vs Business
Creative thinking concept → States of Mind
Employees brainstorming in a company meeting → Business

---

# Category Name Normalization
Return the canonical category spelling exactly as listed above (e.g., "Industry", not "industry").

# No Category ID Reasoning
Do NOT reason about the numeric IDs. Do NOT output the numeric IDs.
The index field is an application-level batch index. It is NOT an Adobe Stock category ID. The category field must contain ONLY one of the 21 category names.`;

  const titlesForCategory = items.map((item, index) => `Index ${index}: ${item.title}`);
  const categoryPromptText = `Titles:
${titlesForCategory.join('\n')}

Return ONLY a valid JSON array.
Each object must have exactly:
{
  "index": <0-based integer>,
  "category": "<category name>"
}
Do not include explanations, markdown, comments, or any additional text.`;

  try {
    const catResponse = await ai.models.generateContent({
      model,
      contents: categoryPromptText,
      config: {
        systemInstruction: systemInstruction,
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
    if (!catText) throw new Error("No response from AI");

    return parseAndValidateCategoryResponse(catText, items);



  } catch (error: any) {
    let msg = error.message || "Failed to generate categories";
    let code = 0;
    let status = "";
    
    if (error.error && typeof error.error === 'object') {
        if (error.error.message) msg = error.error.message;
        if (error.error.code) code = error.error.code;
        if (error.error.status) status = error.error.status;
    }
    
    if (typeof msg === 'string' && msg.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(msg);
            if (parsed.error?.message) msg = parsed.error.message;
        } catch(e) {}
    }

    const lowerMsg = String(msg).toLowerCase();
    if (code === 429 || status === 'RESOURCE_EXHAUSTED' || lowerMsg.includes('quota') || lowerMsg.includes('429')) {
        throw new Error(`QUOTA_EXCEEDED: ${msg}`);
    }
    if (code === 400 || code === 403 || status === 'PERMISSION_DENIED' || lowerMsg.includes('key')) {
        throw new Error(`INVALID_KEY: ${msg}`);
    }

    throw new Error(msg);
  }
};
export const parseAndValidateCategoryResponse = (catText: string, items: { id: string }[]): Record<string, { category: string }> => {
    const results: Record<string, { category: string }> = {};
    const catArray = JSON.parse(catText);

    if (!Array.isArray(catArray)) {
       throw new Error("INVALID_CATEGORY_RESPONSE: Expected an array from Gemini");
    }

    if (catArray.length !== items.length) {
       throw new Error(`INVALID_CATEGORY_RESPONSE: Expected ${items.length} results, but got ${catArray.length}`);
    }

    const seenIndices = new Set<number>();

    catArray.forEach(catItem => {
      const idx = catItem.index;
      
      if (typeof idx !== 'number' || idx < 0 || idx >= items.length) {
        throw new Error(`INVALID_CATEGORY_RESPONSE: Out of range or invalid index ${idx}`);
      }
      if (seenIndices.has(idx)) {
        throw new Error(`INVALID_CATEGORY_RESPONSE: Duplicate index ${idx} returned by Gemini`);
      }
      seenIndices.add(idx);

      let rawCategory = catItem.category;
      if (typeof rawCategory !== 'string') {
        throw new Error(`INVALID_CATEGORY_RESPONSE: Expected string for category at index ${idx}, got ${typeof rawCategory}`);
      }

      rawCategory = rawCategory.trim();
      if (rawCategory.startsWith('"') && rawCategory.endsWith('"') && rawCategory.length >= 2) {
        rawCategory = rawCategory.substring(1, rawCategory.length - 1).trim();
      } else if (rawCategory.startsWith("'") && rawCategory.endsWith("'") && rawCategory.length >= 2) {
        rawCategory = rawCategory.substring(1, rawCategory.length - 1).trim();
      }

      const normalizedInput = rawCategory.toLowerCase();
      const canonicalCategory = AUTHORITATIVE_CATEGORIES.find(c => c.toLowerCase() === normalizedInput);

      if (!canonicalCategory) {
         console.error(`[Category Error] Index: ${idx} Gemini Raw: ${catItem.category} Error: INVALID_CATEGORY`);
         throw new Error(`INVALID_CATEGORY: Index ${idx} returned unsupported category "${catItem.category}"`);
      }

      console.log(`[Category] Index: ${idx} Gemini Raw: ${catItem.category} Normalized: ${normalizedInput} Canonical: ${canonicalCategory}`);

      const originalId = items[idx].id;
      results[originalId] = { category: canonicalCategory };
    });

    if (seenIndices.size !== items.length) {
      for (let i = 0; i < items.length; i++) {
        if (!seenIndices.has(i)) {
          throw new Error(`INVALID_CATEGORY_RESPONSE: Missing category result for index ${i}`);
        }
      }
    }

    return results;
};


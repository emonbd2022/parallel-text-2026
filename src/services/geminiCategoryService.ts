import { GoogleGenAI, Type } from '@google/genai';

export const AUTHORITATIVE_CATEGORIES = [
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

export const NUMERIC_CATEGORY_MAP: Record<string, string> = {
  "1": "Animals",
  "2": "Buildings and Architecture",
  "3": "Business",
  "4": "Drinks",
  "5": "The Environment",
  "6": "States of Mind",
  "7": "Food",
  "8": "Graphic Resources",
  "9": "Hobbies and Leisure",
  "10": "Industry",
  "11": "Landscapes",
  "12": "Lifestyle",
  "13": "People",
  "14": "Plants and Flowers",
  "15": "Culture and Religion",
  "16": "Science",
  "17": "Social Issues",
  "18": "Sports",
  "19": "Technology",
  "20": "Transport",
  "21": "Travel"
};

export const CATEGORY_SYNONYMS: Record<string, string> = {
  "animals": "Animals",
  "animal": "Animals",
  "wildlife": "Animals",
  "pet": "Animals",
  "pets": "Animals",
  "mammal": "Animals",
  "mammals": "Animals",
  "bird": "Animals",
  "birds": "Animals",
  "fish": "Animals",
  "insect": "Animals",
  "insects": "Animals",
  "cat": "Animals",
  "dog": "Animals",
  "cats": "Animals",
  "dogs": "Animals",
  "fauna": "Animals",

  "buildings and architecture": "Buildings and Architecture",
  "buildings & architecture": "Buildings and Architecture",
  "building and architecture": "Buildings and Architecture",
  "building & architecture": "Buildings and Architecture",
  "architecture": "Buildings and Architecture",
  "architectural": "Buildings and Architecture",
  "buildings": "Buildings and Architecture",
  "building": "Buildings and Architecture",
  "interior": "Buildings and Architecture",
  "interiors": "Buildings and Architecture",
  "room": "Buildings and Architecture",
  "rooms": "Buildings and Architecture",
  "cityscape": "Buildings and Architecture",
  "urban": "Buildings and Architecture",
  "real estate": "Buildings and Architecture",
  "house": "Buildings and Architecture",
  "houses": "Buildings and Architecture",
  "skyscraper": "Buildings and Architecture",
  "skyscrapers": "Buildings and Architecture",

  "business": "Business",
  "finance": "Business",
  "corporate": "Business",
  "office": "Business",
  "offices": "Business",
  "workplace": "Business",
  "commerce": "Business",
  "commercial": "Business",
  "banking": "Business",
  "economy": "Business",
  "marketing": "Business",
  "investment": "Business",

  "drinks": "Drinks",
  "drink": "Drinks",
  "beverage": "Drinks",
  "beverages": "Drinks",
  "cocktail": "Drinks",
  "cocktails": "Drinks",
  "coffee": "Drinks",
  "tea": "Drinks",
  "wine": "Drinks",
  "beer": "Drinks",
  "juice": "Drinks",
  "juices": "Drinks",
  "liquor": "Drinks",

  "the environment": "The Environment",
  "environment": "The Environment",
  "environmental": "The Environment",
  "nature & environment": "The Environment",
  "climate": "The Environment",
  "ecology": "The Environment",
  "recycling": "The Environment",
  "conservation": "The Environment",
  "green energy": "The Environment",
  "sustainability": "The Environment",

  "states of mind": "States of Mind",
  "state of mind": "States of Mind",
  "emotion": "States of Mind",
  "emotions": "States of Mind",
  "feeling": "States of Mind",
  "feelings": "States of Mind",
  "mood": "States of Mind",
  "moods": "States of Mind",
  "concept": "States of Mind",
  "conceptual": "States of Mind",
  "mindset": "States of Mind",
  "mental health": "States of Mind",
  "surreal": "States of Mind",

  "food": "Food",
  "foods": "Food",
  "meal": "Food",
  "meals": "Food",
  "cooking": "Food",
  "baking": "Food",
  "fruit": "Food",
  "fruits": "Food",
  "vegetable": "Food",
  "vegetables": "Food",
  "culinary": "Food",
  "dish": "Food",
  "dishes": "Food",
  "cuisine": "Food",
  "bakery": "Food",
  "dessert": "Food",
  "desserts": "Food",

  "graphic resources": "Graphic Resources",
  "graphic resource": "Graphic Resources",
  "graphics": "Graphic Resources",
  "graphic": "Graphic Resources",
  "background": "Graphic Resources",
  "backgrounds": "Graphic Resources",
  "texture": "Graphic Resources",
  "textures": "Graphic Resources",
  "pattern": "Graphic Resources",
  "patterns": "Graphic Resources",
  "vector": "Graphic Resources",
  "vectors": "Graphic Resources",
  "illustration": "Graphic Resources",
  "illustrations": "Graphic Resources",
  "banner": "Graphic Resources",
  "banners": "Graphic Resources",
  "abstract": "Graphic Resources",
  "abstracts": "Graphic Resources",
  "icon": "Graphic Resources",
  "icons": "Graphic Resources",
  "template": "Graphic Resources",
  "wallpaper": "Graphic Resources",

  "hobbies and leisure": "Hobbies and Leisure",
  "hobbies & leisure": "Hobbies and Leisure",
  "hobby and leisure": "Hobbies and Leisure",
  "hobbies": "Hobbies and Leisure",
  "hobby": "Hobbies and Leisure",
  "leisure": "Hobbies and Leisure",
  "craft": "Hobbies and Leisure",
  "crafts": "Hobbies and Leisure",
  "pastime": "Hobbies and Leisure",
  "recreation": "Hobbies and Leisure",
  "gaming": "Hobbies and Leisure",
  "games": "Hobbies and Leisure",
  "music": "Hobbies and Leisure",
  "musical": "Hobbies and Leisure",
  "reading": "Hobbies and Leisure",

  "industry": "Industry",
  "industrial": "Industry",
  "manufacturing": "Industry",
  "factory": "Industry",
  "factories": "Industry",
  "construction": "Industry",
  "engineering": "Industry",
  "production": "Industry",
  "warehouse": "Industry",
  "machinery": "Industry",

  "landscapes": "Landscapes",
  "landscape": "Landscapes",
  "nature": "Landscapes",
  "scenery": "Landscapes",
  "scenic": "Landscapes",
  "mountains": "Landscapes",
  "mountain": "Landscapes",
  "forest": "Landscapes",
  "forests": "Landscapes",
  "sea": "Landscapes",
  "ocean": "Landscapes",
  "beach": "Landscapes",
  "beaches": "Landscapes",
  "sky": "Landscapes",
  "sunset": "Landscapes",
  "sunrise": "Landscapes",
  "countryside": "Landscapes",

  "lifestyle": "Lifestyle",
  "life style": "Lifestyle",
  "daily life": "Lifestyle",
  "wellness": "Lifestyle",
  "home": "Lifestyle",
  "family life": "Lifestyle",
  "living": "Lifestyle",
  "routine": "Lifestyle",

  "people": "People",
  "person": "People",
  "human": "People",
  "humans": "People",
  "portrait": "People",
  "portraits": "People",
  "man": "People",
  "men": "People",
  "woman": "People",
  "women": "People",
  "child": "People",
  "children": "People",
  "family": "People",
  "crowd": "People",
  "baby": "People",
  "couple": "People",

  "plants and flowers": "Plants and Flowers",
  "plants & flowers": "Plants and Flowers",
  "plant and flower": "Plants and Flowers",
  "plants": "Plants and Flowers",
  "plant": "Plants and Flowers",
  "flowers": "Plants and Flowers",
  "flower": "Plants and Flowers",
  "flora": "Plants and Flowers",
  "botanical": "Plants and Flowers",
  "botany": "Plants and Flowers",
  "gardening": "Plants and Flowers",
  "tree": "Plants and Flowers",
  "trees": "Plants and Flowers",

  "culture and religion": "Culture and Religion",
  "culture & religion": "Culture and Religion",
  "culture": "Culture and Religion",
  "religion": "Culture and Religion",
  "cultural": "Culture and Religion",
  "religious": "Culture and Religion",
  "tradition": "Culture and Religion",
  "traditional": "Culture and Religion",
  "festival": "Culture and Religion",
  "festivals": "Culture and Religion",
  "celebration": "Culture and Religion",
  "holiday": "Culture and Religion",
  "holidays": "Culture and Religion",
  "spiritual": "Culture and Religion",
  "spirituality": "Culture and Religion",

  "science": "Science",
  "scientific": "Science",
  "medical": "Science",
  "medicine": "Science",
  "healthcare": "Science",
  "health": "Science",
  "laboratory": "Science",
  "lab": "Science",
  "chemistry": "Science",
  "biology": "Science",
  "physics": "Science",
  "research": "Science",
  "pharmacy": "Science",

  "social issues": "Social Issues",
  "social issue": "Social Issues",
  "society": "Social Issues",
  "poverty": "Social Issues",
  "protest": "Social Issues",
  "protests": "Social Issues",
  "equality": "Social Issues",
  "human rights": "Social Issues",
  "politics": "Social Issues",
  "diversity": "Social Issues",

  "sports": "Sports",
  "sport": "Sports",
  "fitness": "Sports",
  "athlete": "Sports",
  "athletes": "Sports",
  "athletic": "Sports",
  "exercise": "Sports",
  "workout": "Sports",
  "football": "Sports",
  "soccer": "Sports",
  "basketball": "Sports",
  "running": "Sports",
  "gym": "Sports",

  "technology": "Technology",
  "tech": "Technology",
  "computer": "Technology",
  "computers": "Technology",
  "ai": "Technology",
  "artificial intelligence": "Technology",
  "digital": "Technology",
  "software": "Technology",
  "electronics": "Technology",
  "internet": "Technology",
  "cyber": "Technology",
  "robotics": "Technology",

  "transport": "Transport",
  "transportation": "Transport",
  "vehicles": "Transport",
  "vehicle": "Transport",
  "cars": "Transport",
  "car": "Transport",
  "traffic": "Transport",
  "road": "Transport",
  "aviation": "Transport",
  "airplane": "Transport",
  "airplanes": "Transport",
  "plane": "Transport",
  "planes": "Transport",
  "train": "Transport",
  "trains": "Transport",
  "ship": "Transport",
  "ships": "Transport",
  "boat": "Transport",
  "boats": "Transport",
  "automobile": "Transport",

  "travel": "Travel",
  "tourism": "Travel",
  "vacation": "Travel",
  "vacations": "Travel",
  "holiday travel": "Travel",
  "tourist": "Travel",
  "tourists": "Travel",
  "trip": "Travel",
  "journey": "Travel",
  "destination": "Travel",
  "landmark": "Travel",
  "landmarks": "Travel"
};

/**
 * High-accuracy fallback classifier for Adobe Stock categories based on title content.
 * Guarantees that any image title maps to one of the 21 authoritative Adobe categories.
 */
export const classifyTitleFallback = (title?: string): string => {
  if (!title) return "Graphic Resources";
  const t = title.toLowerCase();

  if (/\b(dog|cat|bird|fish|animal|animals|wildlife|lion|tiger|bear|horse|deer|puppy|kitten|wolf|elephant|monkey|fox|rabbit|fauna|whale|shark|dolphin|eagle|owl|insect|bee|butterfly|pet|pets)\b/.test(t)) {
    return "Animals";
  }
  if (/\b(drink|drinks|cocktail|cocktails|coffee|tea|wine|beer|juice|juices|beverage|beverages|cup of|latte|espresso|smoothie|whiskey|vodka|soda|champagne|mug)\b/.test(t)) {
    return "Drinks";
  }
  if (/\b(food|foods|cake|bread|pizza|burger|fruit|fruits|vegetable|vegetables|meat|salad|dish|dishes|cuisine|cooking|baking|delicious|pasta|cheese|dessert|lunch|dinner|breakfast|snack|restaurant|soup|culinary|chef|bakery)\b/.test(t)) {
    return "Food";
  }
  if (/\b(flower|flowers|rose|floral|plant|plants|botanical|leaf|leaves|garden|flora|succulent|cactus|tree|trees|bloom|tulip|sunflower|herb|moss|foliage)\b/.test(t)) {
    return "Plants and Flowers";
  }
  if (/\b(building|buildings|architecture|architectural|skyscraper|skyscrapers|house|houses|interior|room|rooms|facade|bridge|palace|castle|tower|urban|cityscape|monument|hall|hotel|apartment|construction|window|villa)\b/.test(t)) {
    return "Buildings and Architecture";
  }
  if (/\b(car|cars|vehicle|vehicles|traffic|drive|driving|road|highway|transport|train|trains|airplane|plane|planes|flight|aviation|ship|ships|boat|boats|yacht|bicycle|bike|motorcycle|bus|truck|metro|subway)\b/.test(t)) {
    return "Transport";
  }
  if (/\b(sport|sports|fitness|gym|workout|running|runner|athlete|athletes|football|soccer|basketball|tennis|yoga|swimming|marathon|training|skiing|boxing|cycling|climbing|baseball|golf)\b/.test(t)) {
    return "Sports";
  }
  if (/\b(technology|tech|ai|robot|robotics|computer|computers|software|coding|cyber|digital|circuit|virtual reality|vr|smartphone|laptop|data|network|server|microchip|future|futuristic|internet|hologram)\b/.test(t)) {
    return "Technology";
  }
  if (/\b(business|finance|corporate|office|offices|meeting|colleague|colleagues|handshake|marketing|money|currency|investment|stock market|worker|coworker|entrepreneur|chart|analytics|bank|banking)\b/.test(t)) {
    return "Business";
  }
  if (/\b(science|scientific|laboratory|lab|microscope|medical|medicine|doctor|nurse|healthcare|hospital|dna|virus|chemistry|biology|physics|research|pharmacy|vaccine|patient)\b/.test(t)) {
    return "Science";
  }
  if (/\b(travel|tourism|tourist|tourists|vacation|vacations|holiday|destination|destinations|journey|trip|resort|luggage|passport|exotic|explore|adventure|sightseeing|safari)\b/.test(t)) {
    return "Travel";
  }
  if (/\b(landscape|landscapes|mountain|mountains|sea|ocean|beach|beaches|sunset|sunrise|nature|forest|forests|lake|river|sky|clouds|scenery|scenic|desert|waterfall|valley|coast|cliff|countryside)\b/.test(t)) {
    return "Landscapes";
  }
  if (/\b(man|woman|men|women|people|person|portrait|portraits|child|children|girl|boy|face|family|couple|crowd|model|female|male|human|humans|baby|teenager|senior|elderly|hands)\b/.test(t)) {
    return "People";
  }
  if (/\b(lifestyle|wellness|home|living room|cozy|morning|relaxation|daily life|mindfulness|meditation|routine|kitchen|self-care)\b/.test(t)) {
    return "Lifestyle";
  }
  if (/\b(culture|religion|religious|spiritual|temple|church|mosque|shrine|god|pray|prayer|faith|tradition|traditional|ceremony|festival|festivals|celebration|christmas|easter|diwali|ramadan|ritual)\b/.test(t)) {
    return "Culture and Religion";
  }
  if (/\b(social issues|protest|protests|poverty|equality|justice|diversity|community|homeless|charity|human rights|strike|demonstration|politics)\b/.test(t)) {
    return "Social Issues";
  }
  if (/\b(hobby|hobbies|craft|crafts|painting|drawing|artist|guitar|piano|music|musical|gaming|videogame|reading|book|books|chess|dance|dancing|sewing)\b/.test(t)) {
    return "Hobbies and Leisure";
  }
  if (/\b(industry|industrial|factory|factories|manufacturing|warehouse|machinery|engineer|steel|power plant|crane|production line|worker with helmet|workshop)\b/.test(t)) {
    return "Industry";
  }
  if (/\b(environment|climate|ecology|pollution|recycling|green energy|solar panel|wind turbine|conservation|renewable|eco friendly|global warming)\b/.test(t)) {
    return "The Environment";
  }
  if (/\b(emotion|emotions|sad|happy|lonely|stress|depression|joy|hope|peace|concept|conceptual|surreal|symbolic|mind|thought|thinking|fear|love|dream|nightmare|inspiration)\b/.test(t)) {
    return "States of Mind";
  }
  if (/\b(background|backgrounds|texture|textures|pattern|patterns|vector|vectors|illustration|illustrations|abstract|graphic|graphics|banner|isolated|template|wallpaper|icon|design|element|frame|border|watercolor|canvas)\b/.test(t)) {
    return "Graphic Resources";
  }

  return "Graphic Resources";
};

/**
 * Normalizes any category string into one of the 21 canonical Adobe Stock categories.
 * Never throws an error; falls back gracefully to title classification.
 */
export const matchCanonicalCategory = (rawCategory?: string, title?: string): string => {
  if (rawCategory && typeof rawCategory === 'string') {
    let clean = rawCategory.trim();
    if (clean.startsWith('"') && clean.endsWith('"') && clean.length >= 2) {
      clean = clean.substring(1, clean.length - 1).trim();
    } else if (clean.startsWith("'") && clean.endsWith("'") && clean.length >= 2) {
      clean = clean.substring(1, clean.length - 1).trim();
    }

    // Strip leading number or prefix (e.g., "1. Animals" -> "Animals", "Category 5: The Environment" -> "The Environment")
    clean = clean.replace(/^(?:category\s*)?#?\d+[\s.:\-–—]+\s*/i, '').trim();

    // Check direct numeric ID (e.g. "1", "2")
    if (NUMERIC_CATEGORY_MAP[clean]) {
      return NUMERIC_CATEGORY_MAP[clean];
    }

    const lower = clean.toLowerCase();

    // 1. Direct canonical match
    const exact = AUTHORITATIVE_CATEGORIES.find(c => c.toLowerCase() === lower);
    if (exact) return exact;

    // 2. Direct synonym match
    if (CATEGORY_SYNONYMS[lower]) {
      return CATEGORY_SYNONYMS[lower];
    }

    // 3. Word containment match
    for (const auth of AUTHORITATIVE_CATEGORIES) {
      const authLower = auth.toLowerCase();
      if (lower.includes(authLower) || authLower.includes(lower)) {
        return auth;
      }
    }
  }

  // 4. Fallback classification via title
  return classifyTitleFallback(title);
};

export const generateCategoriesBatch = async (
  apiKey: string,
  items: { id: string; title: string }[],
  model: string,
  onProgress?: (progressMsg: string) => void,
  localKeys?: string[],
  isAdmin?: boolean,
  hasExplicitAdminGrant?: boolean,
  signal?: AbortSignal
): Promise<Record<string, { category: string }>> => {
  if (apiKey.startsWith('central-') || !apiKey.startsWith('AIza')) {
    if (onProgress) onProgress("Getting categories (Central)...");
    
    // Attempt to get auth token and device ID for server-side enforcement
    let token = '';
    let deviceId = '';
    try {
      const { auth } = await import('../lib/firebase');
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
      deviceId = localStorage.getItem('parrarel_device_id_v2') || '';
    } catch (e) {}

    const res = await fetch('/api/central-category', {
       method: 'POST',
       signal,
       headers: { 
         'Content-Type': 'application/json',
         ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
         ...(deviceId ? { 'X-Device-Id': deviceId } : {})
       },
       body: JSON.stringify({ items, model, virtualKeyId: apiKey, localKeys, isAdmin, hasExplicitAdminGrant })
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error("Central API backend routing error: production endpoint returned HTML instead of JSON.");
    }
    if (!res.ok) {
        let errMsg = await res.text();
        try {
            const errObj = JSON.parse(errMsg);
            if (errObj.message) {
              errMsg = errObj.message;
            } else if (errObj.error) {
              errMsg = errObj.error;
            }
        } catch {}
        throw new Error(errMsg || `Server error ${res.status}`);
    }
    if (!contentType.includes('application/json')) {
      throw new Error(`Invalid response format from Central API (received ${contentType || 'unknown'}). Expected JSON.`);
    }
    return await res.json();
  }

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
        abortSignal: signal,
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
    if (signal?.aborted || error?.name === 'AbortError' || error?.message?.includes('aborted')) {
      const abortErr = new Error("Request aborted");
      abortErr.name = "AbortError";
      throw abortErr;
    }
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
export const parseAndValidateCategoryResponse = (
  catText: string, 
  items: { id: string; title?: string }[]
): Record<string, { category: string }> => {
    const results: Record<string, { category: string }> = {};
    if (!catText || typeof catText !== 'string') {
      for (const item of items) {
        results[item.id] = { category: matchCanonicalCategory('', item.title) };
      }
      return results;
    }

    let cleanText = catText.trim();
    // Strip markdown code fences
    cleanText = cleanText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

    let catArray: any[] = [];
    try {
      const parsed = JSON.parse(cleanText);
      if (Array.isArray(parsed)) {
        catArray = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.categories)) {
          catArray = parsed.categories;
        } else if (Array.isArray(parsed.items)) {
          catArray = parsed.items;
        } else if (Array.isArray(parsed.results)) {
          catArray = parsed.results;
        } else if (Array.isArray(parsed.data)) {
          catArray = parsed.data;
        } else if (parsed.category !== undefined) {
          catArray = [parsed];
        }
      }
    } catch (e) {
      // Regex extraction fallback for embedded arrays
      const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          const arr = JSON.parse(arrayMatch[0]);
          if (Array.isArray(arr)) catArray = arr;
        } catch (e2) {}
      }
      if (catArray.length === 0) {
        const objMatch = cleanText.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try {
            const obj = JSON.parse(objMatch[0]);
            if (obj && obj.category) catArray = [obj];
          } catch (e3) {}
        }
      }
    }

    // Map extracted entries by index and/or id
    const foundByIndex = new Map<number, string>();
    const foundById = new Map<string, string>();

    catArray.forEach((catItem, arrIdx) => {
      if (!catItem || typeof catItem !== 'object') return;
      const rawCat = String(catItem.category || catItem.name || catItem.val || catItem.classification || '');
      const itemIdx = typeof catItem.index === 'number' ? catItem.index : arrIdx;
      if (typeof itemIdx === 'number' && itemIdx >= 0 && itemIdx < items.length) {
        foundByIndex.set(itemIdx, rawCat);
      }
      if (catItem.id && typeof catItem.id === 'string') {
        foundById.set(catItem.id, rawCat);
      }
    });

    // Populate every item in items array without dropping any
    items.forEach((item, idx) => {
      const rawCat = foundById.get(item.id) || foundByIndex.get(idx) || '';
      const canonical = matchCanonicalCategory(rawCat, item.title);
      results[item.id] = { category: canonical };
    });

    return results;
};


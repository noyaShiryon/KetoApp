import { FoodItem } from './types';
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const KETO_PROMPT = `
You are an expert ketogenic nutritionist. Analyze the image of the plate.
1. Identify all food items, estimate weights, calculate macros (netCarbs, protein, fat, calories), and determine if animalSource.
2. CRITICAL KETO CHECK: Check if any item contains suspected HIDDEN CARBS, added sugars, starches, thickeners, or breading (especially in sauces or processed meats).

Respond ONLY with a raw JSON object matching this exact structure:
{
  "hiddenCarbsAlert": "Hebrew warning text explaining suspected hidden carbs/sugars, or null if perfectly clean",
  "items": [
    {
      "id": "string",
      "name": "Hebrew food name",
      "grams": number,
      "isAnimalSource": boolean,
      "macros": { "netCarbs": number, "protein": number, "fat": number, "calories": number }
    }
  ]
}
`;

async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      resolve(base64String.split(',')[1] || base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// הגדרת טיפוס לתשובה שחוזרת מהשירות
interface AIAnalysisResult {
  items: FoodItem[];
  hiddenCarbsAlert: string | null;
}

export async function analyzeMealImage(imageUri: string): Promise<AIAnalysisResult> {
  try {
    const base64Image = await uriToBase64(imageUri);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: KETO_PROMPT },
              { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
            ]
          }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Google API Error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("גוגל החזיר תשובה ריקה.");
    }
    
    let jsonText = data.candidates[0].content.parts[0].text;
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const result: AIAnalysisResult = JSON.parse(jsonText);
    return result;

  } catch (error) {
    console.error("AI Service failure details:", error);
    throw error;
  }
}
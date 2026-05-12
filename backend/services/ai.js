const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

// ── Gemini client ────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const GEMINI_MODEL = 'gemini-2.5-flash';

// ── Allowed departments ──────────────────────────────────────────────────────
const ALLOWED_DEPARTMENTS = [
  'Electrical Department',
  'Roads & Infrastructure',
  'Water Supply',
  'Municipal Corporation',
  'Sanitation Department',
  'others',
];

const DEPARTMENT_SYNONYMS = {
  electrical: 'Electrical Department',
  electricity: 'Electrical Department',
  streetlight: 'Electrical Department',
  road: 'Roads & Infrastructure',
  roads: 'Roads & Infrastructure',
  infrastructure: 'Roads & Infrastructure',
  pothole: 'Roads & Infrastructure',
  water: 'Water Supply',
  pipeline: 'Water Supply',
  municipal: 'Municipal Corporation',
  sanitation: 'Sanitation Department',
  garbage: 'Sanitation Department',
  sewage: 'Sanitation Department',
  sewer: 'Sanitation Department',
  drain: 'Sanitation Department',
  other: 'others',
  others: 'others',
};

function normalizeDepartment(value) {
  if (!value) return 'others';
  const trimmed = String(value).trim();
  const exact = ALLOWED_DEPARTMENTS.find(
    (d) => d.toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) return exact;

  const lowered = trimmed.toLowerCase();
  for (const key of Object.keys(DEPARTMENT_SYNONYMS)) {
    if (lowered.includes(key)) {
      return DEPARTMENT_SYNONYMS[key];
    }
  }

  return 'others';
}

/**
 * Classify a grievance using Gemini AI.
 * Classification is based STRICTLY on the image — not the user description.
 */
async function analyzeGrievance(imageUrl = '', description = '', base64ImageOnly = '', mimeType = 'image/jpeg') {
  const prompt = `[ignoring loop detection]
Classify this civic complaint image. Analyze what is visually present in the image and respond with a single JSON object.

Department must be exactly one of: "Electrical Department", "Roads & Infrastructure", "Water Supply", "Sanitation Department", "Municipal Corporation", "others"

Department mapping by visual content:
Electrical Department: streetlight, electric pole, broken wire, power issue
Roads & Infrastructure: pothole, cracked road, broken path, road damage
Water Supply: pipe leak, burst pipe, water logging from pipeline
Sanitation Department: garbage pile, open drain, sewage overflow, waste dump
Municipal Corporation: encroachment, illegal structure, broken public property
others: image is unclear or does not match above

Severity: high = danger/major damage, medium = needs attention, low = minor issue

Context from user (only use for summary text, not for department or category): "${description || 'none'}"

Respond with only this JSON:
{"category":"<what you see>","department":"<one of the 6 above>","summary":"<one sentence>","severity":"<low|medium|high>"}`;

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const parts = [
      { text: prompt }
    ];

    if (base64ImageOnly) {
      parts.push({
        inlineData: {
          data: base64ImageOnly,
          mimeType: mimeType
        }
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const raw = response.text();

    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Gemini response');

    const parsedResult = JSON.parse(jsonMatch[0]);

    // Normalize and strictly validate department against the allowed list
    parsedResult.department = normalizeDepartment(parsedResult.department);

    // Validate required fields
    if (!parsedResult.category || !parsedResult.department || !parsedResult.summary || !parsedResult.severity) {
      throw new Error('Incomplete JSON from Gemini');
    }

    console.log('✅ AI Classification (image-based):', parsedResult);
    return parsedResult;

  } catch (err) {
    console.error('Gemini AI error:', err.message);
    throw new Error('AI_CLASSIFICATION_FAILED');
  }
}

module.exports = { analyzeGrievance, normalizeDepartment, ALLOWED_DEPARTMENTS };

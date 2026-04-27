const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

/**
 * Classify a grievance image using Google Gemini Flash (free tier).
 * Falls back gracefully if API key is missing or request fails.
 */
async function analyzeGrievance(imageUrl, description = '') {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  GEMINI_API_KEY not set — using keyword fallback classifier');
    return keywordFallback(description, imageUrl);
  }

  const prompt = `You are an AI for a citizen grievance classification system.
Analyze this image URL and the user description below, then return ONLY a valid JSON object (no markdown, no extra text) with these fields:
- "category": type of problem (e.g., "Pothole", "Broken Streetlight", "Water Leakage", "Garbage Dumping", "Sewage Overflow", "Encroachment", "Road Damage", "Other")
- "department": responsible government department (e.g., "Roads & Infrastructure", "Electrical Department", "Water Supply", "Sanitation Department", "Municipal Corporation")
- "summary": one short sentence in English describing the problem
- "severity": "low", "medium", or "high"

Image URL: ${imageUrl}
User description: "${description || 'No description provided'}"

Respond with ONLY the JSON object.`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
      },
      { timeout: 20000 }
    );

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in Gemini response');

    const result = JSON.parse(jsonMatch[0]);
    // Validate required fields
    if (!result.category || !result.department || !result.summary || !result.severity) {
      throw new Error('Incomplete JSON from Gemini');
    }
    return result;

  } catch (err) {
    console.error('Gemini AI error:', err.message);
    return keywordFallback(description, imageUrl);
  }
}

/**
 * Rule-based keyword fallback when AI is unavailable.
 */
function keywordFallback(description = '', imageUrl = '') {
  const text = (description + ' ' + imageUrl).toLowerCase();

  if (text.includes('pothole') || text.includes('road') || text.includes('crack'))
    return { category: 'Pothole', department: 'Roads & Infrastructure', summary: 'Road damage or pothole reported by citizen.', severity: 'high' };

  if (text.includes('light') || text.includes('lamp') || text.includes('electric'))
    return { category: 'Broken Streetlight', department: 'Electrical Department', summary: 'Streetlight or electrical issue reported.', severity: 'medium' };

  if (text.includes('water') || text.includes('leak') || text.includes('pipe'))
    return { category: 'Water Leakage', department: 'Water Supply', summary: 'Water leakage or pipe issue reported.', severity: 'high' };

  if (text.includes('garbage') || text.includes('waste') || text.includes('trash') || text.includes('dump'))
    return { category: 'Garbage Dumping', department: 'Sanitation Department', summary: 'Garbage or waste dumping reported.', severity: 'medium' };

  if (text.includes('sewer') || text.includes('drain') || text.includes('sewage'))
    return { category: 'Sewage Overflow', department: 'Sanitation Department', summary: 'Sewage or drainage issue reported.', severity: 'high' };

  return { category: 'General Complaint', department: 'Municipal Corporation', summary: description || 'Citizen complaint submitted.', severity: 'medium' };
}

module.exports = { analyzeGrievance };

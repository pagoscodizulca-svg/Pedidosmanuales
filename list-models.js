import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    // The google genai sdk models.list might not exist or differs. Let's just do a generic fetch using REST.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    console.log(data.models?.map(m => m.name).join(', '));
  } catch (e) {
    console.error(e.message);
  }
}
run();

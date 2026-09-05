require("dotenv").config();

const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function detectSerial(imagePath) {
  const imageBytes = fs.readFileSync(imagePath);

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBytes.toString("base64"),
        },
      },
      {
        text: `
Extract ONLY the serial number from this image.

Rules:
- Return only the serial number.
- No explanation.
- No markdown.
- If no serial number exists return UNKNOWN.
`,
      },
    ],
  });

  return response.text.trim();
}

module.exports = { detectSerial };
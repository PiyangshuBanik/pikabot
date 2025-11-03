import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not defined in .env file");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Text chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    // Simple generation without history for now
    const result = await model.generateContent(message);
    const response = result.response.text();

    res.json({ reply: response });
  } catch (error) {
    console.error("❌ Chat Error:", error);
    res.status(500).json({ error: "Error generating response" });
  }
});

// Image generation endpoint
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    res.json({ 
      message: "Image generation requires additional API integration (DALL-E, Stable Diffusion, etc.)",
      suggestion: "I can help describe images or analyze them instead!"
    });
  } catch (error) {
    console.error("❌ Image Generation Error:", error);
    res.status(500).json({ error: "Error generating image" });
  }
});

// Image recognition endpoint
app.post("/analyze-image", upload.single("image"), async (req, res) => {
  try {
    const { prompt } = req.body;
    const imagePath = req.file.path;

    // Read the image file
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString("base64");

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const result = await model.generateContent([
      prompt || "Describe this image in detail",
      {
        inlineData: {
          data: base64Image,
          mimeType: req.file.mimetype,
        },
      },
    ]);

    const response = result.response.text();

    // Clean up uploaded file
    fs.unlinkSync(imagePath);

    res.json({ reply: response });
  } catch (error) {
    console.error("❌ Image Analysis Error:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "Error analyzing image" });
  }
});

// File reading endpoint (TXT files)
app.post("/read-file", upload.single("file"), async (req, res) => {
  try {
    const { prompt } = req.body;
    const filePath = req.file.path;
    
    // Read file content
    const fileContent = fs.readFileSync(filePath, "utf-8");

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const fullPrompt = `${prompt || "Analyze this document"}\n\nDocument content:\n${fileContent.substring(0, 30000)}`; // Limit to ~30k chars
    const result = await model.generateContent(fullPrompt);
    const response = result.response.text();

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({ reply: response });
  } catch (error) {
    console.error("❌ File Reading Error:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "Error reading file. Make sure it's a text file." });
  }
});

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "./public" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 PikaBot running at http://localhost:${PORT}`)
);
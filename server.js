const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Ensure required API keys exist
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY not set in .env file");
    process.exit(1);
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Utility Functions
function getModelInstance(modelName, temperature = 0.7) {
    const models = {
        'gemini-1.5-pro': genAI.getGenerativeModel({ model: 'models/gemini-1.5-pro' }),
        'gemini-1.5-flash': genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' }),
        'gemini-1.0-pro-vision': genAI.getGenerativeModel({ model: 'models/gemini-1.0-pro-vision' })
    };

    return models[modelName] || models['gemini-1.5-pro'];
}


async function convertImageToBase64(filePath) {
    try {
        const imageBuffer = fs.readFileSync(filePath);
        return imageBuffer.toString('base64');
    } catch (error) {
        console.error('Error converting image to base64:', error);
        throw error;
    }
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
}

async function generateTextToSpeech(text) {
    // If you have a TTS service (like Google Cloud TTS, Amazon Polly, etc.)
    // implement the logic here. For now, we'll return null.
    // You can integrate with services like:
    // - Google Cloud Text-to-Speech
    // - Amazon Polly
    // - Microsoft Azure Speech Services
    // - OpenAI TTS API
    
    try {
        // Example with a hypothetical TTS service
        // const ttsResponse = await axios.post('YOUR_TTS_ENDPOINT', {
        //     text: text,
        //     voice: 'en-US-Standard-A',
        //     audioEncoding: 'MP3'
        // });
        // return ttsResponse.data.audioUrl;
        
        return null; // No TTS service configured
    } catch (error) {
        console.error('TTS Error:', error);
        return null;
    }
}

// API Routes

// Main Chat Route
app.post('/api/chat', upload.single('image'), async (req, res) => {
    try {
        const { message, model = 'gemini-pro', temperature = 0.7, maxTokens = 1000 } = req.body;
        const imageFile = req.file;

        console.log('📨 Chat request:', { message, model, hasImage: !!imageFile });

        if (!message && !imageFile) {
            return res.status(400).json({ error: 'Message or image is required' });
        }

        let modelToUse = model;
        let prompt = message || '';

        // If image is provided, use vision model
        if (imageFile) {
            modelToUse = 'gemini-pro-vision';
            console.log('🖼️ Processing image:', imageFile.filename);
        }

        const modelInstance = getModelInstance(modelToUse, parseFloat(temperature));

        let result;

        if (imageFile) {
            // Process with image
            const imageBase64 = await convertImageToBase64(imageFile.path);
            const mimeType = getMimeType(imageFile.path);

            const imagePart = {
                inlineData: {
                    data: imageBase64,
                    mimeType: mimeType
                }
            };

            const promptParts = [prompt || "What's in this image?", imagePart];
            result = await modelInstance.generateContent(promptParts);

            // Clean up uploaded file
            fs.unlinkSync(imageFile.path);
        } else {
            // Text-only processing
            result = await modelInstance.generateContent(prompt);
        }

        const response = await result.response;
        const reply = response.text();

        console.log('✅ Generated response length:', reply.length);

        // Generate audio if TTS is available
        const audioUrl = await generateTextToSpeech(reply);

        res.json({ 
            reply,
            audioUrl,
            model: modelToUse,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Chat error:', error);
        
        // Clean up uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        let errorMessage = 'I encountered an error processing your request. Please try again.';
        
        if (error.message.includes('API_KEY')) {
            errorMessage = 'API configuration error. Please check the server setup.';
        } else if (error.message.includes('quota')) {
            errorMessage = 'API quota exceeded. Please try again later.';
        } else if (error.message.includes('safety')) {
            errorMessage = 'Content was filtered for safety reasons. Please try rephrasing your request.';
        }

        res.status(500).json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Image Generation Route (using external service or placeholder)
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required for image generation' });
        }

        console.log('🎨 Image generation request:', prompt);

        // For image generation, you would typically use:
        // - DALL-E 2/3 via OpenAI API
        // - Midjourney API
        // - Stable Diffusion API
        // - Other image generation services

        // Placeholder implementation - you need to integrate with an actual service
        if (process.env.OPENAI_API_KEY) {
            try {
                const response = await axios.post('https://api.openai.com/v1/images/generations', {
                    prompt: prompt,
                    n: 1,
                    size: "1024x1024"
                }, {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                const imageUrl = response.data.data[0].url;
                console.log('✅ Image generated successfully');

                res.json({ 
                    imageUrl,
                    prompt,
                    timestamp: new Date().toISOString()
                });
            } catch (openaiError) {
                console.error('OpenAI API Error:', openaiError.response?.data || openaiError.message);
                throw new Error('Failed to generate image with OpenAI API');
            }
        } else {
            // Fallback: return a placeholder image
            const placeholderUrl = `https://picsum.photos/1024/1024?random=${Date.now()}`;
            res.json({ 
                imageUrl: placeholderUrl,
                prompt,
                timestamp: new Date().toISOString(),
                note: 'This is a placeholder image. Configure OPENAI_API_KEY for actual image generation.'
            });
        }

    } catch (error) {
        console.error('❌ Image generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate image. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Image Analysis Route
app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
    try {
        const imageFile = req.file;

        if (!imageFile) {
            return res.status(400).json({ error: 'Image file is required' });
        }

        console.log('🔍 Image analysis request:', imageFile.filename);

        const modelInstance = getModelInstance('gemini-pro-vision');
        const imageBase64 = await convertImageToBase64(imageFile.path);
        const mimeType = getMimeType(imageFile.path);

        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: mimeType
            }
        };

        const prompt = `Please provide a detailed analysis of this image. Include:
        1. What you see in the image
        2. Colors, composition, and visual elements
        3. Any text or objects you can identify
        4. The mood or atmosphere of the image
        5. Any interesting or notable features`;

        const result = await modelInstance.generateContent([prompt, imagePart]);
        const response = await result.response;
        const analysis = response.text();

        // Clean up uploaded file
        fs.unlinkSync(imageFile.path);

        console.log('✅ Image analysis completed');

        res.json({ 
            analysis,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Image analysis error:', error);
        
        // Clean up uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ 
            error: 'Failed to analyze image. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Health Check Route
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        services: {
            gemini: !!process.env.GEMINI_API_KEY,
            openai: !!process.env.OPENAI_API_KEY
        }
    });
});

// Models Info Route
app.get('/api/models', (req, res) => {
    res.json({
        available: [
            {
                id: 'gemini-pro',
                name: 'Gemini Pro',
                description: 'Best for text-based conversations',
                capabilities: ['text']
            },
            {
                id: 'gemini-pro-vision',
                name: 'Gemini Pro Vision',
                description: 'Best for image analysis and vision tasks',
                capabilities: ['text', 'vision']
            }
        ]
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
    }
    
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(port, () => {
    console.log(`🚀 GeminiBot server running at http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
    console.log(`🤖 Available models: http://localhost:${port}/api/models`);
    
    // Log configuration status
    console.log('\n📋 Configuration Status:');
    console.log(`   Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing (Image gen disabled)'}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    process.exit(0);
});
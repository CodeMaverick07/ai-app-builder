require("dotenv").config();
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BASE_PROMPT, getSystemPrompt } from "./prompts";
import { basePrompt as nodeBasePrompt } from "./defaults/node";
import { basePrompt as reactBasePrompt } from "./defaults/react";

// Initialize Google Generative AI with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

// Create a model instance with system instruction
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: getSystemPrompt(),
});

const app = express();
app.use(cors());
app.use(express.json());

// Store conversation history for chat
let conversationHistory: { role: string; parts: { text: string }[] }[] = [];

// Template endpoint to decide between "node" or "react"
app.post("/template", async (req, res) => {
  try {
    const prompt = req.body.prompt;

    // Generate content using Gemini API
    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${prompt}\nReturn either node or react based on what this project should be. Only return a single word: 'node' or 'react'. Do not return anything extra.`,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.7,
      },
    });

    const answer = response.response.text().trim().toLowerCase(); // Extract response
    console.log(answer);

    if (answer === "react") {
      res.json({
        prompts: [
          BASE_PROMPT,
          `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`,
        ],
        uiPrompts: [reactBasePrompt],
      });
      return;
    }

    if (answer === "node") {
      res.json({
        prompts: [
          `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${nodeBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`,
        ],
        uiPrompts: [nodeBasePrompt],
      });
      return;
    }

    res.status(403).json({ message: "Invalid response from AI" });
  } catch (error) {
    console.error("Error in /template:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Chat endpoint to handle multi-turn conversations
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.messages;
    console.log(req.body);

    // Add user message to conversation history
    conversationHistory.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    // Initialize chat with history
    const chat = model.startChat({ history: conversationHistory });

    // Generate response from the AI
    const result = await chat.sendMessage(userMessage);

    // Add AI's response to the conversation history
    const aiResponse = result.response.text();
    conversationHistory.push({
      role: "model",
      parts: [{ text: aiResponse }],
    });

    res.json({
      response: aiResponse, // Return AI's response
    });
  } catch (error) {
    console.error("Error in /chat:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Start the server
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

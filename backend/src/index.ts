require("dotenv").config();
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BASE_PROMPT, getSystemPrompt } from "./prompts";
import { basePrompt as nodeBasePrompt } from "./defaults/node";
import { basePrompt as reactBasePrompt } from "./defaults/react";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: getSystemPrompt(),
});

const app = express();
app.use(cors());
app.use(express.json());

let conversationHistory: { role: string; parts: { text: string }[] }[] = [];

app.post("/template", async (req, res) => {
  try {
    const prompt = req.body.prompt;

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

    const answer = response.response.text().trim().toLowerCase();
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

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.messages;
    console.log(req.body);

    userMessage.forEach((message: { role: string; content: string }) => {
      conversationHistory.push({
        role: message.role,
        parts: [{ text: message.content }],
      });
    });
    console.log("conversationHistory :", conversationHistory);

    const chat = model.startChat({ history: conversationHistory });

    const result = await chat.sendMessage(
      conversationHistory[conversationHistory.length - 1].parts[0].text
    );

    const aiResponse = result.response.text();

    res.json({
      response: aiResponse,
    });
  } catch (error) {
    console.error("Error in /chat:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

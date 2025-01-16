import dotenv from "dotenv";
dotenv.config();
import readline from "readline";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSystemPrompt } from "./prompts"; // Import your system prompt function

// Initialize Google Generative AI with your API key
const genAI = new GoogleGenerativeAI("AIzaSyDU5BxWQnYzBy-jQ-bswoZIlKXV4ISTUtY");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let isAwaitingResponse = false; // Flag to indicate if we're waiting for a response

let conversationHistory: string[] = [
  `System: ${getSystemPrompt()}`, // Include the system prompt at the start
];

export async function generate() {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const chat = model.startChat({
    history: [], // Start with an empty history
    generationConfig: {
      maxOutputTokens: 5000,
    },
  });

  // Function to get user input and send it to the model using streaming
  async function askAndRespond() {
    if (!isAwaitingResponse) {
      rl.question("You: ", async (msg) => {
        if (msg.toLowerCase() === "exit") {
          rl.close();
        } else {
          isAwaitingResponse = true;
          try {
            // Add the user's message to the history
            conversationHistory.push(`User: ${msg}`);

            // Prepare the prompt by joining the conversation history
            const prompt = conversationHistory.join("\n") + "\nAI:";

            // Send the message with the full history as context
            const result = await chat.sendMessageStream(prompt);

            let aiResponse = "";
            for await (const chunk of result.stream) {
              const chunkText = await chunk.text();
              process.stdout.write(chunkText);
              aiResponse += chunkText;
            }

            // Add the AI's response to the history
            conversationHistory.push(`AI: ${aiResponse}`);

            isAwaitingResponse = false;
            askAndRespond(); // Continue the chat
          } catch (error) {
            console.error("Error:", error);
            isAwaitingResponse = false;
          }
        }
      });
    } else {
      console.log("Please wait for the current response to complete.");
    }
  }

  askAndRespond(); // Start the conversation loop
}

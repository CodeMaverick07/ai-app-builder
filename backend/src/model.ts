import readline from "readline";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSystemPrompt } from "./prompts";

const genAI = new GoogleGenerativeAI("AIzaSyDU5BxWQnYzBy-jQ-bswoZIlKXV4ISTUtY");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let isAwaitingResponse = false; // Flag to indicate if we're waiting for a response

export async function generate() {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const chat = model.startChat({
    history: [], // Start with an empty history
    generationConfig: {
      maxOutputTokens: 5000,
    },
  });

  // Store conversation history
  let conversationHistory: { user: string; ai: string }[] = [
    { user: "System", ai: getSystemPrompt() }, // Initial system prompt
  ];
  // Function to get user input and send it to the model using streaming
  async function askAndRespond() {
    if (!isAwaitingResponse) {
      rl.question("You: ", async (msg) => {
        if (msg.toLowerCase() === "exit") {
          rl.close();
        } else {
          isAwaitingResponse = true;
          try {
            // Add user's message to history
            conversationHistory.push({ user: msg, ai: "" });

            // Prepare context from history
            const context = conversationHistory
              .map((entry) => `User: ${entry.user}\nAI: ${entry.ai}`)
              .join("\n");

            // Send message with context
            const result = await chat.sendMessageStream(
              `${context}\nUser: ${msg}`
            );

            let aiResponse = "";
            for await (const chunk of result.stream) {
              const chunkText = await chunk.text();
              process.stdout.write(chunkText);
              aiResponse += chunkText;
            }

            // Update the conversation history with AI's response
            conversationHistory[conversationHistory.length - 1].ai = aiResponse;

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

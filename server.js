const express = require("express");
const axios = require("axios");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.json());

const client = new Anthropic();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const conversationHistory = {};

async function sendTelegramMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {chat_id: chatId, text: text});
  } catch (error) {
    console.error("Error:", error.message);
  }
}

async function getClaudeResponse(userMessage, userId) {
  try {
    if (!conversationHistory[userId]) conversationHistory[userId] = [];
    conversationHistory[userId].push({role: "user", content: userMessage});
    if (conversationHistory[userId].length > 20) conversationHistory[userId] = conversationHistory[userId].slice(-20);
    
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: conversationHistory[userId]
    });

    const assistantMessage = response.content[0].text;
    conversationHistory[userId].push({role: "assistant", content: assistantMessage});
    return assistantMessage;
  } catch (error) {
    return "Sorry, error processing message.";
  }
}

app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    if (!update.message) return res.status(200).send("ok");
    
    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from.id;
    const userMessage = message.text;

    if (!userMessage) return res.status(200).send("ok");
    if (userMessage === "/start") {
      await sendTelegramMessage(chatId, "👋 Hi! I'm powered by Claude Haiku!");
      return res.status(200).send("ok");
    }
    if (userMessage === "/clear") {
      delete conversationHistory[userId];
      await sendTelegramMessage(chatId, "Cleared!");
      return res.status(200).send("ok");
    }

    const response = await getClaudeResponse(userMessage, userId);
    await sendTelegramMessage(chatId, response);
    res.status(200).send("ok");
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

app.get("/health", (req, res) => res.status(200).json({status: "ok"}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot on ${PORT}`));

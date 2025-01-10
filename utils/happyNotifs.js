const User = require("../models/User");
const { sendPushNotification } = require("./notificationService");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const { DateTime } = require("luxon");

const timeInterval = 1000 * 60 * 60 * 5; // 5 hours

const genAI = new GoogleGenerativeAI(process.env.GENERATIVE_AI_API_KEY);

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const generationConfig = { temperature: 0.5 };

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  safetySettings,
  generationConfig,
});

function getRandomTitle(username) {
  const titles = [
    `Hey, You! 🌟`,
    `A Little Reminder 💌`,
    `Psst, ${username}! 👀`,
    `You're Gonna Love This 💕`,
    `Just For You ✨`,
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

const getPrompt = (username, currentTime) => `
Craft a short, heartfelt, and subtly blush-worthy message for the user @${username}. The tone should be uplifting, playful, and charming, designed to bring a smile and make their day better. Consider the time of day for context:
- Morning (6 AM-12 PM): Make it energizing, warm, and subtly flattering.
- Afternoon (12 PM-6 PM): Add a playful compliment or a lighthearted, mood-boosting note.
- Evening (6 PM-10 PM): Make it cozy, thoughtful, and a little sweet to end their day on a good note.
Keep the message under 200 characters. Avoid making it overly romantic but leave enough charm to make the recipient feel special.
Current time: ${currentTime}.
`;

async function generateResp(username, currentTime) {
  try {
    const prompt = getPrompt(username, currentTime);
    const result = await model.generateContent(prompt);
    return { text: result.response.text(), error: null };
  } catch (error) {
    return { text: null, error: error.message };
  }
}

const happyNotifs = async () => {
  try {
    const users = await User.find();
    const indiaTime = DateTime.now().setZone("Asia/Kolkata").toFormat("h:mm a");

    await Promise.all(
      users.map(async (user) => {
        const { username } = user;
        const title = getRandomTitle(username);
        const { text: body, error } = await generateResp(username, indiaTime);

        if (error) {
          console.log("Error in happyNotifs:", error.message);
          return;
        }

        if (body.length > 200) {
          console.log("Generated message exceeds character limit:", body.length);
          return;
        }

        sendPushNotification(user._id.toString(), title, body);
      })
    );
  } catch (error) {
    console.log("Error in happyNotifs:", error.message);
  }
};

// Run an interval to send notifications every 5 hours
exports.startHappyNotifs = async () => {
  happyNotifs();
  setInterval(happyNotifs, timeInterval);
};

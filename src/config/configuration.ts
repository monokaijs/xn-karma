export default () => ({
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/discord-bot',
  },
  points: {
    message: parseInt(process.env.MESSAGE_POINTS || '10', 10),
    messageCooldown: parseInt(process.env.MESSAGE_COOLDOWN_SECONDS || '60', 10),
    voicePerMinute: parseInt(process.env.VOICE_POINTS_PER_MINUTE || '5', 10),
    invite: parseInt(process.env.INVITE_POINTS || '50', 10),
  },
  leveling: {
    baseDailyCap: parseInt(process.env.BASE_DAILY_CAP || '1000', 10),
    dailyCapIncreasePerLevel: parseInt(process.env.DAILY_CAP_INCREASE_PER_LEVEL || '100', 10),
    baseLevelRequirement: parseInt(process.env.BASE_LEVEL_REQUIREMENT || '100', 10),
    levelMultiplier: parseFloat(process.env.LEVEL_MULTIPLIER || '1.5'),
  },
});


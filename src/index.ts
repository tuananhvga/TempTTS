import { Client, GatewayIntentBits, Message } from "discord.js";
import dotenv from "dotenv";
import { processTTS } from "./tts";

dotenv.config();

async function handleMessage(message: Message<boolean>) {
  if (message.author.bot) {
    return;
  }
  // console.log(
  //   `${message.guild.name} ${(message.channel as any).name} ${message.content}`
  // );
  if (message.content.length > 2 && message.content.startsWith(", ")) {
    const voiceChannelId = await message.member.voice.channelId;
    const guild = message.guild;
    await processTTS(message.content.substring(2), voiceChannelId, guild);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.on("ready", () => {
  console.log("ok bro");
});

client.on("messageCreate", handleMessage);
client.on("messageUpdate", handleMessage);

client.login(process.env.HBOT_TOKEN);

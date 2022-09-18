import { Guild } from "discord.js";
import {
  getVoiceConnection,
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayer,
  AudioPlayerStatus,
  VoiceConnection,
  VoiceConnectionState,
  VoiceConnectionStatus,
} from "@discordjs/voice";

interface GuildEntry {
  resources: string[];
  player?: AudioPlayer;
  timeOut?: NodeJS.Timeout;
}

const guildMap = new Map<string, GuildEntry>();

function extractQueries(query: string): string[] {
  const splits = query.split(/[,\.]/g);
  const queries: string[] = [];
  for (let s of splits) {
    s = s.trim();
    if (!s) {
      continue;
    }
    if (queries.length && queries[queries.length - 1].length + s.length < 200) {
      queries[queries.length - 1] += "," + s;
    } else {
      while (s.length > 200) {
        const index = s.substring(0, 200).lastIndexOf(" ");
        if (index == -1) {
          return [];
        }
        queries.push(s.substring(0, index).trim());
        s = s.substring(index);
      }
      if (s.length > 0) {
        queries.push(s.trim());
      }
    }
  }
  return queries;
}

function disconnectVoice(guildId: string) {
  const connection = getVoiceConnection(guildId);
  connection.destroy();
  guildMap.delete(guildId);
}

function onQueueUpdate(guildId: string) {
  console.log("onQueueUpdate");
  const guildEntry = guildMap.get(guildId);
  if (!guildEntry?.player) {
    return;
  }

  if (guildEntry.player.state.status != AudioPlayerStatus.Idle) {
    return;
  }

  if (guildEntry.resources.length == 0) {
    if (!guildEntry.timeOut) {
      guildEntry.timeOut = setTimeout(() => {
        disconnectVoice(guildId);
      }, 60000);
    }
    return;
  } else if (guildEntry.resources.length > 0 && guildEntry.timeOut) {
    clearTimeout(guildEntry.timeOut);
    guildEntry.timeOut = null;
  }

  const url = guildEntry.resources.splice(0, 1)[0];
  guildEntry.player.play(createAudioResource(url));
}

function enqueue(guildId: string, urls: string[]) {
  console.log("enqueue");
  let guildEntry = guildMap.get(guildId);
  if (!guildEntry) {
    guildEntry = {
      resources: [...urls],
    };
    guildMap.set(guildId, guildEntry);
  } else {
    guildEntry.resources.push(...urls);
  }

  onQueueUpdate(guildId);
}

function handleConnectionReady(connection: VoiceConnection, guildId: string) {
  console.log("handleConnectionReady");
  const player = createAudioPlayer();
  player.on(AudioPlayerStatus.Idle, () => {
    onQueueUpdate(guildId);
  });
  connection.subscribe(player);
  let guildEntry = guildMap.get(guildId);
  if (!guildEntry) {
    guildEntry = {
      resources: [],
    };
    guildMap.set(guildId, guildEntry);
  }
  guildEntry.player = player;

  onQueueUpdate(guildId);
}

function getConnection(voiceChannelId: string, guild: Guild) {
  let connection = getVoiceConnection(guild.id);
  if (connection) {
    return connection;
  }

  connection = joinVoiceChannel({
    channelId: voiceChannelId,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });

  connection.on(
    "stateChange",
    (oldState: VoiceConnectionState, newState: VoiceConnectionState) => {
      if (newState.status == oldState.status) return;
      if (newState.status === VoiceConnectionStatus.Ready) {
        handleConnectionReady(connection, guild.id);
      } else if (newState.status === VoiceConnectionStatus.Disconnected) {
        getConnection(voiceChannelId, guild);
      }
    }
  );
  connection.on("error", (error) => {
    console.log(error.message);
  });
  return connection;
}

function resolveUrls(query: string): string[] {
  const queries = extractQueries(query);
  return queries.map((query) => {
    const url = new URL(`https://translate.google.com/translate_tts`);
    url.searchParams.append("ie", "UTF-8");
    url.searchParams.append("q", query);
    url.searchParams.append("tl", "vi");
    url.searchParams.append("client", "tw-ob");
    return url.toString();
  });
}

export function processTTS(
  query: string,
  voiceChannelId: string,
  guild: Guild
) {
  const connection = getConnection(voiceChannelId, guild);
  if (!connection) return;

  const urls = resolveUrls(query);
  enqueue(guild.id, urls);
}

import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { like, or } from "drizzle-orm";

export function formatDiscordEmbed(payload: any) {
  const color = payload.status === 'success' ? 0x22c55e : (payload.status === 'failed' ? 0xef4444 : 0xeab308);
  return {
    embeds: [{
      title: payload.title,
      description: payload.message,
      color,
      timestamp: new Date().toISOString(),
      footer: {
        text: "Cowbox PaaS"
      },
      fields: payload.appName ? [{ name: "App", value: payload.appName, inline: true }] : []
    }]
  };
}

export function formatSlackBlocks(payload: any) {
  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: payload.title,
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: payload.message
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Status:* ${payload.status} | *App:* ${payload.appName || 'N/A'}`
          }
        ]
      }
    ]
  };
}

export function formatTelegramHtml(payload: any) {
  return `<b>${payload.title}</b>\n\n${payload.message}\n\nStatus: ${payload.status}${payload.appName ? `\nApp: ${payload.appName}` : ''}`;
}

export async function sendNotificationToChannel(
  channel: { id: string; channel: string; webhookUrl: string; enabled: boolean },
  payload: { title: string; message: string; status: 'success' | 'failed' | 'warning'; appName?: string; duration?: number; event?: string }
) {
  if (channel.channel === 'discord') {
    await fetch(channel.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formatDiscordEmbed(payload)),
    });
  } else if (channel.channel === 'slack') {
    await fetch(channel.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formatSlackBlocks(payload)),
    });
  } else if (channel.channel === 'telegram') {
    const raw = channel.webhookUrl.trim();
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      await fetch(raw, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: formatTelegramHtml(payload),
          parse_mode: 'HTML',
        }),
      });
    } else {
      // Support formats: token#chatId, token:chatId, token/chatId
      let botToken = "";
      let chatId = "";
      if (raw.includes('#')) {
        [botToken, chatId] = raw.split('#');
      } else if (raw.includes('/')) {
        [botToken, chatId] = raw.split('/');
      } else {
        const parts = raw.split(':');
        if (parts.length >= 2) {
          chatId = parts.pop() || "";
          botToken = parts.join(':');
        }
      }

      if (botToken && chatId) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: formatTelegramHtml(payload),
            parse_mode: 'HTML',
          }),
        });
      }
    }
  } else if (channel.channel === 'webhook') {
    await fetch(channel.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: payload.event || 'notification',
        ...payload,
        timestamp: new Date().toISOString(),
      }),
    });
  }
}

export async function dispatchEvent(eventType: string, payload: { title: string, message: string, status: 'success' | 'failed' | 'warning', appName?: string, duration?: number }) {
  try {
    const channels = await db.select().from(notifications).where(
      or(
        like(notifications.events, `%${eventType}%`)
      )
    );

    const activeChannels = channels.filter(c => c.enabled);

    await Promise.allSettled(activeChannels.map(async (channel) => {
      try {
        await sendNotificationToChannel(channel, { ...payload, event: eventType });
      } catch (err) {
        console.error(`Failed to dispatch to channel ${channel.id}:`, err);
      }
    }));
  } catch (error) {
    console.error("Failed to query notification channels:", error);
  }
}

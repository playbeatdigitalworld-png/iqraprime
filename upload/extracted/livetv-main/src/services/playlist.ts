import { CustomerLine, ServerConfig } from '../types/iptv';

export interface GeneratedLinks {
  m3uPlusTs: string;
  m3uPlusHls: string;
  m3uStandard: string;
  epgXmltv: string;
  webPlayer: string;
  xtreamHost: string;
  username: string;
  password?: string;
  whatsappMessage: string;
}

export function generatePlaylistLinks(
  line: CustomerLine,
  server: ServerConfig
): GeneratedLinks {
  const host = server.hostUrl.replace(/\/+$/, '');
  const username = line.providerUsername;
  const password = line.providerPassword || '';

  const m3uPlusTs = `${host}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`;
  const m3uPlusHls = `${host}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=m3u8`;
  const m3uStandard = `${host}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u&output=ts`;
  const epgXmltv = `${host}/xmltv.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  const webPlayer = server.playerUrl || `${host}/app.php`;

  // Format a friendly WhatsApp / message delivery text
  const whatsappMessage = formatDeliveryMessage(line, server, {
    m3uPlusTs,
    epgXmltv,
    webPlayer,
    xtreamHost: host,
    username,
    password
  });

  return {
    m3uPlusTs,
    m3uPlusHls,
    m3uStandard,
    epgXmltv,
    webPlayer,
    xtreamHost: host,
    username,
    password,
    whatsappMessage
  };
}

function formatDeliveryMessage(
  line: CustomerLine,
  server: ServerConfig,
  links: {
    m3uPlusTs: string;
    epgXmltv: string;
    webPlayer: string;
    xtreamHost: string;
    username: string;
    password?: string;
  }
): string {
  if (line.lineType === 'XTREAM') {
    return `*STAR IPTV SUBSCRIPTION ACTIVATED*
━━━━━━━━━━━━━━━━━━━━━━
👤 *Subscriber:* ${line.name}
📺 *Max Screens:* ${line.connections} Device(s)
📅 *Valid Until:* ${line.expiryDate}
🏷️ *Status:* ${line.status === 'TRIAL' ? 'Free 24h Trial' : 'Active Subscription'}

🔑 *XTREAM CODES LOGIN (Smarters / TiviMate / XCIPTV)*
• *Server URL:* ${links.xtreamHost}
• *Username:* ${links.username}
• *Password:* ${links.password || '••••••••'}

🔗 *PLAYLIST DOWNLOAD (VLC / Smart STB / Apple TV)*
• *M3U Plus (TS):* ${links.m3uPlusTs}
• *EPG XMLTV Guide:* ${links.epgXmltv}
• *Web Browser Player:* ${links.webPlayer}

⚡ *Quick Setup Tip:*
In IPTV Smarters Pro or TiviMate, select "Login with Xtream Codes API" and enter the 3 fields above.
━━━━━━━━━━━━━━━━━━━━━━`;
  }

  if (line.lineType === 'ACTIVECODE') {
    return `*STAR IPTV ACTIVECODE ACTIVATION*
━━━━━━━━━━━━━━━━━━━━━━
👤 *Subscriber:* ${line.name}
📺 *Connections:* ${line.connections} Screen(s)
📅 *Valid Until:* ${line.expiryDate}

🔑 *YOUR ACTIVATION CODE:*
*${line.providerUsername}*

📲 *How to Activate:*
1. Open your TVStar IPTV / Compatible APK on Android TV or FireStick.
2. Enter the numeric Activation Code above.
3. Click "Activate". Your live channels and VOD catalogue will load automatically.
━━━━━━━━━━━━━━━━━━━━━━`;
  }

  // MAC Address / MAG / Formuler
  return `*STAR IPTV STB / MAG PORTAL ACTIVATION*
━━━━━━━━━━━━━━━━━━━━━━
👤 *Subscriber:* ${line.name}
📟 *Registered MAC:* ${line.providerUsername}
📅 *Valid Until:* ${line.expiryDate}

🌐 *STB / MAG PORTAL ADDRESS:*
*${server.hostUrl}*

📲 *How to Setup on MAG / Formuler / STB EMU:*
1. Go to System Settings -> Servers -> Portals.
2. Portal 1 URL: enter the Portal Address above.
3. Verify your device MAC address matches *${line.providerUsername}*.
4. Reboot your device to load your channel list.
━━━━━━━━━━━━━━━━━━━━━━`;
}

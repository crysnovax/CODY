const fs = require('fs');

// app.json for Heroku
const appJson = `{
  "name": "CODY WhatsApp Bot",
  "description": "WhatsApp self-bot with AI, media editing, group management",
  "repository": "https://github.com/crysnovax/CODY.git",
  "logo": "https://cdn.crysnovax.link/files/1778715435891-e17143f2-a3fa-4d16-b1b7-740d8e4fb7fb.jpeg",
  "keywords": ["whatsapp", "bot", "ai", "baileys"],
  "env": {
    "OWNER_NUMBER": {
      "description": "Your WhatsApp number (without +, e.g. 2348077528901)",
      "required": true
    },
    "OWNER_NAME": {
      "description": "Your name or nickname",
      "required": true
    },
    "BOT_NAME": {
      "description": "Display name for the bot",
      "value": "CODY AI"
    },
    "SESSION_ID": {
      "description": "Session ID from the pairing service.",
      "required": true
    }
  },
  "formation": {
    "web": {
      "quantity": 1,
      "size": "free"
    }
  },
  "buildpacks": [
    {
      "url": "heroku/nodejs"
    }
  ],
  "stack": "heroku-22"
}`;

// Procfile
const procfile = "web: node index.js\n";

// vercel.json
const vercelJson = `{
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ],
  "env": {
    "OWNER_NUMBER": "@owner_number",
    "OWNER_NAME": "@owner_name",
    "BOT_NAME": "@bot_name",
    "SESSION_ID": "@session_id"
  }
}`;

fs.writeFileSync('app.json', appJson);
fs.writeFileSync('Procfile', procfile);
fs.writeFileSync('vercel.json', vercelJson);
console.log('✅ Deployment files created: app.json, Procfile, vercel.json');

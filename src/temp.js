// ============================================================
//  TRADEYE COMMENT BOT — Google Apps Script
//  Stack: X API (free) + Gemini 1.5 Flash (free) + Telegram
//  
//  SETUP STEPS (do these once, in order):
//  1. Go to script.google.com → New Project → paste this file
//  2. Fill in your keys in the CONFIG section below
//  3. Run setupWebhook() once manually (sets up Telegram listener)
//  4. Set a time trigger: Triggers → Add Trigger → runBot → every 2 hours
//  5. Deploy as Web App (needed for Telegram webhook)
//     → Deploy → New Deployment → Web App → Execute as: Me → Who has access: Anyone
//     → Copy the Web App URL → paste into TELEGRAM_WEBHOOK_URL below → run setupWebhook() again
// ============================================================

// ============================================================
//  CONFIG — fill all of these
// ============================================================
const CONFIG = {
    // X (Twitter) API — get free at developer.twitter.com
    // Create a project → app → generate Bearer Token
    X_BEARER_TOKEN: "YOUR_X_BEARER_TOKEN_HERE",
  
    // X OAuth 1.0a — needed to POST replies (also from developer.twitter.com)
    X_API_KEY:            "YOUR_X_API_KEY",
    X_API_SECRET:         "YOUR_X_API_SECRET",
    X_ACCESS_TOKEN:       "YOUR_ACCESS_TOKEN",
    X_ACCESS_TOKEN_SECRET:"YOUR_ACCESS_TOKEN_SECRET",
  
    // Gemini — get free at aistudio.google.com → Get API Key
    GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE",
  
    // Telegram — message @BotFather on Telegram → /newbot → copy token
    TELEGRAM_BOT_TOKEN: "YOUR_TELEGRAM_BOT_TOKEN_HERE",
  
    // Your personal Telegram chat ID
    // Get it: message @userinfobot on Telegram → it replies with your ID
    TELEGRAM_CHAT_ID: "YOUR_TELEGRAM_CHAT_ID_HERE",
  
    // Your X account's user ID (not username)
    // Get it: search "find my twitter user ID" → tweeterid.com
    X_MY_USER_ID: "YOUR_X_USER_ID_HERE",
  
    // KeyAPI — get free at keyapi.ai → sign up → API Keys
    KEYAPI_KEY: "YOUR_KEYAPI_KEY_HERE",
  
    // Web App URL after deployment (leave empty until you deploy)
    TELEGRAM_WEBHOOK_URL: "",
  };
  
  // ============================================================
  //  KEYWORDS — what posts to find
  //  These are carefully chosen to match your ICP:
  //  Indian equity traders frustrated with raw broker data
  // ============================================================
  const KEYWORDS = [
    "zerodha tradebook",
    "zerodha console trades",
    "groww trade history",
    "angel one tradebook",
    "upstox trade history",
    "trading journal india",
    "how to review my trades",
    "track my stock trades",
    "entry exit analysis",
    "why i lose in trading",
    "improve trading discipline",
    "trading mistake analysis",
    "stock trade review",
    "analyse my trades",
    "chart context entry",
    "#SwingTrading india",
    "#IndianStockMarket trade review",
    "#zerodha trades",
    "broker excel useless",
    "trading log india",
  ];
  
  // ============================================================
  //  GEMINI PROMPT — your voice, your persona
  //  Built from your actual comments:
  //  - Short, confident, no fluff
  //  - Fellow trader energy, not founder pitching
  //  - Genuine market/trading observation first
  //  - Product mention only when it fits naturally (1 out of 3 variations)
  //  - Asks a question to keep conversation going
  // ============================================================
  const GEMINI_SYSTEM_PROMPT = `
  You are writing comments on behalf of @tradeyeofficial on X (Twitter).
  The account belongs to an Indian stock trader and founder of tradeye.in — 
  a tool that plots trades on real candlestick charts and scores entry quality using AI.
  
  YOUR VOICE (study these real examples carefully):
  - "Clean level. Above 6355 with volume confirmation would be a strong entry. I actually logged this setup on tradeye.in to track how the entry scores once it triggers."
  - "Apar Industries keeps showing up on every momentum list lately. At this point the chart is doing the talking."
  - "Amines moving first makes sense, they're the most liquid in the space. Sulphur chemicals would be interesting to watch — any specific names you're tracking there?"
  
  VOICE RULES:
  1. Sound like a fellow trader in the trenches, never like a founder pitching
  2. Short — 1 to 3 sentences max
  3. No hashtags, no emojis, no exclamation marks
  4. Lead with a genuine trading insight or observation about their post
  5. In variation 3 only: naturally mention tradeye.in if it genuinely fits. Never force it. If it doesn't fit, skip it.
  6. End with a question to keep the conversation going (optional, when natural)
  7. Never say "great post", "love this", "interesting take" or any filler openers
  8. Write in plain English — no jargon overload, no trying to sound smart
  9. Never mention you built the tool, never say "check out", never sound promotional
  10. If the post is a stock setup/chart, comment on the technicals first
  
  OUTPUT FORMAT — return only valid JSON, nothing else:
  {
    "relevant": true or false,
    "reason": "one line why this post is or isn't relevant",
    "variations": [
      "variation 1 text",
      "variation 2 text", 
      "variation 3 text"
    ]
  }
  
  If the post is not relevant to Indian equity trading, trading psychology, trade review, 
  broker data, journaling, or chart analysis — set relevant: false and leave variations empty.
  `;
  
  // ============================================================
  //  STORAGE HELPERS — uses Google Apps Script PropertiesService
  //  Stores: seen post IDs, pending approvals
  // ============================================================
  function getStore() {
    return PropertiesService.getScriptProperties();
  }
  
  function getSeenIds() {
    const raw = getStore().getProperty("seen_ids");
    return raw ? JSON.parse(raw) : [];
  }
  
  function addSeenId(id) {
    const ids = getSeenIds();
    ids.push(id);
    // keep last 500 only
    const trimmed = ids.slice(-500);
    getStore().setProperty("seen_ids", JSON.stringify(trimmed));
  }
  
  function getPending() {
    const raw = getStore().getProperty("pending");
    return raw ? JSON.parse(raw) : {};
  }
  
  function savePending(pending) {
    getStore().setProperty("pending", JSON.stringify(pending));
  }
  
  function addPendingPost(messageId, data) {
    const pending = getPending();
    pending[messageId] = data;
    savePending(pending);
  }
  
  function removePending(messageId) {
    const pending = getPending();
    delete pending[messageId];
    savePending(pending);
  }
  
  // ============================================================
  //  KEYAPI — search posts by keyword (free, no official X API needed)
  //  Rotates through KEYWORDS list, fetches top posts per keyword
  // ============================================================
  function searchXPosts() {
    const results = [];
  
    for (const keyword of KEYWORDS) {
      try {
        const query = encodeURIComponent(keyword);
        const url = `https://api.keyapi.ai/v1/twitter/search?query=${query}&search_type=Top`;
  
        const response = UrlFetchApp.fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${CONFIG.KEYAPI_KEY}`,
          },
          muteHttpExceptions: true,
        });
  
        const code = response.getResponseCode();
        const body = response.getContentText();
  
        if (code !== 200) {
          console.log(`KeyAPI failed for "${keyword}": ${code} — ${body}`);
          continue;
        }
  
        const data = JSON.parse(body);
        const tweets = data?.data?.timeline || [];
  
        for (const tweet of tweets) {
          // skip non-English posts
          if (tweet.lang && tweet.lang !== "en") continue;
          // skip your own posts
          if (tweet.screen_name === "tradeyeofficial") continue;
  
          results.push({
            id: tweet.tweet_id,
            text: tweet.text,
            author_id: tweet.screen_name,
            username: tweet.screen_name,
            url: `https://twitter.com/${tweet.screen_name}/status/${tweet.tweet_id}`,
          });
        }
  
        // small pause between keyword searches
        Utilities.sleep(500);
  
      } catch (e) {
        console.log(`Error searching keyword "${keyword}": ${e}`);
      }
    }
  
    // deduplicate by tweet id
    const seen = {};
    return results.filter(t => {
      if (seen[t.id]) return false;
      seen[t.id] = true;
      return true;
    });
  }
  
  // ============================================================
  //  GEMINI — generate 3 comment variations
  // ============================================================
  function generateComments(postText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  
    const body = {
      contents: [{
        parts: [{
          text: `${GEMINI_SYSTEM_PROMPT}\n\nPost to reply to:\n"${postText}"\n\nGenerate 3 variations now.`
        }]
      }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 500 }
    };
  
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });
  
    if (response.getResponseCode() !== 200) return null;
  
    const data = JSON.parse(response.getContentText());
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
    // strip markdown code fences if Gemini wraps in ```json
    const cleaned = text.replace(/```json|```/g, "").trim();
  
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }
  
  // ============================================================
  //  TELEGRAM — send message
  // ============================================================
  function sendTelegram(text, replyMarkup) {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: CONFIG.TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    };
    if (replyMarkup) payload.reply_markup = JSON.stringify(replyMarkup);
  
    UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  }
  
  function sendTelegramForApproval(post, variations) {
    const text =
      `🎯 <b>Relevant post found</b>\n\n` +
      `👤 @${post.username}\n` +
      `📝 "${post.text.substring(0, 200)}${post.text.length > 200 ? "..." : ""}"\n` +
      `🔗 ${post.url}\n\n` +
      `<b>Pick a variation to post or skip:</b>\n\n` +
      `1️⃣  ${variations[0]}\n\n` +
      `2️⃣  ${variations[1]}\n\n` +
      `3️⃣  ${variations[2]}`;
  
    const keyboard = {
      inline_keyboard: [
        [
          { text: "1️⃣ Post this", callback_data: `post_${post.id}_1` },
          { text: "2️⃣ Post this", callback_data: `post_${post.id}_2` },
          { text: "3️⃣ Post this", callback_data: `post_${post.id}_3` },
        ],
        [
          { text: "⏭ Skip", callback_data: `skip_${post.id}` },
        ]
      ]
    };
  
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: CONFIG.TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: JSON.stringify(keyboard),
    };
  
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  
    const result = JSON.parse(response.getContentText());
    // store mapping: telegram message id → post data + variations
    if (result.ok) {
      addPendingPost(result.result.message_id.toString(), {
        post_id: post.id,
        username: post.username,
        variations: variations,
      });
    }
  }
  
  // ============================================================
  //  X API — post reply (OAuth 1.0a)
  // ============================================================
  function postReply(commentText, replyToTweetId) {
    const url = "https://api.twitter.com/2/tweets";
    const body = JSON.stringify({
      text: commentText,
      reply: { in_reply_to_tweet_id: replyToTweetId }
    });
  
    const authHeader = buildOAuthHeader("POST", url, {});
  
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: authHeader },
      payload: body,
      muteHttpExceptions: true,
    });
  
    return response.getResponseCode() === 201;
  }
  
  // ============================================================
  //  OAUTH 1.0a HELPER — signs X API write requests
  // ============================================================
  function buildOAuthHeader(method, url, params) {
    const oauthParams = {
      oauth_consumer_key: CONFIG.X_API_KEY,
      oauth_nonce: Utilities.getUuid().replace(/-/g, ""),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: CONFIG.X_ACCESS_TOKEN,
      oauth_version: "1.0",
    };
  
    const allParams = Object.assign({}, params, oauthParams);
    const sortedKeys = Object.keys(allParams).sort();
    const paramString = sortedKeys
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
      .join("&");
  
    const baseString = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(paramString),
    ].join("&");
  
    const signingKey = `${encodeURIComponent(CONFIG.X_API_SECRET)}&${encodeURIComponent(CONFIG.X_ACCESS_TOKEN_SECRET)}`;
    const signature = Utilities.base64Encode(
      Utilities.computeHmacSha256Signature(baseString, signingKey)
    );
  
    oauthParams.oauth_signature = signature;
  
    const headerParts = Object.keys(oauthParams)
      .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(", ");
  
    return `OAuth ${headerParts}`;
  }
  
  // ============================================================
  //  TELEGRAM WEBHOOK — handles your button taps
  //  This function is called by Telegram when you tap a button
  //  Must be deployed as Web App for this to work
  // ============================================================
  function doPost(e) {
    try {
      const update = JSON.parse(e.postData.contents);
  
      // handle inline keyboard button taps
      if (update.callback_query) {
        const query = update.callback_query;
        const data = query.data; // e.g. "post_1234567890_2" or "skip_1234567890"
        const messageId = query.message.message_id.toString();
        const pending = getPending();
        const pendingData = pending[messageId];
  
        // answer the callback so spinner stops
        UrlFetchApp.fetch(
          `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
          {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify({ callback_query_id: query.id }),
          }
        );
  
        if (!pendingData) {
          sendTelegram("This post has already been handled or expired.");
          return ContentService.createTextOutput("ok");
        }
  
        if (data.startsWith("skip_")) {
          removePending(messageId);
          sendTelegram(`⏭ Skipped post by @${pendingData.username}`);
        } else if (data.startsWith("post_")) {
          const parts = data.split("_");
          const variationIndex = parseInt(parts[parts.length - 1]) - 1;
          const commentText = pendingData.variations[variationIndex];
          const success = postReply(commentText, pendingData.post_id);
  
          if (success) {
            removePending(messageId);
            sendTelegram(
              `✅ Posted on @${pendingData.username}'s tweet!\n\n` +
              `<i>"${commentText}"</i>`
            );
          } else {
            sendTelegram("❌ Failed to post. X API might be rate limited. Try again in a bit.");
          }
        }
      }
    } catch (err) {
      console.error("doPost error:", err);
    }
  
    return ContentService.createTextOutput("ok");
  }
  
  // ============================================================
  //  MAIN BOT — runs every 2 hours via time trigger
  // ============================================================
  function runBot() {
    const seenIds = getSeenIds();
    let newPostsFound = 0;
  
    const posts = searchXPosts();
    console.log(`Fetched ${posts.length} posts from timeline`);
  
    for (const post of posts) {
      // skip if already seen
      if (seenIds.includes(post.id)) continue;
  
      addSeenId(post.id);
  
      // ask Gemini if relevant + generate comments
      const result = generateComments(post.text);
  
      if (!result || !result.relevant) {
        console.log(`Skipped (not relevant): ${post.text.substring(0, 60)}`);
        continue;
      }
      if (!result.variations || result.variations.length < 3) continue;
  
      // send to Telegram for your approval
      sendTelegramForApproval(post, result.variations);
      newPostsFound++;
  
      console.log(`Sent for approval: @${post.username}`);
  
      // small pause to avoid hammering Gemini
      Utilities.sleep(2000);
  
      // max 5 posts per run to stay within limits
      if (newPostsFound >= 5) return;
    }
  
    if (newPostsFound === 0) {
      console.log("runBot: no new relevant posts found this run");
    }
  }
  
  // ============================================================
  //  ONE-TIME SETUP — run this manually once after deploying
  // ============================================================
  function setupWebhook() {
    if (!CONFIG.TELEGRAM_WEBHOOK_URL) {
      console.log("Set TELEGRAM_WEBHOOK_URL in CONFIG first, then run this again.");
      return;
    }
  
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/setWebhook`;
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ url: CONFIG.TELEGRAM_WEBHOOK_URL }),
    });
  
    console.log("Webhook setup response:", response.getContentText());
  }
  
  // Run this to test everything is connected before setting up the trigger
  function testRun() {
    sendTelegram("🤖 Tradeye bot is connected and working. Running first search...");
    runBot();
  }
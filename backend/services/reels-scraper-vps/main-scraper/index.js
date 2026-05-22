import puppeteer from 'puppeteer';
import { supabase } from './db.js';
import { loginToInstagram, scrapeInstagramProfile } from './scrapers/instagram.js';
import { loginToTikTok, scrapeTikTokProfile } from './scrapers/tiktok.js';
import { loginToYouTube, scrapeYoutubeChannel } from './scrapers/youtube.js';
import { loginToFacebook, scrapeFacebookProfile } from './scrapers/facebook.js';
import { BROWSER_CONFIG, LOGIN_CONFIG } from './config.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PLATFORM_HANDLERS = {
  instagram: {
    login: loginToInstagram,
    scrape: scrapeInstagramProfile,
  },
  tiktok: {
    login: loginToTikTok,
    scrape: scrapeTikTokProfile,
  },
  youtube: {
    login: loginToYouTube,
    scrape: scrapeYoutubeChannel,
  },
  facebook: {
    login: loginToFacebook,
    scrape: scrapeFacebookProfile,
  },
};

async function applyDetectionHardening(page) {
  await page.setUserAgent(BROWSER_CONFIG.USER_AGENT);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'platform', { get: () => 'Linux x86_64' });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
}

async function main() {
  console.log("🚀 Starting Multi-Platform Scraper Orchestrator...");

  let browser = null;
  let page = null;
  let JOBS_PROCESSED = 0;
  const MAX_JOBS_PER_SESSION = 500;
  const platformOrder = Object.keys(PLATFORM_HANDLERS);
  let nextPlatformIndex = 0;

  async function verifyDatabaseConnection() {
    console.log("🩺 Checking database connection...");
    const { error } = await supabase.from('pages').select('id').limit(1);
    if (error) {
      throw new Error(`Database connection check failed: ${error.message}`);
    }
    console.log("✅ Database connection is healthy.");
  }

  async function launchOrRestartBrowser() {
    if (browser) {
      console.log("♻️  Closing old browser instance...");
      await browser.close();
    }
    console.log("🌏 Launching new browser instance...");
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      userDataDir: BROWSER_CONFIG.USER_DATA_DIR,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--lang=en-US,en',
      ]
    });

    page = await browser.newPage();
    await applyDetectionHardening(page);

    try {
      if (LOGIN_CONFIG.SKIP_STARTUP_LOGINS) {
        console.log("⏭️  SKIP_STARTUP_LOGINS=true, skipping manual login prompts for all platforms.");
      } else {
        for (const [platform, handlers] of Object.entries(PLATFORM_HANDLERS)) {
          await handlers.login(page);

          const readline = (await import('readline')).createInterface({
            input: process.stdin,
            output: process.stdout
          });

          await new Promise(resolve => {
            readline.question(`👉 Press Enter AFTER you have successfully logged in to ${platform}...`, () => {
              readline.close();
              resolve();
            });
          });

          console.log(`✅ ${platform} login step completed.`);
        }
      }

      console.log(`🗂️ Session profile path: ${BROWSER_CONFIG.USER_DATA_DIR}`);
      console.log("✅ Proceeding after manual login checks for all platforms.");
    } catch (e) {
      console.error("❌ Initial platform login setup failed:", e);
    }

    JOBS_PROCESSED = 0;
  }

  try {
    await verifyDatabaseConnection();
  } catch (error) {
    console.error("❌ Startup aborted:", error);
    process.exit(1);
  }

  await launchOrRestartBrowser();

  while (true) {
    if (JOBS_PROCESSED >= MAX_JOBS_PER_SESSION) {
      console.log(`🚀 Reached session limit. Restarting...`);
      await launchOrRestartBrowser();
    }

    console.log(`\n--------------------------------------------------`);
    console.log("🔄 Checking for next pending profile...");

    let selectedJob = null;
    let selectedPlatform = null;
    const orderedPlatforms = platformOrder.map((_, idx) => (
      platformOrder[(nextPlatformIndex + idx) % platformOrder.length]
    ));

    // Rotate starting platform every loop for fair job pickup.
    nextPlatformIndex = (nextPlatformIndex + 1) % platformOrder.length;

    for (const platform of orderedPlatforms) {
      const { data: pages, error } = await supabase.rpc('get_next_pending_page', { p_platform: platform });

      if (error) {
        console.error(`❌ RPC Error [${platform}]:`, error);
        continue;
      }

      if (pages && pages.length > 0) {
        selectedJob = pages[0];
        selectedPlatform = platform;
        break;
      }
    }

    if (!selectedJob || !selectedPlatform) {
      console.log("✅ No pending pages for instagram/tiktok/youtube/facebook. Waiting 60s...");
      await sleep(60000);
      continue;
    }

    const job = selectedJob;
    const handlers = PLATFORM_HANDLERS[selectedPlatform];

    console.log(`🎬 Processing [${selectedPlatform}] ${job.source_username}`);

    try {
      const scrapedData = await handlers.scrape(page, job.source_username);

      if (scrapedData && scrapedData.uniqueLinks && scrapedData.uniqueLinks.length > 0) {
        console.log(`✅ Scraped ${scrapedData.uniqueLinks.length} items.`);

        const reelsToInsert = scrapedData.uniqueLinks.map(id => {
          return {
            page_id: job.id,
            platform: selectedPlatform,
            username: job.source_username,
            reel_id: id,
            status: 'pending'
          };
        });

        const { error: insertError } = await supabase
          .from('reels')
          .upsert(reelsToInsert, { onConflict: 'page_id,reel_id', ignoreDuplicates: true });

        if (insertError) throw insertError;

        await supabase.from('pages').update({ sync_status: 'synced' }).eq('id', job.id);
        console.log(`💾 Synced ${job.source_username}.`);

      } else {
        console.warn(`⚠️ No items found for ${job.source_username}.`);
        await supabase.from('pages').update({ sync_status: 'error' }).eq('id', job.id);
      }

      JOBS_PROCESSED++;

    } catch (err) {
      console.error(`❌ Error processing ${job.source_username}:`, err);
      await supabase.from('pages').update({ sync_status: 'error' }).eq('id', job.id);
      await sleep(5000);
    }
  }
}

main();
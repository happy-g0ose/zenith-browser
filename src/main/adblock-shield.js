class AdblockShield {
  constructor(configStore) {
    this.configStore = configStore;
    this.blockedCount = 0;
    this.blockedDomains = new Set();
    this.sessionStats = new Map(); // sessionId -> count

    // Known ad, tracking, fingerprinting, crypto mining & telemetry domains,
    // grouped by category so each privacy.shield.block_* toggle actually works
    const RULE_SETS = {
      trackers: [
        // Trackers & Analytics
        '*google-analytics.com*',
        '*googletagmanager.com*',
        '*googletagservices.com*',
        '*hotjar.com*',
        '*yandex.ru/metrika*',
        '*mc.yandex.ru*',
        '*facebook.net/en_US/fbevents.js*',
        '*connect.facebook.net*',
        '*scorecardresearch.com*',
        '*quantserve.com*',
        '*segment.io*',
        '*segment.com*',
        '*mixpanel.com*',
        '*amplitude.com*',
        '*branch.io*',
        '*appsflyer.com*',
        '*adjust.com*',
        '*clarity.ms*',
        '*newrelic.com*',
        '*datadoghq-browser-agent.com*',

        // Fingerprinting & Telemetry
        '*fingerprintjs.com*',
        '*fpjs.sh*',
        '*fpnpmcdn.net*',
        '*telemetry.mozilla.org*',
        '*telemetry.microsoft.com*',
        '*vortex.data.microsoft.com*',

        // Geolocation & IP Trackers
        '*googleapis.com/geolocation*',
        '*location.services.mozilla.com*',
        '*api.ipgeolocation.io*',
        '*ipapi.co*',
        '*ip-api.com*',
        '*geolocation-db.com*',
        '*freegeoip.app*',
        '*geoip-db.com*'
      ],
      ads: [
        // Ads & Ad Exchanges
        '*criteo.com*',
        '*criteo.net*',
        '*doubleclick.net*',
        '*adservice.google.com*',
        '*pagead2.googlesyndication.com*',
        '*adsystem.com*',
        '*adnxs.com*',
        '*outbrain.com*',
        '*taboola.com*',
        '*pubmatic.com*',
        '*rubiconproject.com*',
        '*openx.net*',
        '*casalemedia.com*',
        '*smartadserver.com*',
        '*adform.net*',
        '*popads.net*',
        '*popcash.net*',
        '*propellerads.com*',
        '*trafficjunky.com*',
        '*exoclick.com*'
      ],
      miners: [
        // Web Miners
        '*coinhive.com*',
        '*coin-hive.com*',
        '*jsecoin.com*',
        '*cryptoloot.pro*'
      ]
    };

    this.ruleSets = Object.entries(RULE_SETS).map(([category, patterns]) => ({
      category,
      prefKey: 'privacy.shield.block_' + category,
      // One combined alternation regex per category: 3 regex tests per request
      // instead of running dozens of separate patterns
      regex: new RegExp(
        patterns.map(p => p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')).join('|'),
        'i'
      )
    }));
  }

  _categoryEnabled(ruleSet) {
    return this.configStore.getPref(ruleSet.prefKey, true) !== false;
  }

  isBlocked(url) {
    if (!this.configStore.getPref('privacy.shield.enabled', true)) {
      return false;
    }

    try {
      const parsed = new URL(url);
      // Don't block internal or local URLs
      if (parsed.protocol === 'about:' || parsed.protocol === 'file:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return false;
      }

      for (const ruleSet of this.ruleSets) {
        if (!this._categoryEnabled(ruleSet)) continue;
        if (ruleSet.regex.test(url)) {
          this.blockedCount++;
          if (this.blockedDomains.size < 1000) this.blockedDomains.add(parsed.hostname);
          return true;
        }
      }
    } catch (e) {
      // Invalid URL
    }
    return false;
  }

  attachToSession(ses, profileId = 'default') {
    // 1. Block ad & tracker requests + HTTPS upgrade
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
      // HTTPS-only mode: upgrade plain HTTP to HTTPS
      if (this.configStore.getPref('privacy.shield.https_only', false) && details.url.startsWith('http://')) {
        try {
          const parsed = new URL(details.url);
          if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
            callback({ redirectURL: 'https://' + details.url.slice(7) });
            return;
          }
        } catch (e) {}
      }

      if (this.isBlocked(details.url)) {
        const current = this.sessionStats.get(profileId) || 0;
        this.sessionStats.set(profileId, current + 1);
        callback({ cancel: true });
        return;
      }
      callback({ cancel: false });
    });

    // 2. Inject Privacy & Anti-Fingerprint Headers
    ses.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (details, callback) => {
      const requestHeaders = { ...details.requestHeaders };

      // Client Hints consistency: Chromium emits its REAL engine version in
      // Sec-CH-UA* headers. A spoofed UA claiming a different Chrome version
      // is the classic bot signal Google cross-checks - rewrite them to match.
      const ua = requestHeaders['User-Agent'] || ses.getUserAgent() || '';
      const vMatch = ua.match(/Chrome\/(\d+)(?:\.(\d+)\.(\d+)\.(\d+))?/);
      if (vMatch) {
        const major = vMatch[1];
        const full = [vMatch[2], vMatch[3], vMatch[4]].filter(Boolean).join('.') || `${major}.0.0.0`;
        const plat = /Windows/i.test(ua) ? '"Windows"' : /Macintosh|Mac OS/i.test(ua) ? '"macOS"' : /Linux/i.test(ua) ? '"Linux"' : /Android/i.test(ua) ? '"Android"' : '"Windows"';
        requestHeaders['Sec-CH-UA'] = `"Chromium";v="${major}", "Google Chrome";v="${major}", "Not-A.Brand";v="99"`;
        requestHeaders['Sec-CH-UA-Full-Version-List'] = `"Chromium";v="${full}", "Google Chrome";v="${full}", "Not-A.Brand";v="99.0.0.0"`;
        requestHeaders['Sec-CH-UA-Mobile'] = '?0';
        requestHeaders['Sec-CH-UA-Platform'] = plat;
      }

      if (this.configStore.getPref('privacy.shield.dnt_header', true)) {
        requestHeaders['DNT'] = '1';
      }
      if (this.configStore.getPref('privacy.shield.gpc_header', true)) {
        requestHeaders['Sec-GPC'] = '1';
      }

      // Referrer stripping
      if (details.referrer && details.referrer.length > 0) {
        try {
          const reqUrl = new URL(details.url);
          const refUrl = new URL(details.referrer);
          // Strip full path if cross-origin
          if (reqUrl.origin !== refUrl.origin) {
            requestHeaders['Referer'] = refUrl.origin + '/';
          }
        } catch (e) {}
      }

      // Strip FLoC / client-hints telemetry if needed
      delete requestHeaders['X-Client-Data'];

      callback({ requestHeaders });
    });

    // 3. Filter Response Headers (Anti-Tracking, Disallow FLoC cohorting)
    ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
      const responseHeaders = { ...details.responseHeaders };

      // Disable FLoC, Privacy Sandbox, and Geolocation/Sensors via Permissions-Policy
      responseHeaders['Permissions-Policy'] = [
        'geolocation=(), camera=(), microphone=(), interest-cohort=(), browsing-topics=(), attribution-reporting=(), run-ad-auction=()'
      ];

      callback({ responseHeaders });
    });
  }

  getStats(profileId = null) {
    return {
      totalBlocked: this.blockedCount,
      uniqueBlockedDomains: this.blockedDomains.size,
      profileBlocked: profileId ? (this.sessionStats.get(profileId) || 0) : this.blockedCount
    };
  }

  resetStats() {
    this.blockedCount = 0;
    this.blockedDomains.clear();
    this.sessionStats.clear();
  }
}

module.exports = AdblockShield;

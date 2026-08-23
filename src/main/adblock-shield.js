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
      regexes: patterns.map(pattern => new RegExp(
        pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'),
        'i'
      ))
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
        for (const regex of ruleSet.regexes) {
          if (regex.test(url)) {
            this.blockedCount++;
            this.blockedDomains.add(parsed.hostname);
            return true;
          }
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

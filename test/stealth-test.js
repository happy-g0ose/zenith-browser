const assert = require('assert');
const configStore = require('../src/main/config-store');
const AdblockShield = require('../src/main/adblock-shield');
const { generateStealthScript } = require('../src/stealth/stealth-injections');

console.log('[TEST] Starting Zenith Automated Verification Test Suite...\n');

// 1. Test Config Store
console.log('1. Testing ConfigStore...');
const prefs = configStore.getAllPrefs();
assert(prefs['stealth.canvas.noise'] === true, 'Default canvas noise should be true');
assert(prefs['privacy.shield.block_trackers'] === true, 'Tracker blocking should be true');
assert(prefs['privacy.shield.enabled'] === true, 'Privacy shield should be enabled by default');
assert(!('privacy.geolocation.block' in prefs) && !('network.proxy.enabled' in prefs) && !('ui.homepage' in prefs),
  'Removed legacy prefs must not reappear in defaults');

const profiles = configStore.getProfiles();
assert(profiles.length >= 3, 'Should have at least 3 default stealth profiles');

const randomProfile = configStore.generateRandomFingerprint('Test Ghost Identity');
assert(randomProfile.seed > 0, 'Generated profile must have a valid numerical seed');
assert(randomProfile.renderer.length > 0, 'Generated profile must have a GPU renderer');
console.log('  [PASS] ConfigStore & Random Fingerprint generator passed.');

// 2. Test Adblock Shield
console.log('\n2. Testing AdblockShield & Geolocation Blocker...');
const shield = new AdblockShield(configStore);
assert(shield.isBlocked('https://www.google-analytics.com/analytics.js') === true, 'Google Analytics should be blocked');
assert(shield.isBlocked('https://connect.facebook.net/en_US/fbevents.js') === true, 'Facebook Pixel should be blocked');
assert(shield.isBlocked('https://hotjar.com/c/hotjar-123.js') === true, 'Hotjar should be blocked');
assert(shield.isBlocked('https://coinhive.com/lib/coinhive.min.js') === true, 'Coinhive miner should be blocked');
assert(shield.isBlocked('https://www.googleapis.com/geolocation/v1/geolocate') === true, 'Google Geolocation endpoint should be blocked');
assert(shield.isBlocked('https://api.ipgeolocation.io/ipgeo') === true, 'IP Geolocation API should be blocked');
assert(shield.isBlocked('https://wikipedia.org/wiki/Main_Page') === false, 'Legitimate site should NOT be blocked');
assert(shield.isBlocked('https://duckduckgo.com/') === false, 'Search engine should NOT be blocked');
console.log('  [PASS] AdblockShield & Geolocation blocker rules passed.');

// 3. Test Stealth Injections Generation
console.log('\n3. Testing Stealth Injections Script Generator...');
const stealthScript = generateStealthScript(randomProfile);
assert(stealthScript.includes('HTMLCanvasElement.prototype.toDataURL'), 'Script must hook Canvas toDataURL');
assert(stealthScript.includes('UNMASKED_VENDOR_WEBGL'), 'Script must hook WebGL vendor');
assert(stealthScript.includes('UNMASKED_RENDERER_WEBGL'), 'Script must hook WebGL renderer');
assert(stealthScript.includes('AudioBuffer.prototype.getChannelData'), 'Script must hook AudioBuffer');
assert(stealthScript.includes('RTCPeerConnection'), 'Script must hook WebRTC for IP sanitization');
assert(stealthScript.includes('Navigator.prototype'), 'Script must spoof Navigator prototype');
assert(stealthScript.includes('getCurrentPosition'), 'Script must hook Geolocation getCurrentPosition');
assert(stealthScript.includes('PERMISSION_DENIED'), 'Script must deny Geolocation');
assert(stealthScript.includes(randomProfile.vendor), 'Script must contain profile vendor');
assert(stealthScript.includes('__AEGIS_STEALTH_ACTIVE__'), 'Script must have idempotency guard');
assert(stealthScript.includes('Screen.prototype'), 'Script must spoof window.screen identity');
assert(stealthScript.includes('devicePixelRatio'), 'Script must spoof devicePixelRatio');
assert(stealthScript.includes('PROFILE.clientrectsJitter'), 'Script must include ClientRects jitter defense');
assert(!/turnstile/i.test(stealthScript), 'Removed Turnstile assistant must not return');

// Verify JS syntax
try {
  new Function(stealthScript);
  console.log('  [PASS] Stealth script generated with valid JavaScript syntax.');
} catch (e) {
  assert.fail('Stealth script syntax error: ' + e.message);
}

// 4. Test userChrome.css persistence
console.log('\n4. Testing userChrome.css customization...');
const initialCSS = configStore.getUserChromeCSS();
assert(initialCSS.includes('userChrome.css'), 'userChrome.css should contain initial comments');
configStore.setUserChromeCSS(initialCSS + '\n/* Test Custom Rule */\n');
assert(configStore.getUserChromeCSS().includes('Test Custom Rule'), 'userChrome.css should persist modified rules');
configStore.setUserChromeCSS(initialCSS); // Restore
console.log('  [PASS] userChrome.css storage passed.');

console.log('\n=========================================');
console.log('[ALL TESTS PASSED] ZENITH VERIFIED OK');
console.log('=========================================\n');

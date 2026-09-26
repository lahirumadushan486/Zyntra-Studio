'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('js/custom-package-builder.js', 'utf8');
const styles = fs.readFileSync('css/custom-package-builder.css', 'utf8');

// Existing prices are contract values and YouTube long-form must never alter them.
assert.match(script, /managementFirstPlatform:\s*7000/);
assert.match(script, /managementAdditionalPlatform:\s*1000/);
assert.match(script, /postFirstTen:\s*1000/);
assert.match(script, /postAfterTen:\s*800/);
assert.match(script, /video25:\s*2000/);
assert.match(script, /video50:\s*3000/);
assert.match(script, /story:\s*1400/);
assert.doesNotMatch(script, /youtube(?:LongForm)?Price|youtubeRate|pricePerMinute/i, 'YouTube editing must not have a price or per-minute rate');

assert.match(html, /id="custom-youtube-enabled"/);
assert.match(html, /id="custom-youtube-durations"/);
assert.match(html, /Basic Editing[\s\S]*Professional Editing[\s\S]*Advanced Editing/);
assert.match(html, /Thumbnail Design[\s\S]*Subtitles[\s\S]*Intro \/ Outro[\s\S]*Motion Graphics/);
assert.match(html, /final price will be discussed and confirmed separately/);

assert.match(script, /var youtubeLongForm = \{[\s\S]*enabled: false[\s\S]*videos: \[\{ durationMinutes: 1/);
assert.match(script, /videos\.length >= 1 && videos\.length <= 20/);
assert.match(script, /video\.durationMinutes >= 1 && video\.durationMinutes <= 180/);
assert.match(script, /hasPrimaryContent = mainContentCount > 0 \|\| youtube\.valid/);
assert.match(script, /youtube\.enabled && total === 0/);
assert.match(script, /CUSTOM QUOTE REQUIRED/g);
assert.match(script, /does not include YouTube long-form video editing/);

assert.match(script, /YouTube Long-Form Videos: /);
assert.match(script, /Video Durations: /);
assert.match(script, /Total Duration: /);
assert.match(script, /Editing Type: /);
assert.match(script, /Additional Requirements: /);
assert.match(script, /youtubeItem\.append\(youtubeTitle, youtubeDetailsList, youtubeQuoteNotice\)/);

assert.match(script, /url\.searchParams\.set\('ytDurations'/);
assert.match(script, /url\.searchParams\.set\('ytEditing'/);
assert.match(script, /url\.searchParams\.set\('ytAddons'/);
assert.match(script, /function restoreSharedPackageState\(\)/);
assert.match(script, /durationValues\.length >= 1 && durationValues\.length <= 20/);
assert.match(script, /Object\.prototype\.hasOwnProperty\.call\(YOUTUBE_EDITING_TYPES, sharedEditingType\)/);
assert.match(script, /if \(params\.get\('zpkg'\) !== '1'\) return false/, 'Old links without package state must remain compatible');

assert.match(styles, /custom-package-builder__durations\{[^}]*grid-template-columns:repeat\(2/);
assert.match(styles, /@media\(max-width:700px\)\{[^}]*custom-package-builder__youtube/);
assert.match(styles, /custom-package-card--export \.custom-package-card__youtube div\{grid-template-columns:repeat\(2/);
assert.match(script, /Math\.ceil\(exportCard\.scrollHeight\)/, 'YouTube details must use the content-sized export path');

console.log('Custom package YouTube long-form contract tests: PASS');

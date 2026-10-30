'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const builder = fs.readFileSync('js/custom-package-builder.js', 'utf8');
const quotation = fs.readFileSync('assets/js/zyntra-quotation.js', 'utf8');
const html = fs.readFileSync('quotation.html', 'utf8');
const css = fs.readFileSync('assets/css/zyntra-quotation.css', 'utf8');
const schema = fs.readFileSync('js/quotation-schema.js', 'utf8');

const isoFunction = schema.match(/export function isIsoDate\(value\) \{[\s\S]*?\n\}/);
const dateFunction = schema.match(/export function addQuotationDays\(isoDate, days\) \{[\s\S]*?\n\}/);
assert.ok(dateFunction, 'Quotation date calculator must exist');
const dateContext = {};
vm.createContext(dateContext);
vm.runInContext(`${isoFunction[0].replace('export ', '')}\n${dateFunction[0].replace('export ', '')}`, dateContext);
assert.equal(dateContext.addQuotationDays('2026-01-31', 28), '2026-02-28');
assert.equal(dateContext.addQuotationDays('2026-12-15', 28), '2027-01-12');
assert.equal(dateContext.addQuotationDays('2028-02-10', 28), '2028-03-09');

assert.match(builder, /saveBuilderState\(\)/);
assert.match(builder, /restoreStoredBuilderState\(\)/);
assert.match(builder, /quotationSelectionKey\(snapshot\.selection\) === quotationSelectionKey\(stored\.generated\)/);
assert.match(builder, /Your selections have changed\. Click Create My Package to update your quotation\./);
assert.match(builder, /downloadButton\.disabled = true;[\s\S]*whatsappButton\.disabled = true;/);
assert.match(builder, /createQuotationReference\(issueDate\)/);

assert.match(schema, /JSON\.stringify\(snapshot\.totals\) !== JSON\.stringify\(expected\.totals\)/);
assert.match(schema, /snapshot\.expiryDate !== expected\.expiryDate/);
assert.match(quotation, /getColomboToday\(\) > snapshot\.expiryDate/);
assert.match(quotation, /add\('Content scheduling'\); add\('Page maintenance'\); add\('Ad boosting support'\)/);
assert.match(quotation, /if \(selection\.management && selection\.platforms\.length\)/);
assert.match(quotation, /if \(selection\.quantities\.stories > 0\) add\('Simple story-style editing'\)/);
assert.match(quotation, /snapshot\.hasQuoteOnlyService/);
assert.match(html, /Price to be discussed separately/);
assert.match(quotation, /Advertising spend and ad boosting management are not included in this content package\./);
assert.match(html, /Final scope and pricing are subject to confirmation by Zyntra Studio\./);
assert.doesNotMatch(quotation, /innerHTML|window\.open/);
assert.match(quotation, /new URLSearchParams\(window\.location\.search\)\.get\('quote'\)/);

assert.match(html, /<thead><tr><th scope="col">Service<\/th><th scope="col">Selected Details<\/th><\/tr><\/thead>/);
assert.match(html, /Thank you for choosing Zyntra Studio\./);
assert.match(html, /070 600 4033/);
assert.match(css, /quotation-services thead\{display:table-header-group\}/);
assert.match(css, /quotation-services table\{break-inside:auto;page-break-inside:auto\}/);
assert.match(css, /quotation-total,.quotation-notes,.quotation-footer\{break-inside:avoid;page-break-inside:avoid\}/);

console.log('Custom package quotation state, validity and print tests: PASS');

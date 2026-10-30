'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const builderScript = fs.readFileSync('js/custom-package-builder.js', 'utf8');
const quotationHtml = fs.readFileSync('quotation.html', 'utf8');
const quotationScript = fs.readFileSync('assets/js/zyntra-quotation.js', 'utf8');
const quotationStyles = fs.readFileSync('assets/css/zyntra-quotation.css', 'utf8');
const quotationSchema = fs.readFileSync('js/quotation-schema.js', 'utf8');

assert.match(indexHtml, /View \/ Print Quotation/);
assert.doesNotMatch(indexHtml, /Download Package Image|html2canvas\.min\.js/);
assert.doesNotMatch(builderScript, /html2canvas|renderQuotationBlob|canvasToBlob|createObjectURL/);
assert.match(builderScript, /createQuotationSnapshot\(generatedState\)/);
assert.match(quotationSchema, /expiryDate: addQuotationDays\(input\.issueDate, 28\)/);
assert.match(builderScript, /window\.location\.assign\('quotation\.html\?quote='/);
assert.match(quotationHtml, /YOUR SELECTED SERVICES/);
assert.match(quotationHtml, /Print \/ Save as PDF/);
assert.match(quotationHtml, /Quoted prices are valid for 28 days from the quotation date\./);
assert.equal((quotationHtml.match(/id="quotation-total"/g) || []).length, 1);
assert.match(quotationScript, /normalizeAndValidateQuotationSnapshot/);
assert.doesNotMatch(quotationScript, /innerHTML/);
assert.match(quotationScript, /window\.print\(\)/);
assert.match(quotationStyles, /@page\{size:A4 portrait/);
assert.match(quotationStyles, /quotation-services thead\{display:table-header-group\}/);
console.log('Custom package quotation preview contract tests: PASS');

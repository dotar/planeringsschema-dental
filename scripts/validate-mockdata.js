#!/usr/bin/env node
const { DB, getMockDataIntegrityIssues } = require('../js/mockdata.js');

const issues = getMockDataIntegrityIssues(DB);

if (!issues.length) {
  console.log('✅ Mock data integrity check passed: no orphaned person/station references found.');
  process.exit(0);
}

console.error(`❌ Mock data integrity check failed with ${issues.length} orphaned reference(s):`);
for (const issue of issues) {
  console.error(
    `- [${issue.dataset}] ${issue.type} at training[${issue.index}] (personId=${issue.personId}, stationId=${issue.stationId})`
  );
}
process.exit(1);

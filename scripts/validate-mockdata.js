#!/usr/bin/env node
const { RAW_DB, getMockDataIntegrityIssues, reconcileTrainingForeignKeys } = require('../js/mockdata.js');

const rawIssues = getMockDataIntegrityIssues(RAW_DB);

if (rawIssues.length) {
  console.error(`❌ Mock data integrity check failed with ${rawIssues.length} orphaned reference(s) in raw source data:`);
  for (const issue of rawIssues) {
    console.error(
      `- [${issue.dataset}] ${issue.type} at training[${issue.index}] (personId=${issue.personId}, stationId=${issue.stationId})`
    );
  }
  process.exit(1);
}

const reconciled = JSON.parse(JSON.stringify(RAW_DB));
const droppedRows = reconcileTrainingForeignKeys(reconciled, {
  datasetLabel: 'validate:raw',
  logInvalidRows: false
});
const reconciledIssues = getMockDataIntegrityIssues(reconciled);

if (droppedRows.length || reconciledIssues.length) {
  console.error('❌ Reconciliation check failed unexpectedly.');
  if (droppedRows.length) {
    console.error(`- droppedRows=${droppedRows.length}`);
  }
  if (reconciledIssues.length) {
    console.error(`- reconciledIssues=${reconciledIssues.length}`);
  }
  process.exit(1);
}

console.log('✅ Mock data integrity check passed on raw source data and reconciliation remains clean.');
process.exit(0);

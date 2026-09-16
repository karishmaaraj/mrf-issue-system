import { sortAndFilterAttentionItems, getAttentionLevel } from './admin-portal/src/utils/priorityLogic.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

console.log('\n==================================================');
console.log('STARTING ADMIN DASHBOARD ATTENTION LOGIC TESTS');
console.log('==================================================\n');

// 1. Unsolved + Unassigned -> appears
const t1 = { ticketNo: '#001', status: 'Unsolved', assignedWorker: null };
assert(getAttentionLevel(t1) === 3, 'Unsolved + Unassigned -> appears (level 3)');

// 2. Unsolved + High -> appears
const t2 = { ticketNo: '#002', status: 'Unsolved', priority: 'High', assignedWorker: 'Worker A' };
assert(getAttentionLevel(t2) === 2, 'Unsolved + High -> appears (level 2)');

// 3. Unsolved + Critical -> appears
const t3 = { ticketNo: '#003', status: 'Unsolved', priority: 'Critical', assignedWorker: 'Worker A' };
assert(getAttentionLevel(t3) === 1, 'Unsolved + Critical -> appears (level 1)');

// 4. Unsolved + isUrgent=true -> appears
const t4 = { ticketNo: '#004', status: 'Unsolved', isUrgent: true, assignedWorker: 'Worker A' };
assert(getAttentionLevel(t4) === 1, 'Unsolved + isUrgent=true -> appears (level 1)');

// 5. Critical + isUrgent=false -> still appears
const t5 = { ticketNo: '#005', status: 'Unsolved', priority: 'Critical', isUrgent: false, assignedWorker: 'Worker A' };
assert(getAttentionLevel(t5) === 1, 'Critical + isUrgent=false -> still appears (level 1)');

// 6. High + isUrgent=true -> appears
const t6 = { ticketNo: '#006', status: 'Unsolved', priority: 'High', isUrgent: true, assignedWorker: 'Worker A' };
assert(getAttentionLevel(t6) === 1, 'High + isUrgent=true -> appears (level 1 due to isUrgent)');

// 7. Ongoing + Critical -> verify according to existing attention rules
const t7 = { ticketNo: '#007', status: 'Ongoing', priority: 'Critical', assignedWorker: 'Worker A' };
assert(getAttentionLevel(t7) === 1, 'Ongoing + Critical -> appears as action required');

// 8. Awaiting User Confirmation + Critical -> verify according to existing attention rules
const t8 = { ticketNo: '#008', status: 'Awaiting User Confirmation', priority: 'Critical' };
assert(getAttentionLevel(t8) === 1, 'Awaiting User Confirmation + Critical -> appears as action required');

// 9. Resolved + Critical -> does NOT appear as actionable attention
const t9 = { ticketNo: '#009', status: 'Resolved', priority: 'Critical' };
assert(getAttentionLevel(t9) === 99, 'Resolved + Critical -> does NOT appear (level 99)');

// 10. Archived + Critical -> does NOT appear
const t10 = { ticketNo: '#010', status: 'Archived', priority: 'Critical' };
assert(getAttentionLevel(t10) === 99, 'Archived + Critical -> does NOT appear (level 99)');

// 11. Reopened -> appears
const t11 = { ticketNo: '#011', status: 'Reopened', assignedWorker: 'Worker A' };
assert(getAttentionLevel(t11) === 4, 'Reopened -> appears (level 4)');

// 12. Same ticket matching multiple attention rules -> appears only once
const t12a = { ticketNo: '#012', status: 'Unsolved', priority: 'Critical', isUrgent: true, assignedWorker: null };
const t12b = { ticketNo: '#012', status: 'Unsolved', priority: 'Critical', isUrgent: true, assignedWorker: null }; 
const deduped = sortAndFilterAttentionItems([t12a, t12b]);
assert(deduped.length === 1 && deduped[0].ticketNo === '#012', 'Duplicate tickets are deduplicated');

// 13. Ticket #200 MUST appear
const t200 = {
  ticketNo: '#200',
  status: 'Unsolved',
  priority: 'Critical',
  issueCategory: 'Electrical issue: switch box issue',
  assignedWorker: 'Karishmaa M',
  block: 'Block B',
  roomNo: '115'
};
assert(getAttentionLevel(t200) === 1, 'Ticket #200 (Critical, Unsolved, Assigned) -> MUST appear (level 1)');

// 14. Sorting logic validation
const unsorted = [t11, t200, t2, t1]; 
const sorted = sortAndFilterAttentionItems(unsorted);
assert(
  sorted[0].ticketNo === '#200' && 
  sorted[1].ticketNo === '#002' && 
  sorted[2].ticketNo === '#001' && 
  sorted[3].ticketNo === '#011',
  'Sorting prioritizes correctly: Critical > High > Unsolved > Reopened'
);

console.log('\n==================================================');
console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('==================================================\n');

if (failedTests > 0) {
  process.exit(1);
}

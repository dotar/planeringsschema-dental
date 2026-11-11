const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const shifts = ['day', 'evening', 'night'];
const shiftCollections = ['persons', 'groups', 'timeSlots', 'compatibility', 'training', 'assignments', 'groupDisplayOrder'];

function fixture() {
  const stations = [
    ['s1', 1, 10], ['s2', 1, 10], ['resource', 1, 11], ['legacy', 1, null], ['other', 'expedition', 20]
  ].map(([id, factoryId, groupId], index) => ({
    id, factoryId, groupId, title: id, defaultCapacity: 1, operational: true, sort: index + 1,
    isResurs: id === 'resource' || id === 'legacy'
  }));
  const shiftData = Object.fromEntries(shifts.map(shift => {
    const persons = [
      { id: `${shift}-p1`, factoryId: 1, groupId: 10 },
      { id: `${shift}-p2`, factoryId: 1, groupId: 10 },
      { id: `${shift}-p3`, factoryId: 1, groupId: 12 },
      { id: `${shift}-other`, factoryId: 'expedition', groupId: 20 }
    ].map(p => ({ ...p, name: p.id, isNight: shift === 'night', present: true }));
    return [shift, {
      persons,
      groups: [10, 11, 12, 20].map(id => ({ id, factoryId: id === 20 ? 'expedition' : 1, title: String(id), isResursGroup: id === 11 })),
      timeSlots: [
        { id: 'slot1', factoryId: 1, dayType: 'EveningMonThu', start: '15:00', end: '16:00', type: 'Work', sort: 1 },
        { id: 'slot2', factoryId: 1, dayType: 'EveningMonThu', start: '16:00', end: '17:00', type: 'Work', sort: 2 },
        { id: 'ot1', factoryId: 1, dayType: 'OvertimeDay', start: '07:00', end: '08:00', type: 'Work', sort: 1 },
        { id: 'other-slot', factoryId: 'expedition', dayType: 'EveningMonThu', start: '15:00', end: '16:00', type: 'Work', sort: 1 }
      ],
      training: persons.flatMap(p => stations.filter(s => s.factoryId === p.factoryId).map(s => ({ personId: p.id, stationId: s.id }))),
      compatibility: [], assignments: [], groupDisplayOrder: { 1: [10, 11, 12, 'resurs'], expedition: [20] }
    }];
  }));
  return { factories: [{ id: 1, title: 'Main' }, { id: 'expedition', title: 'Other' }], stations, ...structuredClone(shiftData.evening), shiftData };
}

function harness() {
  const elements = new Map([
    ['dateInput', { value: '2026-11-11' }], ['undoBtn', {}], ['redoBtn', {}],
    ...['avoidConsecutive', 'fillResurs', 'keepPrefilled', 'preferTrained', 'preferCriticalCoverage'].map(id => [id, { checked: id === 'preferTrained' }])
  ]);
  const storage = new Map();
  let seed = 42;
  const math = Object.create(Math);
  math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const context = vm.createContext({
    assert, fixture: fixture(), Math: math, URLSearchParams,
    plain: value => JSON.parse(JSON.stringify(value)),
    console: { log() {}, warn() {}, error() {} },
    CSS: { supports: () => false, escape: String },
    document: {
      getElementById: id => elements.get(id) || null,
      addEventListener() {},
      querySelectorAll: selector => {
        if (selector === '#randGroups input:checked') return [{ value: '10' }];
        if (selector === '#randStations input[data-kind="station"]:checked') return [{ value: 's1' }, { value: 's2' }];
        return [];
      }
    },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    bootstrap: { Modal: { getInstance: () => ({ hide() {} }) } }
  });
  vm.runInContext('const DB=fixture;', context);
  for (const file of ['schema', 'state', 'scheduling-calculations', 'invalidation', 'history', 'ui-grid', 'validation', 'assignment-warnings', 'randomizer', 'settings']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', `${file}.js`), 'utf8'), context, { filename: `${file}.js` });
  }
  vm.runInContext(`
    renderSchemaDiagnostics=()=>{};
    rebuildAll=()=>{};
    renderSettings=()=>{};
    addPersonPill=()=>{};
    refreshAutoGenerateWarnings=()=>{};
    validateChangedCells=()=>{};
    createAssignmentInvalidationSetFromDiff=diff=>diff;
    showToast=()=>{};
    function cell(stationId='s1',slotId='slot1'){
      return {dataset:{stationId,slotId},classList:{add(){},remove(){}},querySelector:()=>null};
    }
    findCell=(stationId,slotId)=>cell(stationId,slotId);
    mode='edit';
    assert.equal(setShift('evening',{updateUrl:false}),true);
    function row(overrides={}){
      return {date:'2026-11-11',factoryId:1,dayType:'EveningMonThu',timeSlotId:'slot1',groupId:10,stationId:'s1',personId:'evening-p1',...overrides};
    }
    function roundTrip(){
      const start=currentShift;
      assert.equal(setShift(start==='day'?'night':'day',{updateUrl:false}),true);
      resetAssignmentHistory();
      assert.equal(setShift(start,{updateUrl:false}),true);
      resetAssignmentHistory();
    }
    function sentinelRows(){
      const rows=[row({date:'2026-11-12'}),row({dayType:'EveningFri'}),row({factoryId:'expedition',stationId:'other',personId:'evening-other',timeSlotId:'other-slot'})];
      DB.assignments.push(...rows);
      DB.shiftData.day.assignments.push(row({personId:'day-p1'}));
      DB.shiftData.night.assignments.push(row({personId:'night-p1'}));
      return plain(rows);
    }
  `, context);
  const refs = vm.runInContext('Object.fromEntries(Object.entries(DB.shiftData).map(([shift,data])=>[shift,{...data}]))', context);
  return {
    run: source => vm.runInContext(source, context),
    checkIdentity() {
      const db = vm.runInContext('DB', context);
      for (const shift of shifts) for (const key of shiftCollections) assert.equal(db.shiftData[shift][key], refs[shift][key], `${shift}.${key}`);
      const active = vm.runInContext('currentShift', context);
      for (const key of shiftCollections) assert.equal(db[key], db.shiftData[active][key], key);
    }
  };
}

test('in-place removal retains row order, identity, and the original array', () => {
  const h = harness();
  h.run(`
    const a={},b={},c={},d={}; const rows=[a,b,c,d];
    const removed=removeRowsInPlace(rows,r=>r===b || r===d);
    assert.equal(rows[0],a); assert.equal(rows[1],c); assert.equal(rows.length,2);
    assert.equal(removed[0],b); assert.equal(removed[1],d);
    assert.equal(removeRowsInPlace(rows,()=>false).length,0);
    assert.throws(()=>removeRowsInPlace(rows,()=>{throw new Error('predicate');}));
    assert.equal(rows.length,2);
  `);
});

test('adds, removals, moves, and remove-then-add survive repeated shift changes', () => {
  const h = harness();
  h.run(`
    const sentinels=sentinelRows();
    const otherBefore=plain([DB.shiftData.day,DB.shiftData.night]);
    placePerson(cell(),DB.stations[0],DB.timeSlots[0],'evening-p1');
    roundTrip();
    assert.equal(DB.assignments.length,4);
    movePersonTo(cell('s2'),DB.stations[1],DB.timeSlots[0],'evening-p1');
    assert.equal(assignmentHistoryUndoStack.length,1);
    assert.equal(assignmentHistoryUndoStack[0].added.length,1);
    assert.equal(assignmentHistoryUndoStack[0].removed.length,1);
    roundTrip();
    assert.equal(DB.assignments.find(a=>a.date==='2026-11-11' && a.dayType===currentDayType && a.factoryId===1).stationId,'s2');
    removePersonPill(cell('s2'),'evening-p1');
    roundTrip();
    assert.deepEqual(plain(DB.assignments),sentinels);
    placePerson(cell(),DB.stations[0],DB.timeSlots[0],'evening-p2');
    roundTrip(); roundTrip();
    assert.equal(DB.assignments.at(-1).personId,'evening-p2');
    assert.deepEqual(plain(DB.assignments.slice(0,3)),sentinels);
    assert.deepEqual(plain([DB.shiftData.day,DB.shiftData.night]),otherBefore);
  `);
  h.checkIdentity();
});

test('manual moves and removals explicitly respect factory boundaries', () => {
  const h = harness();
  h.run(`
    // A matching person/slot sentinel exposes accidental predicate widening.
    DB.assignments.push(row({factoryId:'expedition'}));
    movePersonTo(cell(),DB.stations[0],DB.timeSlots[0],'evening-p1');
    removePersonPill(cell(),'evening-p1');
    assert.equal(DB.assignments.length,1);
    assert.equal(DB.assignments[0].factoryId,'expedition');
  `);
  h.checkIdentity();
});

test('no-op and inverse edits preserve redo; a new edit clears it', () => {
  const h = harness();
  h.run(`
    withAssignmentHistoryAction('add',()=>addAssignmentRow(row()));
    undoAssignmentChange();
    withAssignmentHistoryAction('nothing',()=>removeAssignmentsWhere(()=>false));
    assert.equal(assignmentHistoryRedoStack.length,1);
    withAssignmentHistoryAction('inverse',()=>{
      addAssignmentRow(row()); removeAssignmentsWhere(()=>true);
    });
    assert.equal(assignmentHistoryUndoStack.length,0);
    assert.equal(assignmentHistoryRedoStack.length,1);
    redoAssignmentChange();
    assert.equal(DB.assignments.length,1);
    undoAssignmentChange();
    withAssignmentHistoryAction('new',()=>addAssignmentRow(row({personId:'evening-p2'})));
    assert.equal(assignmentHistoryRedoStack.length,0);
  `);
  h.checkIdentity();
});

for (const action of ['add', 'remove', 'move']) for (const redo of [false, true]) {
  test(`${action}: ${redo ? 'undo then redo' : 'undo'} survives switching`, () => {
    const h = harness();
    h.run(`
      ${action === 'add' ? '' : 'addAssignmentRow(row());'}
      const before=plain(DB.assignments);
      ${action === 'add' ? "placePerson(cell(),DB.stations[0],DB.timeSlots[0],'evening-p1');" : action === 'remove' ? "removePersonPill(cell(),'evening-p1');" : "movePersonTo(cell('s2'),DB.stations[1],DB.timeSlots[0],'evening-p1');"}
      const after=plain(DB.assignments);
      assert.equal(assignmentHistoryUndoStack.length,1);
      undoAssignmentChange();
      assert.deepEqual(plain(DB.assignments),before);
      ${redo ? 'redoAssignmentChange(); assert.deepEqual(plain(DB.assignments),after);' : ''}
      const expected=plain(DB.assignments);
      roundTrip();
      assert.deepEqual(plain(DB.assignments),expected);
      assert.equal(assignmentHistoryUndoStack.length,0);
      assert.equal(assignmentHistoryRedoStack.length,0);
      assert.equal(document.getElementById('undoBtn').disabled,true);
      assert.equal(document.getElementById('redoBtn').disabled,true);
    `);
    h.checkIdentity();
  });
}

test('history refuses replay in another factory, date, day type, shift, or viewer mode', () => {
  for (const change of ["currentFactoryId='expedition'", "document.getElementById('dateInput').value='2026-11-12'", "currentDayType=DayType.OvertimeDay", "setShift('day',{updateUrl:false})", "mode='viewer'"]) {
    const h = harness();
    h.run(`
      withAssignmentHistoryAction('add',()=>addAssignmentRow(row()));
      const before=plain(DB.shiftData);
      ${change}; undoAssignmentChange();
      assert.deepEqual(plain(DB.shiftData),before);
      assert.equal(assignmentHistoryUndoStack.length,mode==='viewer'?1:0);
    `);
  }
});

for (const scenario of ['empty', 'replace', 'keep']) {
  test(`real auto-generation (${scenario}) stays in its context and remains one undo action`, () => {
    const h = harness();
    h.run(`
      const sentinels=sentinelRows();
      const others=plain([DB.shiftData.day,DB.shiftData.night]);
      ${scenario === 'empty' ? '' : 'addAssignmentRow(row());'}
      document.getElementById('keepPrefilled').checked=${scenario === 'keep'};
      const before=plain(DB.assignments);
      runRandomizer();
      const after=plain(DB.assignments);
      assert.equal(assignmentHistoryUndoStack.length,1);
      assert.equal(after.length,7);
      assert.deepEqual(after.slice(0,3),sentinels);
      assert.deepEqual(plain([DB.shiftData.day,DB.shiftData.night]),others);
      undoAssignmentChange(); assert.deepEqual(plain(DB.assignments),before);
      redoAssignmentChange();
      // Replay need not restore physical row order, but must restore the same rows.
      assert.deepEqual(plain(DB.assignments).map(getAssignmentRowKey).sort(),after.map(getAssignmentRowKey).sort());
      const final=plain(DB.assignments);
      roundTrip(); assert.deepEqual(plain(DB.assignments),final);
    `);
    h.checkIdentity();
  });
}

test('person deletion removes orphaned borrowed rows, training and compatibility only', () => {
  const h = harness();
  h.run(`
    sentinelRows(); addAssignmentRow(row());
    DB.shiftData.day.assignments.push(row({dayType:DayType.OvertimeDay,timeSlotId:'ot1'}));
    DB.compatibility.push({a:'evening-p1',b:'evening-p2'});
    const dayPeople=plain(DB.shiftData.day.persons);
    const otherFactory=plain(DB.persons.filter(p=>p.factoryId==='expedition'));
    assert.equal(deletePlanningPerson('evening',1,'evening-p1'),true);
    for(const data of Object.values(DB.shiftData)) assert.equal(data.assignments.some(a=>a.personId==='evening-p1'),false);
    assert.equal(DB.training.some(t=>t.personId==='evening-p1'),false);
    assert.equal(DB.compatibility.length,0);
    assert.deepEqual(plain(DB.shiftData.day.persons),dayPeople);
    assert.deepEqual(plain(DB.persons.filter(p=>p.factoryId==='expedition')),otherFactory);
    assert.equal(assertDbShape(DB,{requireShiftData:true}).ok,true);
    roundTrip(); assert.equal(DB.persons.some(p=>p.id==='evening-p1'),false);
  `);
  h.checkIdentity();
});

test('deleting one owning-shift person preserves a surviving same-ID person elsewhere', () => {
  const h = harness();
  h.run(`
    DB.shiftData.day.persons.push({...DB.persons[0]});
    DB.shiftData.day.assignments.push(row());
    deletePlanningPerson('evening',1,'evening-p1');
    assert.equal(DB.shiftData.day.assignments.length,1);
    assert.equal(DB.shiftData.day.persons.some(p=>p.id==='evening-p1'),true);
    assert.equal(assertDbShape(DB,{requireShiftData:true}).ok,true);
  `);
});

test('shared station deletion cleans every shift and date while preserving other records', () => {
  const h = harness();
  h.run(`
    for(const [shift,data] of Object.entries(DB.shiftData)){
      data.assignments.push(row({personId:shift+'-p1'}),row({personId:shift+'-p1',date:'2026-11-12'}),row({personId:shift+'-p2',stationId:'s2'}));
    }
    const people=plain(Object.values(DB.shiftData).map(d=>d.persons));
    const otherStation=plain(DB.stations.find(s=>s.id==='other'));
    assert.equal(deletePlanningStations(1,['s1']),true);
    for(const data of Object.values(DB.shiftData)){
      assert.equal(data.assignments.length,1); assert.equal(data.assignments[0].stationId,'s2');
      assert.equal(data.training.some(t=>t.stationId==='s1'),false);
    }
    assert.deepEqual(plain(Object.values(DB.shiftData).map(d=>d.persons)),people);
    assert.deepEqual(plain(DB.stations.find(s=>s.id==='other')),otherStation);
    assert.equal(assertDbShape(DB,{requireShiftData:true}).ok,true);
    roundTrip();
  `);
  h.checkIdentity();
});

test('slot deletion is local to its owning shift, factory and day type, across dates', () => {
  const h = harness();
  h.run(`
    const sentinels=sentinelRows(); addAssignmentRow(row());
    const otherShifts=plain([DB.shiftData.day,DB.shiftData.night]);
    assert.equal(deletePlanningTimeSlot('evening',1,'slot1'),true);
    assert.deepEqual(plain(DB.assignments),sentinels.slice(1));
    assert.deepEqual(plain([DB.shiftData.day,DB.shiftData.night]),otherShifts);
    roundTrip(); assert.equal(DB.timeSlots.some(s=>s.id==='slot1'),false);
  `);
  h.checkIdentity();
});

for (const group of [10, 11]) {
  test(`group ${group} deletion respects shared stations and shift-local people/groups`, () => {
    const h = harness();
    h.run(`
      const otherPeople=plain([DB.shiftData.day.persons,DB.shiftData.night.persons]);
      const otherGroups=plain([DB.shiftData.day.groups,DB.shiftData.night.groups]);
      const otherOrder=plain(DB.groupDisplayOrder.expedition);
      addAssignmentRow(row({stationId:${group === 10 ? "'s1'" : "'resource'"}}));
      assert.equal(deletePlanningGroup('evening',1,${group}),true);
      assert.equal(DB.groups.some(g=>g.id===${group}),false);
      assert.equal(DB.stations.some(s=>s.groupId===${group}),false);
      assert.equal(DB.persons.some(p=>p.id==='evening-p1'),${group === 11});
      assert.deepEqual(plain([DB.shiftData.day.persons,DB.shiftData.night.persons]),otherPeople);
      assert.deepEqual(plain([DB.shiftData.day.groups,DB.shiftData.night.groups]),otherGroups);
      assert.deepEqual(plain(DB.groupDisplayOrder.expedition),otherOrder);
      assert.equal(DB.groupDisplayOrder[1].includes(${group}),false);
      assert.equal(assertDbShape(DB,{requireShiftData:true}).ok,true);
      roundTrip();
    `);
    h.checkIdentity();
  });
}

test('legacy resource deletion clears its display token in every shift', () => {
  const h = harness();
  h.run(`
    deletePlanningStations(1,['legacy']);
    for(const data of Object.values(DB.shiftData)) assert.equal(data.groupDisplayOrder[1].includes('resurs'),false);
  `);
  h.checkIdentity();
});

test('successful settings deletions reset both stacks and warnings; no-ops do not', () => {
  for (const deletion of ["deletePlanningPerson('evening',1,'evening-p1')", "deletePlanningStations(1,['s1'])", "deletePlanningGroup('evening',1,10)", "deletePlanningTimeSlot('evening',1,'slot1')"]) {
    const h = harness();
    h.run(`
      placePerson(cell(),DB.stations[0],DB.timeSlots[0],'evening-p1');
      placePerson(cell('s2','slot2'),DB.stations[1],DB.timeSlots[1],'evening-p2');
      undoAssignmentChange();
      lastAutoGenerateContext={shift:currentShift};
      const before=plain(DB);
      for(const changed of [false,deletePlanningPerson('evening',1,'missing'),deletePlanningStations(1,['missing']),deletePlanningGroup('evening',1,'missing'),deletePlanningTimeSlot('evening',1,'missing')]){
        assert.equal(finishSettingsDeletion(changed,'no-op'),false);
      }
      assert.deepEqual(plain(DB),before);
      assert.equal(assignmentHistoryUndoStack.length,1); assert.equal(assignmentHistoryRedoStack.length,1);
      assert.equal(finishSettingsDeletion(${deletion},'deletion test'),true);
      assert.equal(assignmentHistoryUndoStack.length,0); assert.equal(assignmentHistoryRedoStack.length,0);
      assert.equal(lastAutoGenerateContext,null);
      const after=plain(DB);
      undoAssignmentChange(); redoAssignmentChange();
      assert.deepEqual(plain(DB),after);
    `);
    h.checkIdentity();
  }
});

test('training replacement persists without changing another person, factory, or shift', () => {
  const h = harness();
  h.run(`
    const others=plain([DB.shiftData.day,DB.shiftData.night]);
    const unaffected=plain(DB.training.filter(t=>t.personId!=='evening-p1'));
    removeRowsInPlace(DB.training,t=>t.personId==='evening-p1');
    DB.training.push({personId:'evening-p1',stationId:'s2'});
    roundTrip();
    assert.deepEqual(plain(DB.training.filter(t=>t.personId!=='evening-p1')),unaffected);
    assert.deepEqual(plain(DB.training.filter(t=>t.personId==='evening-p1')),plain([{personId:'evening-p1',stationId:'s2'}]));
    assert.deepEqual(plain([DB.shiftData.day,DB.shiftData.night]),others);
  `);
  h.checkIdentity();
});

test('schema accepts borrowed personnel but rejects unknown and wrong-factory references', () => {
  const h = harness();
  h.run(`
    addAssignmentRow(row({personId:'night-p1',timeSlotId:'slot2'}));
    addAssignmentRow(row({personId:'day-p1',dayType:DayType.OvertimeDay,timeSlotId:'ot1'}));
    assert.equal(assertDbShape(DB,{requireShiftData:true}).ok,true);
    roundTrip();
    for(const invalid of [row({personId:'missing'}),row({stationId:'missing'}),row({personId:'day-other'}),row({stationId:'other'}),row({factoryId:'missing'})]){
      DB.assignments.push(invalid);
      assert.throws(()=>assertDbShape(DB,{requireShiftData:true}),SchemaAssertionError);
      DB.assignments.pop();
    }
    DB.training.push({personId:'night-p1',stationId:'s1'});
    assert.throws(()=>assertDbShape(DB,{requireShiftData:true}),error=>error.diagnostics.issues.some(i=>i.code==='UNKNOWN_PERSON' && i.path.includes('training')));
  `);
});

test('generation warnings distinguish shifts sharing overtime contexts', () => {
  const h = harness();
  h.run(`
    currentDayType=DayType.OvertimeDay;
    runRandomizer();
    assert.equal(lastAutoGenerateContext.shift,'evening');
    assert.ok(getAutoGenerateUnassignedBySlot() instanceof Map);
    setShift('day',{updateUrl:false});
    assert.equal(getAutoGenerateUnassignedBySlot(),null);
    setShift('evening',{updateUrl:false});
    assert.ok(getAutoGenerateUnassignedBySlot() instanceof Map);
  `);
});

test('report training agrees with the board for supplemental and overtime personnel', () => {
  const h = harness();
  h.run(`
    addAssignmentRow(row({personId:'night-p1',timeSlotId:'slot2'}));
    assert.equal(computeDerivedReportMetrics().totals.untrainedAssignments,0);
    currentDayType=DayType.OvertimeDay;
    addAssignmentRow(row({personId:'day-p1',dayType:currentDayType,timeSlotId:'ot1'}));
    assert.equal(computeDerivedReportMetrics().totals.untrainedAssignments,0);
    removeRowsInPlace(DB.shiftData.day.training,t=>t.personId==='day-p1' && t.stationId==='s1');
    assert.equal(computeDerivedReportMetrics().totals.untrainedAssignments,1);
  `);
});

test('initialization clones collections independently when shift data is absent', () => {
  const h = harness();
  h.run(`
    delete DB.shiftData;
    assert.equal(initShiftData(),true);
    for(const key of ['persons','groups','timeSlots','compatibility','training','assignments','groupDisplayOrder']){
      assert.notEqual(DB.shiftData.day[key],DB.shiftData.evening[key]);
      assert.notEqual(DB.shiftData.night[key],DB.shiftData.evening[key]);
    }
  `);
});

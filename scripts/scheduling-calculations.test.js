const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const rules = require('../js/scheduling-calculations.js');

function fixture(){
	const context = {date:'2026-11-11', factoryId:1, shift:'evening', dayType:'EveningMonThu'};
	const person = (id, name) => ({id, name, factoryId:1, groupId:1, present:true});
	const evening = person(201, 'Evening'), night = person(301, 'Night'), day = person(101, 'Day');
	const stations = [
		{id:10, factoryId:1, groupId:1, title:'Open', defaultCapacity:1, operational:true},
		{id:20, factoryId:1, groupId:1, title:'Closed', defaultCapacity:1, operational:false}
	];
	const slot = (id, sort, type, start, end) => ({id, sort, type, start, end, factoryId:1, dayType:context.dayType});
	const timeSlots = [slot('w1', 10, 'Work', '16:00', '17:00'), slot('b1', 11, 'Break', '17:00', '17:15'),
		slot('b2', 12, 'Break', '17:15', '17:30'), slot('w2', 20, 'Work', '17:30', '18:00')];
	const sources = {
		day:{persons:[day], training:[{personId:101, stationId:10}], assignments:[]},
		evening:{persons:[evening], training:[{personId:201, stationId:20}], assignments:[]},
		night:{persons:[night], training:[{personId:301, stationId:10}], assignments:[]}
	};
	const row = (personId, stationId, timeSlotId, extra={}) =>
		({date:context.date, factoryId:1, dayType:context.dayType, personId, stationId, timeSlotId, ...extra});
	const input = {context, stations, timeSlots, persons:[evening, night, day], compatibility:[],
		trainingIndex:rules.buildTrainingIndex(Object.values(sources), stations),
		assignments:[row(301,10,'w1'), row(301,10,'w2'), row(201,20,'w1')]};
	return {input, sources, row};
}

const cellAt = (result, stationId, slotId) => result.cells.find(cell => cell.station.id === stationId && cell.slot.id === slotId);

// Exercise the real classic-script adapters without adding a DOM or test framework dependency.
function appHarness(data=fixture()){
	const {input, sources} = data;
	const active = sources[input.context.shift];
	const db = {stations:input.stations, timeSlots:input.timeSlots, persons:active.persons, training:active.training,
		assignments:input.assignments, compatibility:input.compatibility, shiftData:sources,
		groups:[{id:1, factoryId:1, title:'Group'}], weekdaySettings:[]};
	const sandbox = {DB:db, console:{debug(){}, log(){}}, performance, CSS:{supports:()=>false, escape:String},
		localStorage:{getItem:()=>null, setItem(){}},
		document:{getElementById:id=>id==='dateInput' ? {value:input.context.date} : null,
			querySelectorAll:()=>[], addEventListener(){}},
		shouldShowCompatibilityWarnings:()=>true, shouldValidateBoardForMode:()=>true};
	vm.createContext(sandbox);
	for(const file of ['state','scheduling-calculations','invalidation','history','ui-grid','validation','randomizer']){
		vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'), sandbox, {filename:file});
	}
	const run = code => vm.runInContext(code, sandbox);
	sandbox.context = input.context;
	run(`currentFactoryId=context.factoryId; currentDayType=context.dayType; currentShift=context.shift; mode='edit';`);
	run(`
		var cellStates=new Map(), pillStates=new Map(), summary, report, rebuildCount=0;
		beginCellValidation=scope=>{
			if(!scope){ cellStates.clear(); pillStates.clear(); }
			else for(const key of scope){
				const ref=parseInvalidationKey(key), cell=cellKey(ref.stationId, ref.slotId);
				cellStates.delete(cell);
				for(const pill of pillStates.keys()) if(pill.startsWith(cell+'|')) pillStates.delete(pill);
			}
			return new Map();
		};
		function capture(kind,station,slot,message){
			const key=cellKey(station,slot), messages=cellStates.get(key)||[];
			messages.push(kind+':'+message); cellStates.set(key,messages);
		}
		markCellInvalid=(...args)=>capture('invalid',...args);
		markCellWarn=(...args)=>capture('warn',...args);
		queuePillWarn=(station,slot,person,message)=>pillStates.set(cellKey(station,slot)+'|'+person,message);
		applyCellValidationDiff=()=>{}; applyPillValidationDiff=()=>{};
		renderSummaryPanel=evaluation=>{ summary=computeSummaryMetrics(evaluation); };
		renderDerivedReport=evaluation=>{ report=computeDerivedReportMetrics(evaluation); };
		rebuildAll=()=>{ rebuildCount++; validateBoard(); };
		addPersonPill=()=>{}; refreshAutoGenerateWarnings=()=>{}; findCell=()=>({});
	`);
	const json = code => JSON.parse(run(`JSON.stringify(${code})`));
	return {db, run, json, sandbox, ...data};
}

test('training is a union of valid person IDs across datasets, not names', () => {
	const {input, sources} = fixture();
	sources.evening.persons[0].name = sources.night.persons[0].name;
	sources.night.training.push({personId:301,stationId:10}, {personId:999,stationId:10}, {personId:301,stationId:999});
	const index = rules.buildTrainingIndex(Object.values(sources), input.stations);
	for(const personId of [101,301]) assert.equal(rules.isTrained(index, personId,10), true);
	assert.equal(index.get('301').size, 1);
	assert.equal(rules.isTrained(index,201,10), false);
	assert.equal(rules.isTrained(index,999,10), false);
	assert.equal(rules.isTrained(index,301,999), false);
});

test('original reproduction now has 2/2 coverage, no untrained assignments, closure and rotation', () => {
	const app = appHarness();
	app.run('validateBoard()');
	assert.deepEqual(app.json('[summary.totals.assigned,summary.totals.required,report.totals.coveragePct,report.totals.untrainedAssignments]'), [2,2,100,0]);
	assert.deepEqual(app.json('[summary.totals.rotationCells,summary.totals.nonoperationalCells,summary.totals.capacityCells,report.totals.conflictCount,report.nonoperationalAssignments.length]'), [1,1,0,1,1]);
	assert.equal(app.json('summary.totals.affectedCells'), 2);
	assert.equal(app.json('cellStates.get("20:w1")[0]'), 'warn:Tilldelning på en icke-operativ station.');
	assert.equal(app.run('cellStates.has("20:w2")'), false);
});

test('person-aware wrapper retains cross-shift training in every regular and overtime context', () => {
	const app = appHarness();
	for(const shift of ['day','evening','night']){
		app.run(`currentShift='${shift}'; DB.persons=DB.shiftData[currentShift].persons; DB.training=DB.shiftData[currentShift].training;`);
		for(const dayType of ['Day','EveningMonThu','Night','OvertimeDay']){
			app.run(`currentDayType='${dayType}'`);
			assert.equal(app.run('isPersonTrainedForStation(301,10)'), true);
			assert.equal(app.run('isPersonTrainedForStation(101,10)'), true);
			assert.equal(app.run('isPersonTrainedForStation(201,20)'), true);
		}
	}
});

test('active training replacement overrides its stale snapshot; other sources still count', () => {
	const app = appHarness();
	app.run('DB.training=[]');
	assert.equal(app.run('isPersonTrainedForStation(201,20)'), false);
	assert.equal(app.run('isPersonTrainedForStation(301,10)'), true);
	app.run('DB.training=[{personId:201,stationId:10}]; currentDayType=DayType.OvertimeDay');
	assert.equal(app.run('isPersonTrainedForStation(201,10)'), true);
	assert.equal(app.run('isPersonTrainedForStation(201,20)'), false);
});

test('standalone data without shiftData retains training support', () => {
	const app = appHarness();
	delete app.db.shiftData;
	assert.equal(app.run('isPersonTrainedForStation(201,20)'), true);
	assert.equal(app.run('isPersonTrainedForStation(301,10)'), false);
});

test('closed stations never contribute staffing; toggling retains assignments and refreshes metrics', () => {
	const app = appHarness();
	const assignmentsBefore = structuredClone(app.db.assignments);
	app.run('setStationOperational(20,true)');
	assert.deepEqual(app.json('[summary.totals.assigned,summary.totals.required,report.totals.understaffedStations]'), [3,4,1]);
	app.run('setStationOperational(20,false)');
	assert.deepEqual(app.json('[summary.totals.assigned,summary.totals.required,report.stationStats.length]'), [2,2,1]);
	assert.deepEqual(app.db.assignments, assignmentsBefore);
	assert.equal(app.run('rebuildCount'), 2);
	app.run('setStationOperational(20,false)');
	assert.equal(app.run('rebuildCount'), 2);
});

test('closed-station training, incompatible pairs, and rotation remain in rule metrics', () => {
	const data = fixture();
	data.input.assignments = [data.row(201,20,'w1'), data.row(301,20,'w1'), data.row(301,20,'w2')];
	data.input.compatibility = [{a:201,b:301}];
	const app = appHarness(data);
	const report = app.json('computeDerivedReportMetrics()');
	assert.equal(report.totals.untrainedAssignments, 2);
	assert.equal(report.totals.conflictCount, 2);
	assert.equal(report.nonoperationalAssignments.length, 3);
	assert.equal(report.totals.totalAssigned, 0);
	assert.equal(report.totals.understaffedStations, 1); // Only the empty operational station.
	const result = rules.evaluateSchedule(data.input);
	assert.equal(cellAt(result,20,'w1').capacityIssue, false);
	assert.equal(cellAt(result,20,'w1').overCapacity, false);
});

test('rotation skips multiple breaks and sort gaps, with one event per adjacent work pair', () => {
	const {input, row} = fixture();
	input.timeSlots.push({...input.timeSlots[0],id:'w3',sort:40});
	input.assignments.push(row(301,10,'w3'), row(301,10,'w2')); // Duplicate row is not another rotation event.
	const result = rules.evaluateSchedule(input);
	assert.equal(result.rotationEvents.length, 2);
	assert.equal(cellAt(result,10,'w2').rotationEvents.length, 1);
	assert.equal(cellAt(result,10,'w3').rotationEvents.length, 1);
	assert.equal(input.timeSlots[0].id, 'w1');
});

test('an empty intervening work period, another person, or another station is not a repeat', () => {
	const {input, row} = fixture();
	input.timeSlots.push({...input.timeSlots[0],id:'middle',sort:15});
	assert.equal(rules.evaluateSchedule(input).rotationEvents.length, 0);
	input.timeSlots = input.timeSlots.filter(slot=>slot.id!=='middle');
	input.assignments = [row(301,10,'w1'),row(201,10,'w2'),row(301,20,'w2')];
	assert.equal(rules.evaluateSchedule(input).rotationEvents.length, 0);
});

test('date, factory, day-type, and selected shift dataset isolate rotation', () => {
	const {input, row} = fixture();
	input.assignments = [row(301,10,'w1'),row(301,10,'w2',{date:'2026-11-12'}),
		row(301,10,'w2',{factoryId:2}),row(301,10,'w2',{dayType:'Night'})];
	assert.equal(rules.evaluateSchedule(input).rotationEvents.length, 0);
	const anotherShift = {...input, context:{...input.context,shift:'night'}, assignments:[row(301,10,'w2')]};
	assert.equal(rules.evaluateSchedule(anotherShift).rotationEvents.length, 0);
	assert.equal(rules.wouldRepeatStation(301,10,'w2',anotherShift.assignments,
		rules.getWorkSlots(input.timeSlots,input.context),anotherShift.context), false);
});

test('summary counts unique cells while reports count assignments and conflict events', () => {
	const data = fixture();
	data.input.stations[0].defaultCapacity = 3;
	data.input.assignments = ['w1','w2'].flatMap(slot=>[data.row(201,10,slot),data.row(101,10,slot),data.row(301,10,slot)]);
	data.input.compatibility = [{a:201,b:101},{a:201,b:301},{a:101,b:301}];
	data.sources.day.training = [];
	const app = appHarness(data);
	assert.deepEqual(app.json('(()=>{const s=computeSummaryMetrics(),r=computeDerivedReportMetrics();return [s.totals.trainingCells,r.totals.untrainedAssignments,s.totals.compatibilityCells,r.conflictDetails.filter(x=>x.type==="Samarbetsregel").length,s.totals.rotationCells,r.conflictDetails.filter(x=>x.type==="Samma station i rad").length,s.totals.affectedCells]})()'), [2,4,2,6,1,3,2]);
	app.run("summaryData=computeSummaryMetrics()");
	assert.equal(app.json('getSummaryMatches("rotation").length'), 1);
	assert.equal(app.json('getSummaryMatches("nonoperational").length'), 0);
});

test('break assignments remain warned but do not count coverage or rotation', () => {
	const {input, row} = fixture();
	input.assignments = [row(301,10,'b1')];
	const result = rules.evaluateSchedule(input);
	assert.equal(cellAt(result,10,'b1').capacityIssue, true);
	assert.equal(cellAt(result,10,'b1').coverageAssigned, 0);
	assert.deepEqual(result.coverage, {assigned:0,required:2});
	assert.equal(result.rotationEvents.length, 0);
});

test('zero-required coverage remains zero and operational overstaffing may exceed 100%', () => {
	const data = fixture();
	const app = appHarness(data);
	app.db.stations.forEach(station=>{station.operational=false;});
	assert.deepEqual(app.json('(()=>{const r=computeDerivedReportMetrics();return [r.totals.coveragePct,r.totals.totalRequired,r.totals.totalAssigned]})()'), [0,0,0]);
	app.db.stations[0].operational = true;
	app.db.assignments.push(data.row(101,10,'w1'));
	assert.equal(app.json('computeDerivedReportMetrics().totals.coveragePct'), 150);
});

test('full and partial validation agree after removing, adding, and moving assignments', () => {
	const app = appHarness();
	app.run('validateBoard()');
	for(const mutation of [
		"var removed=removeAssignmentsWhere(a=>a.personId===301 && a.timeSlotId==='w1'); var added=[];",
		"removed=[]; added=[addAssignmentRow({...DB.assignments[0],timeSlotId:'w1'})];",
		"removed=removeAssignmentsWhere(a=>a.personId===301 && a.timeSlotId==='w1'); added=[addAssignmentRow({...removed[0],stationId:20})];"
	]){
		app.run(mutation+'validateChangedCells(createAssignmentInvalidationSetFromDiff({added,removed}))');
		const partial = app.json('[...cellStates.entries()].sort()');
		const pills = app.json('[...pillStates.entries()].sort()');
		app.run('validateBoard()');
		assert.deepEqual(app.json('[...cellStates.entries()].sort()'), partial);
		assert.deepEqual(app.json('[...pillStates.entries()].sort()'), pills);
	}
});

test('undo and redo rebuild the same rotation findings and summary totals', () => {
	const app = appHarness();
	app.run('validateBoard()');
	const before = app.json('[...cellStates.entries()].sort()');
	app.run("withAssignmentHistoryAction('remove',()=>removeAssignmentsWhere(a=>a.personId===301 && a.timeSlotId==='w1')); rebuildAll()");
	assert.equal(app.run('summary.totals.rotationCells'), 0);
	app.run('undoAssignmentChange()');
	assert.deepEqual(app.json('[...cellStates.entries()].sort()'), before);
	app.run('redoAssignmentChange()');
	assert.equal(app.run('summary.totals.rotationCells'), 0);
});

test('partial validation ignores keys for another context', () => {
	const app = appHarness();
	app.run('validateBoard()');
	const before = app.json('[...cellStates.entries()].sort()');
	app.run("validateChangedCells([makeInvalidationKey({...getInvalidationContext(),date:'2000-01-01',slotId:'w2',stationId:10})])");
	assert.deepEqual(app.json('[...cellStates.entries()].sort()'), before);
});

test('board capacity uses assignment rows and double booking remains independent of closure', () => {
	const data = fixture();
	data.input.assignments.push(data.row(101,10,'w1'), data.row(301,20,'w1'));
	const app = appHarness(data);
	app.run('validateBoard()');
	assert.ok(app.json('cellStates.get("10:w1")').includes('invalid:Över kapacitet.'));
	for(const key of ['10:w1','20:w1']){
		assert.ok(app.json(`cellStates.get('${key}')`).includes('invalid:Samma person dubbelbokad i samma tid.'));
	}
	assert.ok(!app.json('cellStates.get("20:w1")').includes('invalid:Över kapacitet.'));
});

test('the existing night cutoff is retained without applying to overtime', () => {
	const app = appHarness();
	app.db.shiftData.night.persons[0].isNight = true;
	app.run('validateBoard()');
	assert.ok(!app.json('cellStates.get("10:w2")').some(message=>message.includes('cutoff')));
	app.run("currentShift='night';DB.persons=DB.shiftData.night.persons;DB.training=DB.shiftData.night.training;validateBoard()");
	assert.ok(app.json('cellStates.get("10:w2")').some(message=>message.includes('cutoff')));
	app.run('currentDayType=DayType.OvertimeDay;DB.timeSlots.forEach(s=>s.dayType=currentDayType);DB.assignments.forEach(a=>a.dayType=currentDayType);validateBoard()');
	assert.ok(!app.json('cellStates.get("10:w2")').some(message=>message.includes('cutoff')));
});

test('all generation entry points reject closed stations and breaks', () => {
	const app = appHarness();
	app.db.assignments = [];
	for(const [stationIndex,slotIndex] of [[1,0],[0,1]]){
		app.run(`var station=DB.stations[${stationIndex}], slot=DB.timeSlots[${slotIndex}];`);
		assert.equal(app.run('placeOneRandom(station,slot)'), null);
		assert.equal(app.run('fillCellByRandom(station,slot)'), 0);
		assert.equal(app.run('canPlace(DB.persons[0],station,slot,{},new Set(),new Map([[station.id,1]]))'), false);
		app.run('roundRobinFill([station],slot)');
		assert.equal(app.db.assignments.length, 0);
	}
});

test('runRandomizer excludes closed stations even if a stale selection includes them', () => {
	const app = appHarness();
	app.db.assignments = [];
	app.db.training.push({personId:201,stationId:10});
	app.sandbox.document.querySelectorAll = selector => {
		if(selector.startsWith('#randGroups')) return [{value:'1'}];
		if(selector.includes('data-kind="station"')) return [{value:'10'},{value:'20'}];
		return [];
	};
	app.sandbox.document.getElementById = id => id==='dateInput' ? {value:app.input.context.date} : {checked:id!=='avoidConsecutive'};
	app.sandbox.bootstrap = {Modal:{getInstance:()=>({hide(){}})}};
	app.run('runRandomizer()');
	assert.equal(app.db.assignments.length, 2);
	assert.ok(app.db.assignments.every(row=>row.stationId===10));
});

test('all generation paths check retained future work and honor the avoidance option', () => {
	for(const functionName of ['placeOneRandom','fillCellByRandom','roundRobinFill']){
		const data = fixture();
		data.sources.evening.training.push({personId:201,stationId:10});
		data.input.assignments = [data.row(201,10,'w2')];
		const app = appHarness(data);
		const target = functionName==='roundRobinFill' ? '[DB.stations[0]]' : 'DB.stations[0]';
		app.run(`${functionName}(${target},DB.timeSlots[0],{avoidConsecutive:true,_skipNextSlotReserve:true})`);
		assert.equal(app.db.assignments.length, 1, functionName);
		app.run(`${functionName}(${target},DB.timeSlots[0],{avoidConsecutive:false})`);
		assert.equal(app.db.assignments.length, 2, functionName);
		assert.equal(app.run('computeDerivedReportMetrics().totals.conflictCount'), 1);
	}
});

test('generation shares training overrides and Resurs exceptions', () => {
	const app = appHarness();
	app.db.assignments = [];
	app.run('var station=DB.stations[0],slot=DB.timeSlots[0],person=DB.persons[0],taken=new Set(),remaining=new Map([[10,1]])');
	assert.equal(app.run('canPlace(person,station,slot,{avoidConsecutive:false,requireTraining:true},taken,remaining)'), false);
	assert.equal(app.run('canPlace(person,station,slot,{avoidConsecutive:false,requireTraining:false},taken,remaining)'), true);
	app.db.stations[0].isResurs = true;
	assert.equal(app.run('isPersonAllowedFor(person,station,slot)'), true);
	assert.equal(app.run('isPersonAllowedFor(person,station,slot,{forceTrainingForResurs:true})'), false);
});

test('cross-shift qualifications are used by generation without widening its personnel pool', () => {
	const data = fixture();
	data.sources.night.persons.push({...data.sources.evening.persons[0]});
	data.sources.night.training.push({personId:201,stationId:10});
	data.input.assignments = [];
	const app = appHarness(data);
	app.run('roundRobinFill([DB.stations[0]],DB.timeSlots[0],{avoidConsecutive:false,requireTraining:true})');
	assert.equal(app.db.assignments.length, 1);
	assert.equal(app.db.assignments[0].personId, 201);
});

test('shared calculations do not mutate input data or training indexes', () => {
	const {input} = fixture();
	const before = structuredClone(input);
	rules.evaluateSchedule(input);
	rules.getAdjacentWorkSlots(rules.getWorkSlots(input.timeSlots,input.context),'w2');
	assert.deepEqual(input, before);
});

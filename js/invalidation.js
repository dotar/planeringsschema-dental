// Cell-level invalidation helpers for assignment mutations.

const PLANNING_INVALIDATION_KEY_SEPARATOR='|';

function getInvalidationContext(){
	return {
		date:getSelectedDateStr(),
		factoryId:currentFactoryId,
		dayType:currentDayType
	};
}

function makeInvalidationKey({date,factoryId,dayType,slotId,stationId}){
	return [date,factoryId,dayType,slotId,stationId]
		.map(v=>String(v ?? ''))
		.join(PLANNING_INVALIDATION_KEY_SEPARATOR);
}

function parseInvalidationKey(key){
	const [date,factoryId,dayType,slotId,stationId]=String(key).split(PLANNING_INVALIDATION_KEY_SEPARATOR);
	return {date,factoryId:parseEntityId(factoryId),dayType,slotId,stationId:parseEntityId(stationId)};
}

function makeCurrentCellInvalidationKey(slotId, stationId){
	return makeInvalidationKey({...getInvalidationContext(),slotId,stationId});
}

function getAssignmentInvalidationKey(row){
	if(!row) return '';
	return makeInvalidationKey({
		date:row.date,
		factoryId:row.factoryId,
		dayType:row.dayType,
		slotId:row.timeSlotId,
		stationId:row.stationId
	});
}

function getCurrentWorkSlots(){
	return DB.timeSlots
		.filter(ts=>ts.factoryId===currentFactoryId && ts.dayType===currentDayType && ts.type==='Work')
		.sort((a,b)=>a.sort-b.sort);
}

function getAdjacentWorkSlotIds(slotId){
	const slots=getCurrentWorkSlots();
	const idx=slots.findIndex(s=>String(s.id)===String(slotId));
	if(idx<0) return [];
	return [slots[idx-1]?.id, slots[idx+1]?.id].filter(v=>v!==undefined && v!==null);
}

function addCurrentCellKey(target, slotId, stationId){
	if(slotId===undefined || slotId===null || stationId===undefined || stationId===null) return;
	target.add(makeCurrentCellInvalidationKey(slotId, stationId));
}

function addCurrentSlotKeys(target, slotId){
	if(slotId===undefined || slotId===null) return;
	DB.stations
		.filter(s=>s.factoryId===currentFactoryId)
		.forEach(station=>addCurrentCellKey(target, slotId, station.id));
}

function createAssignmentInvalidationSet(rows=[]){
	const ctx=getInvalidationContext();
	const keys=new Set();
	const relevantRows=rows.filter(row=>
		row &&
		row.date===ctx.date &&
		String(row.factoryId)===String(ctx.factoryId) &&
		row.dayType===ctx.dayType
	);
	if(relevantRows.length===0) return keys;

	const currentRows=DB.assignments.filter(a=>
		a.date===ctx.date &&
		String(a.factoryId)===String(ctx.factoryId) &&
		a.dayType===ctx.dayType
	);

	for(const row of relevantRows){
		addCurrentCellKey(keys, row.timeSlotId, row.stationId);
		// Same-slot double booking can mark any cell in that slot, so invalidate the row.
		addCurrentSlotKeys(keys, row.timeSlotId);
		// Consecutive same person/station warnings depend on neighboring work slots.
		getAdjacentWorkSlotIds(row.timeSlotId).forEach(slotId=>addCurrentCellKey(keys, slotId, row.stationId));
		currentRows
			.filter(a=>String(a.personId)===String(row.personId) && String(a.stationId)===String(row.stationId))
			.forEach(a=>{
				addCurrentCellKey(keys, a.timeSlotId, a.stationId);
				getAdjacentWorkSlotIds(a.timeSlotId).forEach(slotId=>addCurrentCellKey(keys, slotId, a.stationId));
			});
	}
	return keys;
}

function createAssignmentInvalidationSetFromDiff({added=[],removed=[]}={}){
	return createAssignmentInvalidationSet([...added, ...removed]);
}

function runMeasured(label, fn){
	const t0=performance.now();
	try{
		return fn();
	}finally{
		const ms=performance.now()-t0;
		console.debug(`[perf] ${label}: ${ms.toFixed(2)}ms`);
	}
}

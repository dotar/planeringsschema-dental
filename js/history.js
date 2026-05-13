// Assignment history and undo/redo support.

function getAssignmentHistoryContextKey(){
	return JSON.stringify({
		factoryId:String(currentFactoryId),
		date:getSelectedDateStr(),
		dayType:String(currentDayType),
		shift:String(currentShift)
	});
}

function getAssignmentRowKey(row){
	if(!row) return '';
	return [
		String(row.date ?? ''),
		String(row.factoryId ?? ''),
		String(row.dayType ?? ''),
		String(row.timeSlotId ?? ''),
		String(row.stationId ?? ''),
		String(row.personId ?? '')
	].join('|');
}

function cloneAssignmentRow(row){
	if(!row) return null;
	return {
		date:row.date,
		factoryId:row.factoryId,
		dayType:row.dayType,
		timeSlotId:row.timeSlotId,
		groupId:row.groupId ?? null,
		stationId:row.stationId,
		personId:row.personId
	};
}

function recordAssignmentDiff(kind,row){
	if(!assignmentHistoryBatch || assignmentHistoryIsReplaying) return;
	const cloned=cloneAssignmentRow(row);
	if(!cloned) return;
	const key=getAssignmentRowKey(cloned);
	const inverseList=kind==='added' ? assignmentHistoryBatch.removed : assignmentHistoryBatch.added;
	const inverseIndex=inverseList.findIndex(x=>getAssignmentRowKey(x)===key);
	if(inverseIndex>=0){
		inverseList.splice(inverseIndex,1);
		return;
	}
	assignmentHistoryBatch[kind].push(cloned);
}

function addAssignmentRow(row,{record=true}={}){
	const cloned=cloneAssignmentRow(row);
	if(!cloned) return;
	DB.assignments.push(cloned);
	if(record) recordAssignmentDiff('added', cloned);
}

function removeAssignmentsWhere(predicate,{record=true}={}){
	const removed=[];
	const kept=[];
	for(const row of DB.assignments){
		if(predicate(row)){
			removed.push(row);
		}else{
			kept.push(row);
		}
	}
	DB.assignments=kept;
	if(record){
		removed.forEach(row=>recordAssignmentDiff('removed', row));
	}
	return removed;
}

function withAssignmentHistoryAction(label, fn){
	if(assignmentHistoryIsReplaying){
		fn();
		return;
	}
	if(assignmentHistoryBatch){
		fn();
		return;
	}
	const batch={label:String(label||'Ändring'),contextKey:getAssignmentHistoryContextKey(),added:[],removed:[]};
	assignmentHistoryBatch=batch;
	try{
		fn();
	}finally{
		assignmentHistoryBatch=null;
	}
	if(batch.added.length===0 && batch.removed.length===0){
		syncAssignmentHistoryUi();
		return;
	}
	assignmentHistoryUndoStack.push(batch);
	assignmentHistoryRedoStack.length=0;
	syncAssignmentHistoryUi();
}

function applyAssignmentHistoryBatch(batch,{direction}={}){
	if(!batch) return;
	const redo=direction==='redo';
	assignmentHistoryIsReplaying=true;
	try{
		if(redo){
			batch.removed.forEach(row=>{
				removeAssignmentsWhere(a=>getAssignmentRowKey(a)===getAssignmentRowKey(row),{record:false});
			});
			batch.added.forEach(row=>addAssignmentRow(row,{record:false}));
		}else{
			batch.added.forEach(row=>{
				removeAssignmentsWhere(a=>getAssignmentRowKey(a)===getAssignmentRowKey(row),{record:false});
			});
			batch.removed.forEach(row=>addAssignmentRow(row,{record:false}));
		}
	}finally{
		assignmentHistoryIsReplaying=false;
	}
	rebuildAll();
}

function resetAssignmentHistory(){
	assignmentHistoryUndoStack.length=0;
	assignmentHistoryRedoStack.length=0;
	assignmentHistoryBatch=null;
	syncAssignmentHistoryUi();
}

function undoAssignmentChange(){
	if(mode!=='edit' || assignmentHistoryUndoStack.length===0) return;
	const batch=assignmentHistoryUndoStack.pop();
	if(batch.contextKey!==getAssignmentHistoryContextKey()){
		resetAssignmentHistory();
		return;
	}
	assignmentHistoryRedoStack.push(batch);
	applyAssignmentHistoryBatch(batch,{direction:'undo'});
	syncAssignmentHistoryUi();
}

function redoAssignmentChange(){
	if(mode!=='edit' || assignmentHistoryRedoStack.length===0) return;
	const batch=assignmentHistoryRedoStack.pop();
	if(batch.contextKey!==getAssignmentHistoryContextKey()){
		resetAssignmentHistory();
		return;
	}
	assignmentHistoryUndoStack.push(batch);
	applyAssignmentHistoryBatch(batch,{direction:'redo'});
	syncAssignmentHistoryUi();
}

function syncAssignmentHistoryUi(){
	const undoBtn=document.getElementById('undoBtn');
	const redoBtn=document.getElementById('redoBtn');
	if(undoBtn) undoBtn.disabled=(mode!=='edit' || assignmentHistoryUndoStack.length===0);
	if(redoBtn) redoBtn.disabled=(mode!=='edit' || assignmentHistoryRedoStack.length===0);
}

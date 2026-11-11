// Shared, DOM-independent scheduling rules. Callers supply one shift's assignments.
const SchedulingCalculations = (() => {
	const id = value => String(value);
	const cellKey = (stationId, slotId) => JSON.stringify([id(stationId), id(slotId)]);

	function buildTrainingIndex(sources, stations){
		const stationIds = new Set(stations.map(station => id(station.id)));
		const index = new Map();
		for(const source of sources){
			const personIds = new Set((source.persons || []).map(person => id(person.id)));
			for(const row of source.training || []){
				if(!personIds.has(id(row.personId)) || !stationIds.has(id(row.stationId))) continue;
				const trained = index.get(id(row.personId)) || new Set();
				trained.add(id(row.stationId));
				index.set(id(row.personId), trained);
			}
		}
		return index;
	}

	function isTrained(index, personId, stationId){
		return index.get(id(personId))?.has(id(stationId)) || false;
	}

	function getSlots(timeSlots, context){
		return timeSlots.filter(slot => id(slot.factoryId) === id(context.factoryId) && slot.dayType === context.dayType)
			.sort((a, b) => a.sort - b.sort);
	}

	function getWorkSlots(timeSlots, context){
		return getSlots(timeSlots, context).filter(slot => slot.type === 'Work');
	}

	function getAdjacentWorkSlots(workSlots, slotId){
		const index = workSlots.findIndex(slot => id(slot.id) === id(slotId));
		return index < 0 ? {previous:null, next:null} : {
			previous:workSlots[index - 1] || null,
			next:workSlots[index + 1] || null
		};
	}

	function getStationCapacity(station){
		// Match the existing capacity editor: positive integers, defaulting to one.
		return Math.max(1, parseInt(station.defaultCapacity, 10) || 1);
	}

	function getRequiredStaffing(station, slot){
		return station.operational !== false && slot.type === 'Work' ? getStationCapacity(station) : 0;
	}

	function filterAssignments(assignments, context){
		// Shift is represented by the supplied dataset, not an assignment-row field.
		return assignments.filter(row => row.date === context.date &&
			id(row.factoryId) === id(context.factoryId) && row.dayType === context.dayType);
	}

	function findRotationEvents(assignments, workSlots, context){
		const byPersonStation = new Map();
		for(const row of filterAssignments(assignments, context)){
			const key = JSON.stringify([id(row.personId), id(row.stationId)]);
			const bySlot = byPersonStation.get(key) || new Map();
			bySlot.set(id(row.timeSlotId), row);
			byPersonStation.set(key, bySlot);
		}
		const events = [];
		for(const bySlot of byPersonStation.values()){
			for(let i = 1; i < workSlots.length; i++){
				const previousSlot = workSlots[i - 1], slot = workSlots[i];
				const previousAssignment = bySlot.get(id(previousSlot.id));
				const assignment = bySlot.get(id(slot.id));
				if(previousAssignment && assignment){
					events.push({personId:assignment.personId, stationId:assignment.stationId,
						previousSlot, slot, previousAssignment, assignment});
				}
			}
		}
		return events;
	}

	function wouldRepeatStation(personId, stationId, slotId, assignments, workSlots, context){
		const {previous, next} = getAdjacentWorkSlots(workSlots, slotId);
		const adjacentIds = new Set([previous, next].filter(Boolean).map(slot => id(slot.id)));
		return filterAssignments(assignments, context).some(row => id(row.personId) === id(personId) &&
			id(row.stationId) === id(stationId) && adjacentIds.has(id(row.timeSlotId)));
	}

	function evaluateSchedule({context, stations, timeSlots, assignments, persons, trainingIndex, compatibility}){
		const slots = getSlots(timeSlots, context);
		const workSlots = slots.filter(slot => slot.type === 'Work');
		const scopedStations = stations.filter(station => id(station.factoryId) === id(context.factoryId));
		const stationById = new Map(scopedStations.map(station => [id(station.id), station]));
		const slotById = new Map(slots.map(slot => [id(slot.id), slot]));
		const personById = new Map(persons.map(person => [id(person.id), person]));
		const rows = filterAssignments(assignments, context).filter(row =>
			stationById.has(id(row.stationId)) && slotById.has(id(row.timeSlotId)));
		const byCell = new Map();
		for(const row of rows){
			const key = cellKey(row.stationId, row.timeSlotId);
			const list = byCell.get(key) || [];
			list.push(row);
			byCell.set(key, list);
		}
		const rotationEvents = findRotationEvents(rows, workSlots, context);
		const rotationsByCell = new Map();
		for(const event of rotationEvents){
			const key = cellKey(event.stationId, event.slot.id);
			const events = rotationsByCell.get(key) || [];
			events.push(event);
			rotationsByCell.set(key, events);
		}
		const incompatible = new Set();
		for(const pair of compatibility){
			incompatible.add(JSON.stringify([id(pair.a), id(pair.b)]));
			incompatible.add(JSON.stringify([id(pair.b), id(pair.a)]));
		}
		const cells = [];
		const coverage = {assigned:0, required:0};
		for(const slot of slots){
			for(const station of scopedStations){
				const key = cellKey(station.id, slot.id);
				const assignedRows = byCell.get(key) || [];
				const assigned = assignedRows.length;
				const required = getRequiredStaffing(station, slot);
				const operational = station.operational !== false;
				const coverageEligible = operational && slot.type === 'Work';
				const untrainedRows = assignedRows.filter(row => !isTrained(trainingIndex, row.personId, station.id));
				const absentRows = assignedRows.filter(row => {
					const person = personById.get(id(row.personId));
					return person && !person.present;
				});
				const compatibilityPairs = [];
				for(let i = 0; i < assigned; i++){
					for(let j = i + 1; j < assigned; j++){
						if(incompatible.has(JSON.stringify([id(assignedRows[i].personId), id(assignedRows[j].personId)]))){
							compatibilityPairs.push([assignedRows[i].personId, assignedRows[j].personId]);
						}
					}
				}
				const cell = {station, slot, assignedRows, assigned, required, coverageEligible,
					coverageAssigned:coverageEligible ? assigned : 0, untrainedRows, absentRows, compatibilityPairs,
					rotationEvents:rotationsByCell.get(key) || [],
					understaffed:coverageEligible && assigned < required,
					overCapacity:operational && assigned > getStationCapacity(station),
					// Retain summary warnings for stray break assignments, without counting coverage.
					capacityIssue:operational && assigned !== required,
					nonoperationalIssue:!operational && assigned > 0};
				cells.push(cell);
				coverage.assigned += cell.coverageAssigned;
				coverage.required += required;
			}
		}
		const nonoperationalAssignments = rows.filter(row => stationById.get(id(row.stationId)).operational === false);
		return {context, slots, workSlots, stations:scopedStations, stationById, slotById, personById,
			rows, cells, coverage, rotationEvents, nonoperationalAssignments};
	}

	return {buildTrainingIndex, isTrained, getWorkSlots, getAdjacentWorkSlots, getStationCapacity,
		getRequiredStaffing, filterAssignments, findRotationEvents, wouldRepeatStation, evaluateSchedule};
})();

if(typeof module !== 'undefined' && module.exports){
	module.exports = SchedulingCalculations;
}

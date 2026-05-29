// Settings panels, editors, and settings-table drag helpers.
function renderSettingsInfoTexts(){
	const factoryTitle=getCurrentFactoryTitle();
	const shiftTitle=capitalizeFirst(shiftLabel(currentShift));
	const withIcon=(text)=>`<i class="bi bi-info-circle-fill"></i> ${text}`;

	const personnel=document.getElementById('personnelInfoText');
	if(personnel) personnel.innerHTML=withIcon(`Dra för att flytta personer mellan grupper i ${factoryTitle} ${shiftTitle}`);

	const groups=document.getElementById('groupsInfoText');
	if(groups) groups.innerHTML=withIcon(`Dra för att ändra kolumnordningen för grupper i ${factoryTitle} ${shiftTitle}`);

	const stations=document.getElementById('stationsInfoText');
	if(stations) stations.innerHTML=withIcon(`Dra för att ändra kolumnordningen för stationer inom en grupp i ${factoryTitle}`);

	const slots=document.getElementById('slotsInfoText');
	if(slots) slots.innerHTML=withIcon(`Dra rader för att sortera tidsintervaller i ${factoryTitle} ${shiftTitle}. Använd format <strong>HH:MM</strong>.`);
}

function renderSettings(){syncInactivitySettingInput();syncViewerShiftLeadSettingInput();syncViewerEditSettingInput();syncViewerWarningsSettingInput();syncCoordAutoLogoutInput();renderSettingsInfoTexts();renderPersonGroups();renderGroupTable();renderStationsByGroup();renderSlotEditor();renderConstraintTable();}

function renderPersonGroups(){
	const wrap = document.getElementById('personGroupsWrap');
	wrap.innerHTML = '';
	const order = getNormalizedGroupOrder(currentFactoryId);
	const groupsOrdered = order.filter(tok=>tok!=='resurs' && !isResursGroupId(tok)).map(id=>DB.groups.find(x=>x.id===id));

	for(const g of groupsOrdered){
		const card = document.createElement('div');
		card.className = 'card shadow-sm';

		card.innerHTML = `
			<div class="card-header d-flex justify-content-between align-items-center"
				 style="background:${g.color}; color:${contrastColor(g.color)}">
				<strong>${escapeHtml(g.title)}</strong>
				<button class="btn btn-sm btn-light" data-action="add" data-group="${g.id}">
					<i class="bi bi-plus"></i> Lägg till person
				</button>
			</div>
			<div class="card-body p-0">
				<table class="table table-sm align-middle mb-0">
					<thead>
						<tr>
							<th style="width:2.5%"></th>
							<th style="width:22%">Namn</th>
							<th style="width:18%">Grupp</th>
							<th style="width:12%"><span class="d-inline-flex align-items-center gap-1">Närvarande <button type="button" class="settings-info-btn summary-info-btn small fw-semibold" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-custom-class="info-tooltip" data-bs-html="true" data-bs-title="<strong>Aktiverad:</strong> Personen kan användas i planeringen.<br><strong>Avaktiverad:</strong> Personen räknas som frånvarande och kan inte tilldelas."><i class="bi bi-info-circle-fill" aria-hidden="true"></i><span class="visually-hidden">Info om Närvarande</span></button></span></th>
							<th style="width:12%"><span class="d-inline-flex align-items-center gap-1">Utbildning <button type="button" class="settings-info-btn summary-info-btn small fw-semibold" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-custom-class="info-tooltip" data-bs-html="true" data-bs-title="Öppnar och redigerar personens utbildningar per station"><i class="bi bi-info-circle-fill" aria-hidden="true"></i><span class="visually-hidden">Info om Utbildning</span></button></span></th>
							<th style="width:10%"></th>
						</tr>
					</thead>
					<tbody id="pg-${g.id}" class="person-drop-target"></tbody>
				</table>
			</div>
		`;
		wrap.appendChild(card);

		const tb = card.querySelector('tbody');

		// keep stable visual order via p.sort, fallback by name
		const people = DB.persons
			.filter(p=>p.factoryId===currentFactoryId && p.groupId===g.id)
			.slice()
			.sort((a,b)=>{
				const sa=(typeof a.sort==='number')?a.sort:9999;
				const sb=(typeof b.sort==='number')?b.sort:9999;
				return (sa-sb) || a.name.localeCompare(b.name);
			});

		for(const p of people){
			const tr = document.createElement('tr');
			tr.draggable = true;
			tr.dataset.id = p.id;

			// row HTML: make first cell use the tighter grip col
			tr.innerHTML=`
				<td class="text-muted grip-col"><i class="bi bi-grip-vertical drag-handle"></i></td>
				<td><input class="form-control form-control-sm" value="${escapeHtml(p.name)}" data-bind="name" data-id="${p.id}"></td>
				<td>${groupSelect(p.groupId, p.id)}</td>
				<td><input type="checkbox" ${p.present?'checked':''} data-bind="present" data-id="${p.id}"></td>
				<td><button class="btn btn-sm btn-outline-secondary" data-action="training" data-id="${p.id}"><i class="bi bi-1-circle"></i></button></td>
				<td><button class="btn btn-sm btn-outline-danger" data-action="del" data-id="${p.id}"><i class="bi bi-trash"></i></button></td>
			`;

			tr.draggable=true;
			tr.addEventListener('dragstart', ()=>{
				draggingPersonRowId=p.id;
				dragSourceGroupId=p.groupId;
			});
			tr.addEventListener('dragend', ()=>{
				draggingPersonRowId=null;
				dragSourceGroupId=null;
			});


			tb.appendChild(tr);
		}

		// reorder inside the same group
		enableRowDrag(tb, (orderIds)=>{
			orderIds.forEach((id, idx)=>{
				const person = DB.persons.find(x=>String(x.id)===String(id));
				if(person && person.groupId===g.id) person.sort = idx+1;
			});
			renderPersonGroups(); rebuildAll();
		});

		// allow moving INTO this group's list
		enablePersonCrossDrop(tb, g.id);
	}

	// bindings
	wrap.querySelectorAll('input[data-bind], select[data-bind]').forEach(el=>{
		el.addEventListener('change', ()=>{
			const id = parseEntityId(el.dataset.id);
			const p = DB.persons.find(x=>x.id===id);
			if(!p) return;
			if(el.dataset.bind==='name'){
				p.name = el.value.trim();
				rebuildAll();
			}
			if(el.dataset.bind==='present'){
				p.present = el.checked;
				rebuildAll();
			}
			if(el.dataset.bind==='groupId'){
				const newG = parseEntityId(el.value);
				if(p.groupId!==newG){
					p.groupId = newG;
					const maxSort = Math.max(0, ...DB.persons
						.filter(x=>x.factoryId===currentFactoryId && x.groupId===newG && typeof x.sort==='number')
						.map(x=>x.sort||0));
					p.sort = maxSort + 1;
					renderPersonGroups(); rebuildAll();
				}
			}
		});
	});
	wrap.querySelectorAll('button[data-action="training"]').forEach(b=>
		b.addEventListener('click',()=>editTraining(parseEntityId(b.dataset.id)))
	);
	wrap.querySelectorAll('button[data-action="del"]').forEach(b=>
		b.addEventListener('click',()=>{
			const id = parseEntityId(b.dataset.id);
			DB.persons = DB.persons.filter(p=>p.id!==id);
			renderPersonGroups(); rebuildAll();
		})
	);
	wrap.querySelectorAll('button[data-action="add"]').forEach(b=>
		b.addEventListener('click',()=>{
			const gid = parseEntityId(b.dataset.group);
			const id  = newId();
			const maxSort = Math.max(0, ...DB.persons
				.filter(x=>x.factoryId===currentFactoryId && x.groupId===gid && typeof x.sort==='number')
				.map(x=>x.sort||0));
			DB.persons.push({ id, name:'Ny', factoryId:currentFactoryId, groupId:gid, isNight:(currentShift==='night'), present:true, sort:maxSort+1 });
			renderPersonGroups();
			const inp = document.querySelector(`input[data-bind="name"][data-id="${escapeDataId(id)}"]`);
			if(inp){ inp.focus(); inp.select(); }
		})
	);
}


function groupSelect(val,bindId){
	const order=getNormalizedGroupOrder(currentFactoryId);
	const opts=order.filter(tok=>tok!=='resurs' && !isResursGroupId(tok)).map(id=>DB.groups.find(x=>x.id===id)).filter(Boolean).map(g=>`<option value="${g.id}" ${g.id===val?'selected':''}>${escapeHtml(g.title)}</option>`).join('');
	return `<select class="form-select form-select-sm" data-bind="groupId" data-id="${bindId}">${opts}</select>`;
}

function renderGroupTable(){
	const tb=document.getElementById('groupTable');
	tb.innerHTML='';
	const order=getNormalizedGroupOrder(currentFactoryId);
	for(const tok of order){
		if(tok==='resurs'){
			const tr=document.createElement('tr');tr.draggable=true;tr.dataset.key='resurs';
			tr.innerHTML=`<td class="text-muted"><i class="bi bi-grip-vertical drag-handle"></i></td><td><span class="badge text-bg-info">Resurs</span></td><td class="text-muted">—</td><td class="text-muted">—</td><td><button class="btn btn-sm btn-outline-danger" data-action="delLegacyResurs"><i class="bi bi-trash"></i></button></td>`;
			tb.appendChild(tr);continue;
		}
		const g=DB.groups.find(x=>x.id===tok);
		if(!g) continue;
		const tr=document.createElement('tr');tr.draggable=true;tr.dataset.key=String(g.id);
		if(isResursGroup(g)){
			tr.innerHTML=`<td class="text-muted"><i class="bi bi-grip-vertical drag-handle"></i></td><td><span class="badge text-bg-info">Resurs</span></td><td class="text-muted">—</td><td class="text-muted">—</td><td><button class="btn btn-sm btn-outline-danger" data-id="${g.id}"><i class="bi bi-trash"></i></button></td>`;
		}else{
			tr.innerHTML=`<td class="text-muted"><i class="bi bi-grip-vertical drag-handle"></i></td><td><input class="form-control form-control-sm" value="${escapeHtml(g.title)}" data-bind="title" data-id="${g.id}"></td><td><input type="color" class="form-control form-control-color" value="${g.color}" data-bind="color" data-id="${g.id}"></td><td><input class="form-control form-control-sm" value="${escapeHtml(g.coordinator||'')}" data-bind="coord" data-id="${g.id}"></td><td><button class="btn btn-sm btn-outline-danger" data-id="${g.id}"><i class="bi bi-trash"></i></button></td>`;
		}
		tb.appendChild(tr);
	}
	enableRowDragKeys(tb,(orderKeys)=>{
		DB.groupDisplayOrder[currentFactoryId]=orderKeys.map(k=>k==='resurs'?'resurs':parseEntityId(k));
		renderGroupTable();renderStationsByGroup();rebuildAll();
	});
	tb.querySelectorAll('input[data-bind]').forEach(el=>{
		el.addEventListener('change',()=>{
			const id=parseEntityId(el.dataset.id);
			const g=DB.groups.find(x=>x.id===id);
			if(el.dataset.bind==='title') g.title=el.value.trim();
			if(el.dataset.bind==='color') g.color=el.value;
			if(el.dataset.bind==='coord') g.coordinator=el.value.trim();
			rebuildAll();
		});
	});
	document.getElementById('addGroupBtn').onclick=()=>{
		const id=newId();
		DB.groups.push({id,factoryId:currentFactoryId,title:'Ny grupp',color:'#dddddd',coordinator:''});
		const cur=DB.groupDisplayOrder[currentFactoryId]||[];
		DB.groupDisplayOrder[currentFactoryId]=[...cur,id];
		renderGroupTable();renderStationsByGroup();rebuildAll();
		const inp=document.querySelector(`input[data-bind="title"][data-id="${escapeDataId(id)}"]`);
		if(inp){inp.focus();inp.select();}
	};
	const addResursGroupBtn=document.getElementById('addResursGroupBtn');
	if(addResursGroupBtn) addResursGroupBtn.onclick=()=>{
		const groupId=newId();
		const stationId=newId();
		DB.groups.push({id:groupId,factoryId:currentFactoryId,title:'Resurs',color:'#d1ecf1',coordinator:'',isResursGroup:true});
		DB.stations.push({id:stationId,factoryId:currentFactoryId,groupId:groupId,title:'Resurs',defaultCapacity:1,operational:true,sort:1,isResurs:true});
		const cur=DB.groupDisplayOrder[currentFactoryId]||[];
		DB.groupDisplayOrder[currentFactoryId]=[...cur,groupId];
		renderGroupTable();renderStationsByGroup();rebuildAll();
	};

	tb.querySelectorAll('button[data-action="delLegacyResurs"]').forEach(b => b.addEventListener('click', async () => {
		const station = getResursStationForToken(currentFactoryId, 'resurs');
		if(!station) return;
		const ok = await showConfirm({
			title: 'Ta bort resursgrupp',
			message: 'Ta bort resursgruppen “Resurs”?',
			sub: 'Resursstationen och dess planeringar tas också bort.',
			okText: 'Ta bort resursgrupp',
			okClass: 'btn-danger'
		});
		if(!ok) return;
		DB.assignments = DB.assignments.filter(a => a.stationId !== station.id);
		DB.training = DB.training.filter(t => t.stationId !== station.id);
		DB.stations = DB.stations.filter(s => s.id !== station.id);
		DB.groupDisplayOrder[currentFactoryId] = (DB.groupDisplayOrder[currentFactoryId] || []).filter(tok => tok !== 'resurs');
		renderGroupTable();
		renderStationsByGroup();
		rebuildAll();
	}));

	tb.querySelectorAll('button.btn-outline-danger:not([data-action])').forEach(b => b.addEventListener('click', async () => {
		const id = parseEntityId(b.dataset.id);
		const g = DB.groups.find(x => x.id === id);

		// what will be removed
		const isResursGroupRow = isResursGroup(g);
		const stationsIn = DB.stations.filter(s => s.factoryId === currentFactoryId && s.groupId === id && (isResursGroupRow ? s.isResurs : true));
		const personsIn  = isResursGroupRow ? [] : DB.persons.filter(p => p.factoryId === currentFactoryId && p.groupId === id);

		const ok = await showConfirm({
			title: 'Ta bort grupp',
			message: `Ta bort gruppen “${g ? g.title : ''}”?`,
			sub: isResursGroupRow ? 'Resursstationen och dess planeringar tas också bort.' : `<b class="text-danger">${stationsIn.length} stationer</b> och <b class="text-danger">${personsIn.length} personer</b> i gruppen tas också bort, inklusive deras planeringar och utbildningskopplingar.`,
			okText: 'Ta bort grupp',
			okClass: 'btn-danger'
		});
		if(!ok) return;

		// collect ids for cleanup
		const stationIds = new Set(stationsIn.map(s => s.id));
		const personIds  = new Set(personsIn.map(p => p.id));

		// remove assignments & training that reference them
		DB.assignments = DB.assignments.filter(a => !(stationIds.has(a.stationId) || personIds.has(a.personId)));
		DB.training    = DB.training.filter(t => !(stationIds.has(t.stationId) || personIds.has(t.personId)));

		// remove stations & persons
		DB.stations = DB.stations.filter(s => !stationIds.has(s.id));
		DB.persons  = DB.persons.filter(p => !personIds.has(p.id));

		// finally remove the group and from the display order
		DB.groups = DB.groups.filter(gr => gr.id !== id);
		DB.groupDisplayOrder[currentFactoryId] =
			(DB.groupDisplayOrder[currentFactoryId] || []).filter(tok => tok === 'resurs' || tok !== id);

		// refresh all affected UIs (this also fixes the stale "Personal" card)
		renderGroupTable();
		renderStationsByGroup();
		renderPersonGroups();
		rebuildAll();
	}));


}

function renderStationsByGroup(){
	const wrap = document.getElementById('stationsByGroup');
	wrap.innerHTML = '';
	const { order } = orderedColumns();
	for (const tok of order) {
		const isRes = isResursOrderToken(tok);
		const isLegacyRes = (tok === 'resurs');
		const g = DB.groups.find(x => x.id === tok);
		const title = isRes ? 'Resurs' : (g || {}).title;
		const resursStation = isRes ? getResursStationForToken(currentFactoryId, tok) : null;
		if(resursStation){ resursStation.isResurs=true; }
		const stations = isRes ? (resursStation ? [resursStation] : []) : DB.stations.filter(s => s.factoryId === currentFactoryId && s.groupId === tok).sort((a, b) => a.sort - b.sort);
		const card = document.createElement('div');
		card.className = 'card';
		const headerStyle = !isRes && g ? `style="background:${g.color};color:${contrastColor(g.color)}"` : '';
		const addStationButton = isRes ? '' : `<div class="d-flex gap-2"><button class="btn btn-sm btn-light" data-action="addStation" data-resurs="0" data-group="${tok}"><i class="bi bi-plus"></i> Lägg till station</button><button class="btn btn-sm btn-light" data-action="addStation" data-resurs="1" data-group="${tok}"><i class="bi bi-plus"></i> Lägg till resursstation</button></div>`;
		card.innerHTML = `<div class="card-header d-flex justify-content-between align-items-center" ${headerStyle}>
			<div><strong>${escapeHtml(title)}</strong></div>
			${addStationButton}
		</div>
		<div class="card-body p-0"><table class="table table-sm align-middle mb-0">
			<thead><tr><th style="width:32px"></th><th>Namn</th><th>Kapacitet</th><th><span class="d-inline-flex align-items-center gap-1">Operativ <button type="button" class="settings-info-btn summary-info-btn small fw-semibold" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-custom-class="info-tooltip" data-bs-html="true" data-bs-title="<strong>Aktiverad:</strong> Stationen kan väljas och fyllas vid autogenerering.<br><strong>Avaktiverad:</strong> Stationen exkluderas från autogenerering."><i class="bi bi-info-circle-fill" aria-hidden="true"></i><span class="visually-hidden">Info om Operativ</span></button></span></th><th></th></tr></thead>
			<tbody></tbody></table></div>`;
		const tb=card.querySelector('tbody');
		stations.forEach(s=>{
			const tr=document.createElement('tr');tr.draggable=!isRes;tr.dataset.id=s.id;
			const nameCell = `<div class="d-flex align-items-center gap-2"><input class="form-control form-control-sm" value="${escapeHtml(s.title)}" data-bind="title" data-id="${s.id}">${s.isResurs ? '<span class="badge text-bg-info">Resurs</span>' : ''}</div>`;
			const opCell = `<input type="checkbox" ${s.operational?'checked':''} data-bind="op" data-role="station-op" data-station-id="${s.id}" data-id="${s.id}">`;
			const deleteCell = isRes ? '<span class="text-muted">—</span>' : `<button class="btn btn-sm btn-outline-danger" data-id="${s.id}"><i class="bi bi-trash"></i></button>`;
			tr.innerHTML = `
				<td class="text-muted">${isRes ? '' : '<i class="bi bi-grip-vertical drag-handle"></i>'}</td>
				<td>${nameCell}</td>
				<td style="width:110px"><input type="number" min="0" class="form-control form-control-sm" value="${s.defaultCapacity||1}" data-bind="defcap" data-id="${s.id}"></td>
				<td>${opCell}</td>
				<td>${deleteCell}</td>
			`;

			tb.appendChild(tr);
		});
		wrap.appendChild(card);
		enableRowDrag(tb, (order)=>{
			order.forEach((id, idx)=>{
				const s=DB.stations.find(x=>String(x.id)===String(id));	// <- compare as strings
				s.sort=idx+1;
			});
			renderStationsByGroup();
			rebuildAll();
		});

		tb.querySelectorAll('input[data-bind]').forEach(el=>{
			el.addEventListener('change',()=>{
				const id=parseEntityId(el.dataset.id);
				const s=DB.stations.find(x=>x.id===id);
				if(el.dataset.bind==='title') s.title=el.value.trim();
				if(el.dataset.bind==='defcap') s.defaultCapacity=parseInt(el.value,10)||1;
				if(el.dataset.bind==='op') s.operational=el.checked;
				if(el.dataset.bind==='resurs') s.isResurs=el.checked;
				rebuildAll();
			});
		});
		card.querySelectorAll('[data-action="addStation"]').forEach(addStationBtn=>addStationBtn.addEventListener('click',()=>{
			const id=newId();
			const isResursStation=addStationBtn.dataset.resurs==='1';
			DB.stations.push({id,factoryId:currentFactoryId,groupId:tok,title:isResursStation?'Resurs':'Ny station',defaultCapacity:1,operational:true,sort:99,isResurs:isResursStation});
			renderStationsByGroup();rebuildAll();
			const inp=document.querySelector(`input[data-bind="title"][data-id="${escapeDataId(id)}"]`);
			if(inp){inp.focus();inp.select();}
		}));
		card.querySelectorAll('button.btn-outline-danger').forEach(b=>b.addEventListener('click',async()=>{
			const id=parseEntityId(b.dataset.id);
			const s=DB.stations.find(x=>x.id===id);
			const ok=await showConfirm({
				title:'Ta bort station',
				message:`Ta bort stationen “${s ? s.title : ''}”?`,
				sub: `Planeringar för stationen tas också bort.`,
				okText:'Ta bort station',
				okClass:'btn-danger'
			});
			if(!ok) return;
			DB.stations=DB.stations.filter(s=>s.id!==id);
			renderStationsByGroup(); rebuildAll();
		}));

	}
}

function renderSlotEditor(){
	const wrap=document.getElementById('slotEditor');
	wrap.innerHTML='';
	const dayTypes=currentShift==='day'?[DayType.Day,DayType.OvertimeDay]:(currentShift==='evening'?[DayType.EveningMonThu,DayType.EveningFri,DayType.OvertimeDay]:[DayType.Night,DayType.OvertimeDay]);
	dayTypes.forEach(dt=>{
		const div=document.createElement('div');
		div.className='mb-3';
		div.innerHTML=`<h6 class="mt-3">${labelFor(dt)}</h6>`;
		const tbl=document.createElement('table');
		tbl.className='table table-sm align-middle';
		tbl.innerHTML='<thead><tr><th style="width:32px"></th><th>Start (HH:MM)</th><th>Slut (HH:MM)</th><th>Typ</th><th></th></tr></thead><tbody></tbody>';
		const body=tbl.querySelector('tbody');
		for(const s of DB.timeSlots.filter(x=>x.factoryId===currentFactoryId&&x.dayType===dt).sort((a,b)=>a.sort-b.sort)){
			const tr=document.createElement('tr');tr.draggable=true;tr.dataset.id=s.id;
			tr.innerHTML=`<td class="text-muted"><i class="bi bi-grip-vertical drag-handle"></i></td><td><input type="text" inputmode="numeric" pattern="^\\d{2}:\\d{2}$" placeholder="hh:mm" class="form-control form-control-sm t24" value="${s.start}" data-bind="start" data-id="${s.id}"></td><td><input type="text" inputmode="numeric" pattern="^\\d{2}:\\d{2}$" placeholder="hh:mm" class="form-control form-control-sm t24" value="${s.end}" data-bind="end" data-id="${s.id}"></td><td><select data-bind="type" data-id="${s.id}" class="form-select form-select-sm"><option value="Work" ${s.type==='Work'?'selected':''}>Arbete</option><option value="Break" ${s.type==='Break'?'selected':''}>Rast</option></select></td><td><button class="btn btn-sm btn-outline-danger" data-id="${s.id}"><i class="bi bi-trash"></i></button></td>`;
			body.appendChild(tr);
		}
		div.appendChild(tbl);
		enableRowDrag(body, (order)=>{
			order.forEach((id, idx)=>{
				const s=DB.timeSlots.find(x=>String(x.id)===String(id));	// <- compare as strings
				s.sort=idx+1;
			});
			renderSlotEditor();
			rebuildAll();
		});

		const addBtn=document.createElement('button');
		addBtn.className='btn btn-sm btn-outline-primary';
		addBtn.innerHTML='<i class="bi bi-plus"></i> Lägg till rad';
		addBtn.addEventListener('click',()=>{
			const id=`${currentFactoryId}-${dt}-${Date.now()}`;
			DB.timeSlots.push({id,factoryId:currentFactoryId,dayType:dt,start:'00:00',end:'',type:'Work',sort:99});
			renderSlotEditor();rebuildAll();
			const inp=document.querySelector(`input[data-bind="start"][data-id="${escapeDataId(id)}"]`);
			if(inp){inp.focus();inp.select();}
		});
		wrap.appendChild(div);
		wrap.appendChild(addBtn);
	});
	wrap.querySelectorAll('input[data-bind], select[data-bind]').forEach(el=>{
		el.addEventListener('change',()=>{
			const s=DB.timeSlots.find(x=>String(x.id)===el.dataset.id);
			if(el.classList.contains('t24')){
				const v=normalize24(el.value);
				el.value=v;
				if(el.dataset.bind==='start') s.start=v;
				if(el.dataset.bind==='end') s.end=v;
			}else{
				if(el.dataset.bind==='type') s.type=el.value;
			}
			rebuildAll();
		});
	});
	wrap.querySelectorAll('button.btn-outline-danger').forEach(b=>b.addEventListener('click',async()=>{
		const id=b.dataset.id;
		const s=DB.timeSlots.find(x=>String(x.id)===String(id));
		const ok=await showConfirm({
			title:'Ta bort tidsintervall',
			message:`Ta bort raden ${s ? (s.start||'')+'–'+(s.end||'') : ''}?`,
			sub: `Planeringar för tidsintervallen tas också bort.`,
			okText:'Ta bort rad',
			okClass:'btn-danger'
		});
		if(!ok) return;
		DB.timeSlots=DB.timeSlots.filter(s=>String(s.id)!==id);
		renderSlotEditor(); rebuildAll();
	}));

}

function renderConstraintTable(){
	const tb=document.getElementById('constraintTable');
	tb.innerHTML='';
	DB.compatibility.forEach((c, idx)=>{
		const tr=document.createElement('tr');
		tr.dataset.index=String(idx);
		tr.innerHTML=`<td>${personSelect(c.a,`a-${idx}`,{excludeId:c.b})}</td><td>${personSelect(c.b,`b-${idx}`,{excludeId:c.a})}</td><td><button class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button></td>`;
		tb.appendChild(tr);
	});
	document.getElementById('addConstraintBtn').onclick=()=>{
		DB.compatibility.push({a:null,b:null});
		renderConstraintTable();
		if(mode==='edit') validateBoard();
	};
	tb.querySelectorAll('select').forEach(sel=>sel.addEventListener('change',()=>{
		const row=sel.closest('tr');
		const index=Number.parseInt(row?.dataset.index ?? '-1',10);
		if(index<0 || !DB.compatibility[index]) return;
		const s=row.querySelectorAll('select');
		DB.compatibility[index]={
			a:s[0].value ? parseEntityId(s[0].value) : null,
			b:s[1].value ? parseEntityId(s[1].value) : null
		};
		renderConstraintTable();
		if(mode==='edit') validateBoard();
	}));
	tb.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',async()=>{
		const tr=btn.closest('tr');
		const i=[...tb.children].indexOf(tr);
		const ok=await showConfirm({
			title:'Ta bort regel',
			message:'Ta bort denna samarbetsregel?',
			okText:'Ta bort regel',
			okClass:'btn-danger'
		});
		if(!ok) return;

		DB.compatibility.splice(i,1);
		renderConstraintTable();
		validateBoard();	// <- clears old warns/invalids and re-marks what still applies

		if(typeof showToast==='function'){ showToast('info','Regel borttagen','Färgvarningar uppdaterade.'); }
	}));


}

function personSelect(val,id,{excludeId=null}={}){
	const opts=['<option value="">- Välj person -</option>'].concat(
		DB.persons
			.filter(p=>p.factoryId===currentFactoryId)
			.filter(p=>excludeId==null || p.id!==excludeId || p.id===val)
			.map(p=>`<option value="${p.id}" ${p.id===val?'selected':''}>${escapeHtml(p.name)}</option>`)
	).join('');
	return `<select class="form-select form-select-sm" data-id="${id}">${opts}</select>`;
}

function editTraining(personId){
	const person = DB.persons.find(p => p.id === personId);
	const stations = DB.stations.filter(s => s.factoryId === currentFactoryId);
	const html = stations.map(s => {
		const has = DB.training.some(t => t.personId===personId && t.stationId===s.id);
		return `<div class="form-check">
			<input class="form-check-input" type="checkbox" id="t${s.id}" ${has?'checked':''} data-station-id="${s.id}">
			<label class="form-check-label" for="t${s.id}">${escapeHtml(s.title)}</label>
		</div>`;
	}).join('');

	// Build training modal
	const dlg=document.createElement('div');dlg.className='modal fade training-modal';
	dlg.innerHTML = `
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">Utbildning – ${escapeHtml(person.name)}</h5>
					<button class="btn-close" data-bs-dismiss="modal"></button>
				</div>
				<div class="modal-body">${html}</div>
				<div class="modal-footer">
					<button class="btn btn-secondary" data-bs-dismiss="modal">Stäng</button>
					<button class="btn btn-primary">Spara</button>
				</div>
			</div>
		</div>`;
	document.body.appendChild(dlg);

	// Find any currently open modal (e.g., #settingsModal) and dim it while training modal is open
	const parent = [...document.querySelectorAll('.modal.show')].find(m => m !== dlg) || null;
	if(parent) parent.classList.add('underlay');

	// Make the training modal hard-stacked: no backdrop click / no Esc
	const m = new bootstrap.Modal(dlg, { backdrop: 'static', keyboard: false });
	m.show();

	// Save handler
	dlg.querySelector('.btn-primary').addEventListener('click', () => {
		DB.training = DB.training.filter(t => t.personId !== personId);
		dlg.querySelectorAll('input[type="checkbox"]').forEach(ch => {
			if(ch.checked) DB.training.push({ personId, stationId: parseEntityId(ch.dataset.stationId) });
		});
		m.hide();
		dlg.addEventListener('hidden.bs.modal', () => dlg.remove());
		rebuildAll();
	});

	// Cleanup: restore parent modal visuals
	dlg.addEventListener('hidden.bs.modal', () => {
		if(parent) parent.classList.remove('underlay');
		dlg.remove();
	});
}





// Async confirm modal that dims/blur any open modal behind it
















// --- Personal tab cross-group DnD ---
let draggingPersonRowId = null;
let dragSourceGroupId=null;


function enablePersonCrossDrop(tbody, targetGroupId){
	let insertRow=null;

	function clearInsert(){
		if(insertRow){ insertRow.classList.remove('person-insert-before'); insertRow=null; }
	}

	tbody.addEventListener('dragover', ev=>{
		if(draggingPersonRowId==null) return;
		ev.preventDefault();

		// cross-group?
		const cross=(dragSourceGroupId!=null && targetGroupId!==dragSourceGroupId);

		// Show only the insertion line (no blue group outline)
		if(cross){
			const tr=ev.target.closest('tr');
			if(tr && tr.parentElement===tbody){
				if(insertRow && insertRow!==tr) insertRow.classList.remove('person-insert-before');
				insertRow=tr;
				insertRow.classList.add('person-insert-before');
			}else{
				if(insertRow) insertRow.classList.remove('person-insert-before');
				insertRow=null; // drop → end of list
			}
		}else{
			clearInsert(); // same-group: your row-reorder handles visuals
		}
	});

	tbody.addEventListener('dragleave', clearInsert);

	tbody.addEventListener('drop', ev=>{
		if(draggingPersonRowId==null) return;
		ev.preventDefault();

		const cross=(dragSourceGroupId!=null && targetGroupId!==dragSourceGroupId);

		let targetIndex;
		if(insertRow){
			targetIndex=[...tbody.querySelectorAll('tr')].indexOf(insertRow);
		}else{
			targetIndex=tbody.querySelectorAll('tr').length;
		}

		clearInsert();

		if(!cross) return; // same-group handled elsewhere
		movePersonToGroupAtIndex(draggingPersonRowId, dragSourceGroupId, targetGroupId, targetIndex);
	});
}




function armHandleOnlyRowDrag(tr){
	const handle=tr.querySelector('.drag-handle');
	if(!handle){
		tr.draggable=true;
		return;
	}
	tr.draggable=false;
	const disarm=()=>{ tr.draggable=false; };
	handle.addEventListener('pointerdown',()=>{
		tr.draggable=true;
		window.addEventListener('pointerup', disarm, { once:true, capture:true });
		window.addEventListener('pointercancel', disarm, { once:true, capture:true });
	});
	tr.addEventListener('dragend', disarm);
	tr.addEventListener('drop', disarm);
}

function enableRowDrag(tbody, onReorder){
	let dragId=null;
	tbody.querySelectorAll('tr').forEach(tr=>{
		armHandleOnlyRowDrag(tr);
		tr.addEventListener('dragstart',ev=>{
			dragId=String(tr.dataset.id);	// <- keep full id
			ev.dataTransfer.effectAllowed='move';
			try{ ev.dataTransfer.setData('text/plain',''); }catch(e){}
		});
		tr.addEventListener('dragover',ev=>{
			ev.preventDefault();
			tr.classList.add('drag-over');
		});
		tr.addEventListener('dragleave',()=>{
			tr.classList.remove('drag-over');
		});
		tr.addEventListener('drop',ev=>{
			ev.preventDefault();
			tbody.querySelectorAll('tr').forEach(x=>x.classList.remove('drag-over'));

			const rows=[...tbody.querySelectorAll('tr')];
			const from=rows.findIndex(r=>String(r.dataset.id)===dragId);
			const to=rows.indexOf(tr);
			if(from===-1||to===-1||from===to) return;

			tbody.insertBefore(rows[from], (from<to)? tr.nextSibling : tr);

			const order=[...tbody.querySelectorAll('tr')].map(r=>String(r.dataset.id));
			onReorder(order);
		});
	});
}

function enableRowDragKeys(tbody,onReorder){
	let dragKey=null;
	tbody.querySelectorAll('tr').forEach(tr=>{
		armHandleOnlyRowDrag(tr);
		tr.addEventListener('dragstart',ev=>{dragKey=tr.dataset.key;ev.dataTransfer.effectAllowed='move';});
		tr.addEventListener('dragover',ev=>{ev.preventDefault();tr.classList.add('drag-over');});
		tr.addEventListener('dragleave',()=>tr.classList.remove('drag-over'));
		tr.addEventListener('drop',ev=>{
			ev.preventDefault();
			tbody.querySelectorAll('tr').forEach(x=>x.classList.remove('drag-over'));
			const rows=[...tbody.querySelectorAll('tr')];
			const from=rows.findIndex(r=>r.dataset.key===dragKey);
			const to=rows.indexOf(tr);
			if(from===-1||to===-1||from===to) return;
			tbody.insertBefore(rows[from],(from<to)?tr.nextSibling:tr);
			const order=[...tbody.querySelectorAll('tr')].map(r=>r.dataset.key);
			onReorder(order);
		});
	});
}

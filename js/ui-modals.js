// Topbar actions, mode/session controls, onboarding tour, dialogs, login modal, and toasts.

const FIRST_RUN_TOUR_STORAGE_KEY='planning.firstRunTour';
const FIRST_RUN_TOUR_DONE_VALUE='completed';
const FIRST_RUN_TOUR_NEVER_VALUE='never';
let onboardingTourState=null;

function getTopbarSecondaryActionElements(){
	return ['randomizeBtn','historyActionsGroup','saveBtn','settingsBtn']
		.map(id=>document.getElementById(id))
		.filter(Boolean);
}

function relocateTopbarSecondaryActions(){
	const inlineHost=document.getElementById('secondaryActionsInline');
	const overflowMenu=document.getElementById('secondaryActionsMenu');
	const overflowWrap=document.getElementById('secondaryActionsOverflow');
	if(!inlineHost || !overflowMenu || !overflowWrap) return;
	const compactLayout=window.matchMedia('(max-width: 992px)').matches;
	const targetHost=compactLayout ? overflowMenu : inlineHost;
	getTopbarSecondaryActionElements().forEach(el=>{
		if(el.parentElement!==targetHost) targetHost.appendChild(el);
	});
	overflowWrap.classList.toggle('d-none', !compactLayout);
}

function bindTopbarActionDelegation(){
	const topbarControls=document.getElementById('topbarControls');
	if(!topbarControls || topbarControls.dataset.actionDelegateBound==='1') return;
	topbarControls.dataset.actionDelegateBound='1';
	topbarControls.addEventListener('click',ev=>{
		const actionBtn=ev.target.closest('#randomizeBtn,#undoBtn,#redoBtn,#saveBtn,#settingsBtn');
		if(!actionBtn || !topbarControls.contains(actionBtn)) return;
		switch(actionBtn.id){
			case 'randomizeBtn':
				openRandomizer();
				break;
			case 'undoBtn':
				undoAssignmentChange();
				break;
			case 'redoBtn':
				redoAssignmentChange();
				break;
			case 'saveBtn':
				saveAll();
				break;
			case 'settingsBtn':
				break;
			default:
				break;
		}
		const overflowToggle=document.getElementById('secondaryActionsToggle');
		const dropdown=overflowToggle ? bootstrap.Dropdown.getInstance(overflowToggle) : null;
		dropdown?.hide();
	});
}

function logoutCoordinator({reason='' }={}){
	sessionStorage.removeItem('planning.coord');
	clearModeBadgeTooltip();
	applyMode('viewer');
	renderSettings();
	rebuildAll();
	if(reason) showToast('info','Utloggad',reason);
}

function scheduleCoordinatorAutoLogout(){
	if(coordAutoLogoutTimerId){
		clearTimeout(coordAutoLogoutTimerId);
		coordAutoLogoutTimerId=null;
	}
	if(mode!=='edit' || coordAutoLogoutMinutes<=0 || sessionStorage.getItem('planning.coord')!=='ok') return;
	coordAutoLogoutTimerId=window.setTimeout(()=>{
		logoutCoordinator({reason:`Koordinatorläget loggades ut efter ${coordAutoLogoutMinutes} minuters inaktivitet.`});
	}, coordAutoLogoutMinutes*60*1000);
}

function recordCoordinatorActivity(){
	scheduleCoordinatorAutoLogout();
}

function bindCoordinatorActivityListeners(enabled){
	if(enabled && !coordActivityTrackingBound){
		INACTIVITY_ACTIVITY_EVENTS.forEach(evt=>document.addEventListener(evt, recordCoordinatorActivity, {passive:true}));
		coordActivityTrackingBound=true;
		return;
	}
	if(!enabled && coordActivityTrackingBound){
		INACTIVITY_ACTIVITY_EVENTS.forEach(evt=>document.removeEventListener(evt, recordCoordinatorActivity, {passive:true}));
		coordActivityTrackingBound=false;
	}
}

function bindViewerActivityListeners(enabled){
	if(enabled && !viewerActivityTrackingBound){
		INACTIVITY_ACTIVITY_EVENTS.forEach(evt=>document.addEventListener(evt, recordActivity, {passive:true}));
		viewerActivityTrackingBound=true;
		return;
	}
	if(!enabled && viewerActivityTrackingBound){
		INACTIVITY_ACTIVITY_EVENTS.forEach(evt=>document.removeEventListener(evt, recordActivity, {passive:true}));
		viewerActivityTrackingBound=false;
	}
}

function setNavbarModeControlsVisibility(nextMode,{animate=true}={}){
	const controls=document.querySelectorAll('.navbar .hide-in-viewer');
	if(controls.length===0) return;
	const ensureControlWidth=(el,{force=false}={})=>{
		if(!force && el.dataset.modeControlMax) return;
		const clone=el.cloneNode(true);
		clone.classList.remove('mode-hidden','mode-slide-fade-enter','mode-slide-fade-leave');
		clone.style.position='fixed';
		clone.style.left='-99999px';
		clone.style.top='-99999px';
		clone.style.visibility='hidden';
		clone.style.pointerEvents='none';
		clone.style.maxWidth='none';
		clone.style.maxHeight='none';
		clone.style.width='max-content';
		clone.style.overflow='visible';
		document.body.appendChild(clone);
		const measured=Math.max(
			Math.ceil(clone.getBoundingClientRect().width),
			Math.ceil(clone.scrollWidth),
			1
		);
		clone.remove();
		el.dataset.modeControlMax=String(measured);
		el.style.setProperty('--mode-control-max', `${measured}px`);
	};
	const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const shouldAnimate=animate && !reduceMotion;
	const show=nextMode==='edit';
	controls.forEach(el=>{
		if(show){
			el.classList.remove('mode-hidden','mode-slide-fade-leave');
			ensureControlWidth(el,{force:true});
			if(!shouldAnimate){
				el.classList.remove('mode-slide-fade-enter');
				return;
			}
			el.classList.add('mode-slide-fade-enter');
			requestAnimationFrame(()=>{
				el.classList.remove('mode-slide-fade-enter');
			});
			return;
		}
		if(!shouldAnimate){
			el.classList.remove('mode-slide-fade-enter','mode-slide-fade-leave');
			el.classList.add('mode-hidden');
			return;
		}
		el.classList.remove('mode-slide-fade-enter','mode-hidden');
		el.classList.add('mode-slide-fade-leave');
		const onDone=(evt)=>{
			if(evt.target!==el || mode!=='viewer') return;
			el.classList.add('mode-hidden');
			el.classList.remove('mode-slide-fade-leave');
		};
		el.addEventListener('transitionend', onDone, {once:true});
	});
}

function applyMode(nextMode,{updateUrl=true,animateNav=true}={}){
	const prevMode=mode;
	mode=nextMode==='edit' ? 'edit' : 'viewer';
	if(prevMode!==mode) _skipCellWarningTransitionOnce=true;
	document.documentElement.dataset.mode = mode;
	document.body.classList.toggle('viewer',mode!=='edit');
	setNavbarModeControlsVisibility(mode,{animate:animateNav && prevMode!==mode});
	renderSummaryPanel();
	refreshPersonPillVariants({animate:true});
	refreshAutoGenerateWarnings();
	syncAssignmentHistoryUi();
	const badge=document.getElementById('modeBadge');
	if(badge){
		badge.textContent=mode==='edit'?'COORDINATOR':'VIEWER';
		badge.classList.toggle('text-bg-success', mode==='edit');
		badge.classList.toggle('text-bg-secondary', mode!=='edit');
		const badgeTooltipText=mode==='edit'?'Klicka för att logga ut':'Klicka för att logga in som koordinator';
		badge.setAttribute('data-bs-title', badgeTooltipText);
		badge.removeAttribute('title');
		const badgeTip=bootstrap.Tooltip.getInstance(badge);
		if(badgeTip && typeof badgeTip.setContent==='function'){
			badgeTip.setContent({ '.tooltip-inner': badgeTooltipText });
		}
	}
	bindViewerActivityListeners(mode==='viewer');
	bindCoordinatorActivityListeners(mode==='edit');
	scheduleInactivityReset();
	scheduleViewerShiftSync();
	scheduleCoordinatorAutoLogout();
	if(updateUrl){
		const nextQs = new URLSearchParams(window.location.search);
		nextQs.set('mode', mode==='edit'?'edit':'viewer');
		nextQs.set('factory', String(currentFactoryId));
		nextQs.set('shift', currentShift);
		const nextUrl = `${window.location.pathname}?${nextQs.toString()}${window.location.hash || ''}`;
		window.history.replaceState(null, '', nextUrl);
	}
}

function dismissNativeTitleTooltip(el){
	if(!el) return;
	const ttl=el.getAttribute('title');
	if(ttl==null) return;
	el.removeAttribute('title');
	window.setTimeout(()=>{
		if(document.contains(el)) el.setAttribute('title', ttl);
	}, 80);
}

function clearModeBadgeTooltip(){
	const badge=document.getElementById('modeBadge');
	if(!badge) return;
	bootstrap.Tooltip.getInstance(badge)?.hide();
	badge.removeAttribute('aria-describedby');
}

function formatInactivityNoticeText(){
	const unit=inactivityResetMinutes===1 ? 'minuts' : 'minuters';
	return `Vy återställd efter ${inactivityResetMinutes} ${unit} inaktivitet`;
}

function showViewerNotice(message,{iconClass='bi-clock-history'}={}){
	const notice=document.getElementById('viewerUpdateNotice');
	if(!notice) return;
	const iconEl=notice.querySelector('.notice-icon');
	const textEl=notice.querySelector('.notice-text');
	if(iconEl){
		iconEl.className=`bi ${iconClass} me-1 notice-icon`;
	}
	if(textEl) textEl.textContent=message;
	if(viewerNoticeTimerId){
		clearTimeout(viewerNoticeTimerId);
		viewerNoticeTimerId=null;
	}
	notice.classList.remove('d-none','show');
	void notice.offsetWidth;
	notice.classList.add('show');
	viewerNoticeTimerId=window.setTimeout(()=>{
		notice.classList.remove('show');
		viewerNoticeTimerId=window.setTimeout(()=>{
			notice.classList.add('d-none');
			viewerNoticeTimerId=null;
		}, 220);
	}, 2800);
}

function resetToTodayIfNeeded(){
	if(dayChoice==='today') return;
	dayChoice='today';
	showViewerNotice(formatInactivityNoticeText(),{iconClass:'bi-clock-history'});
	setDateToOffset(0);
	setShift(detectCurrentShift(),{updateUrl:true});
	syncShiftUi();
	toggleDayButtons();
	suggestAndApplyTemplates();
	resetAssignmentHistory();
	renderSettings();
	rebuildAll();
}

function scheduleInactivityReset(){
	if(inactivityTimerId){
		clearTimeout(inactivityTimerId);
		inactivityTimerId=null;
	}
	if(mode!=='viewer' || inactivityResetMinutes<=0) return;
	inactivityTimerId=window.setTimeout(()=>{
		resetToTodayIfNeeded();
		scheduleInactivityReset();
	}, inactivityResetMinutes*60*1000);
}

function recordActivity(){
	scheduleInactivityReset();
}

function applyInactivityResetSetting(value,{persist=true}={}){
	const minutes=Math.max(0, Number.parseInt(value ?? '0',10) || 0);
	inactivityResetMinutes=minutes;
	if(persist) localStorage.setItem(INACTIVITY_RESET_KEY, String(minutes));
	syncInactivitySettingInput();
	scheduleInactivityReset();
}

function getDetectedViewerShift(){
	const now=new Date(Date.now()+(viewerShiftLeadMinutes*60*1000));
	return detectCurrentShift(now);
}

function syncViewerShiftIfNeeded(){
	if(mode!=='viewer' || dayChoice!=='today') return;
	const nextShift=getDetectedViewerShift();
	if(nextShift===currentShift) return;
	const prevShift=currentShift;
	setShift(nextShift,{updateUrl:true});
	syncShiftUi();
	suggestAndApplyTemplates();
	resetAssignmentHistory();
	renderSettings();
	rebuildAll();
	const minsLabel=viewerShiftLeadMinutes===1 ? '1 minut' : `${viewerShiftLeadMinutes} minuter`;
	const timingText=viewerShiftLeadMinutes===0 ? 'vid skiftstart' : `${minsLabel} före skiftstart`;
	showViewerNotice(`Visningen bytte från ${shiftLabel(prevShift)} till ${shiftLabel(nextShift)} (${timingText}).`,{iconClass:'bi-arrow-repeat'});
}

function scheduleViewerShiftSync(){
	if(viewerShiftSyncIntervalId){
		clearInterval(viewerShiftSyncIntervalId);
		viewerShiftSyncIntervalId=null;
	}
	if(mode!=='viewer') return;
	syncViewerShiftIfNeeded();
	viewerShiftSyncIntervalId=window.setInterval(syncViewerShiftIfNeeded, 30*1000);
}

function applyViewerShiftLeadSetting(value,{persist=true}={}){
	const minutes=Math.max(0, Number.parseInt(value ?? '0',10) || 0);
	viewerShiftLeadMinutes=minutes;
	if(persist) localStorage.setItem(VIEWER_SHIFT_LEAD_KEY, String(minutes));
	syncViewerShiftLeadSettingInput();
	syncViewerShiftIfNeeded();
	scheduleViewerShiftSync();
}

function readFirstRunTourFlag(){
	try{ return localStorage.getItem(FIRST_RUN_TOUR_STORAGE_KEY); }catch(_){ return FIRST_RUN_TOUR_DONE_VALUE; }
}

function writeFirstRunTourFlag(value){
	try{ localStorage.setItem(FIRST_RUN_TOUR_STORAGE_KEY,value); }catch(_){}
}

function resetFirstRunTourFlag(){
	try{ localStorage.removeItem(FIRST_RUN_TOUR_STORAGE_KEY); }catch(_){}
}

function isCoordinatorTourAvailable(){
	try{ return mode==='edit' && sessionStorage.getItem('planning.coord')==='ok'; }catch(_){ return mode==='edit'; }
}

function shouldStartFirstRunTour(){
	const flag=readFirstRunTourFlag();
	return isCoordinatorTourAvailable() && flag!==FIRST_RUN_TOUR_DONE_VALUE && flag!==FIRST_RUN_TOUR_NEVER_VALUE;
}

function setFirstRunTourDismissed(){ writeFirstRunTourFlag(FIRST_RUN_TOUR_NEVER_VALUE); }

function getFirstRunTourSteps(){
	return [
		{
			intro:true,
			icon:'bi-calendar2-week',
			title:'Välkommen till Planeringsschema Dental',
			body:'Här planerar du bemanning per skift, fabrik, tidsintervall och station. Vi visar snabbt hur du väljer kontext, fyller rutnätet, tolkar varningar och hittar rapporter, autogenerering och inställningar.'
		},
		{
			selector:'#topbarControls .topbar-primary',
			placement:'bottom',
			icon:'bi-sliders',
			title:'1. Välj kontext',
			body:'Börja med skift, fabrik och dag. Kontexten styr vilka grupper, stationer, tider och varningar som visas i planeringsytan.'
		},
		{
			selector:'.schedule-grid .cell:not(.break), #gridArea',
			placement:'right',
			icon:'bi-grid-3x3-gap',
			title:'2. Arbeta i rutnätet',
			body:'Klicka på en cell för att välja personal, eller dra personer mellan celler när koordinatorläget tillåter redigering. Färgmarkeringar visar direkt när något behöver åtgärdas.'
		},
		{
			selector:'#summaryWarning',
			placement:'bottom',
			icon:'bi-exclamation-triangle',
			title:'3. Följ varningssammanfattningen',
			body:'Sammanfattningen räknar berörda celler och låter dig filtrera på kapacitet, utbildning, kompatibilitet och frånvaro. Knappen Rapport öppnar en mer detaljerad vy.'
		},
		{
			selector:'#reportModal .modal-content',
			placement:'left',
			icon:'bi-graph-up-arrow',
			title:'4. Granska rapporten',
			body:'Rapporten visar härledda nyckeltal, täckning per station och konflikter för aktuell kontext.',
			onEnter:()=>showTourModal('reportModal',()=>renderDerivedReport()),
			onLeave:()=>hideTourModal('reportModal')
		},
		{
			selector:'#randomizeBtn',
			placement:'bottom',
			icon:'bi-cursor-fill',
			title:'5. Öppna autogenerering',
			body:'Klicka på Autogenerera i toppmenyn när du vill låta systemet föreslå bemanning för valda stationer och grupper.',
			onEnter:()=>{hideTourModal('reportModal');showTourTopbarAction('randomizeBtn');},
			onLeave:()=>hideTourTopbarOverflow()
		},
		{
			selector:'#randomizeModal .modal-content',
			placement:'left',
			icon:'bi-shuffle',
			title:'6. Autogenerera planering',
			body:'Autogenereringen använder valda personalgrupper, stationer och regler för att fylla schemat. Du kan behålla befintliga tilldelningar och prioritera utbildning eller kritiska stationer.',
			onEnter:()=>openRandomizer(),
			onLeave:()=>hideTourModal('randomizeModal')
		},
		{
			selector:'#settingsModal .modal-content',
			placement:'left',
			icon:'bi-gear',
			title:'7. Justera inställningar',
			body:'I Inställningar hanterar du personal, grupper, stationer, tidsintervall, samarbetsregler och allmänna beteenden. Du kan också visa introduktionen igen med knappen Visa introduktion i Inställningars modalhuvud.',
			onEnter:()=>showTourModal('settingsModal',()=>renderSettings()),
			onLeave:()=>hideTourModal('settingsModal')
		}
	];
}

function getFirstRunTourStepNumber(index){
	const steps=onboardingTourState?.steps||[];
	return steps.slice(0,index+1).filter(step=>!step.intro).length;
}

function getFirstRunTourStepCount(){
	return (onboardingTourState?.steps||[]).filter(step=>!step.intro).length;
}

function showTourModal(id,beforeShow){
	const el=document.getElementById(id);
	if(!el) return;
	if(typeof beforeShow==='function') beforeShow();
	bootstrap.Modal.getOrCreateInstance(el).show();
}

function hideTourModal(id){
	const el=document.getElementById(id);
	if(!el) return;
	bootstrap.Modal.getInstance(el)?.hide();
}

function closeTourOwnedModals(){
	['reportModal','randomizeModal','settingsModal'].forEach(hideTourModal);
}

function showTourTopbarAction(id){
	const btn=document.getElementById(id);
	if(!btn || !btn.closest('#secondaryActionsMenu')) return;
	const toggle=document.getElementById('secondaryActionsToggle');
	if(toggle) bootstrap.Dropdown.getOrCreateInstance(toggle).show();
}

function hideTourTopbarOverflow(){
	const toggle=document.getElementById('secondaryActionsToggle');
	if(toggle) bootstrap.Dropdown.getInstance(toggle)?.hide();
}

function startFirstRunTour({force=false}={}){
	if(!isCoordinatorTourAvailable() || (!force && !shouldStartFirstRunTour()) || onboardingTourState?.active) return;
	const overlay=document.createElement('div');
	overlay.id='firstRunTourOverlay';
	overlay.className='first-run-tour-overlay';
	overlay.setAttribute('role','dialog');
	overlay.setAttribute('aria-modal','true');
	overlay.setAttribute('aria-live','polite');
	overlay.innerHTML=`
		<div class="first-run-tour-scrim" data-role="scrim"></div>
		<div class="first-run-tour-spotlight" data-role="spotlight" aria-hidden="true"></div>
		<div class="first-run-tour-card shadow-lg" data-role="card">
			<div class="d-flex align-items-start gap-3 mb-3">
				<div class="first-run-tour-icon"><i data-role="icon" class="bi bi-info-circle"></i></div>
				<div class="flex-grow-1">
					<div class="small text-muted fw-semibold" data-role="progress"></div>
					<h5 class="mb-0" data-role="title"></h5>
				</div>
				<button type="button" class="btn-close" data-role="close" aria-label="Hoppa över rundturen"></button>
			</div>
			<p class="mb-4" data-role="body"></p>
			<div class="first-run-tour-actions">
				<div class="btn-group btn-group-sm" role="group" aria-label="Rundturssteg">
					<button type="button" class="btn btn-outline-secondary" data-role="prev"><i class="bi bi-arrow-left"></i> Föregående</button>
					<button type="button" class="btn btn-primary" data-role="next">Nästa <i class="bi bi-arrow-right"></i></button>
				</div>
				<button type="button" class="btn btn-sm btn-link text-secondary" data-role="skip">Hoppa över</button>
			</div>
		</div>`;
	document.body.appendChild(overlay);
	onboardingTourState={active:true,index:0,enteredIndex:null,steps:getFirstRunTourSteps(),overlay,resizeHandler:()=>renderFirstRunTourStep()};
	window.addEventListener('resize',onboardingTourState.resizeHandler);
	overlay.querySelector('[data-role="prev"]').addEventListener('click',()=>goFirstRunTourStep(-1));
	overlay.querySelector('[data-role="next"]').addEventListener('click',()=>goFirstRunTourStep(1));
	overlay.querySelector('[data-role="skip"]').addEventListener('click',()=>finishFirstRunTour());
	overlay.querySelector('[data-role="close"]').addEventListener('click',()=>finishFirstRunTour());
	document.addEventListener('keydown',handleFirstRunTourKeydown);
	renderFirstRunTourStep();
}

function handleFirstRunTourKeydown(ev){
	if(!onboardingTourState?.active) return;
	if(ev.key==='Escape'){
		ev.preventDefault();
		finishFirstRunTour();
	}else if(ev.key==='ArrowRight'){
		ev.preventDefault();
		goFirstRunTourStep(1);
	}else if(ev.key==='ArrowLeft'){
		ev.preventDefault();
		goFirstRunTourStep(-1);
	}
}

function goFirstRunTourStep(delta){
	if(!onboardingTourState?.active) return;
	const current=onboardingTourState.steps[onboardingTourState.index];
	if(current?.onLeave) current.onLeave();
	const nextIndex=onboardingTourState.index+delta;
	if(nextIndex<0){
		onboardingTourState.index=0;
		renderFirstRunTourStep();
		return;
	}
	if(nextIndex>=onboardingTourState.steps.length){
		finishFirstRunTour();
		return;
	}
	onboardingTourState.index=nextIndex;
	renderFirstRunTourStep();
}

function finishFirstRunTour(){
	if(!onboardingTourState) return;
	setFirstRunTourDismissed();
	const state=onboardingTourState;
	state.steps[state.index]?.onLeave?.();
	window.removeEventListener('resize',state.resizeHandler);
	document.removeEventListener('keydown',handleFirstRunTourKeydown);
	state.overlay.remove();
	onboardingTourState=null;
	closeTourOwnedModals();
}

function renderFirstRunTourStep(){
	const state=onboardingTourState;
	if(!state?.active) return;
	const step=state.steps[state.index];
	if(!step) return;
	const isNewStep=state.enteredIndex!==state.index;
	if(isNewStep){
		state.enteredIndex=state.index;
		step.onEnter?.();
	}
	window.setTimeout(()=>positionFirstRunTourStep(step), (isNewStep && step.onEnter) ? 180 : 0);
}

function positionFirstRunTourStep(step){
	const state=onboardingTourState;
	if(!state?.active) return;
	const overlay=state.overlay;
	const target=step.intro ? document.body : (document.querySelector(step.selector) || document.getElementById('app') || document.body);
	const rect=target.getBoundingClientRect();
	const margin=10;
	const spotlight=overlay.querySelector('[data-role="spotlight"]');
	const card=overlay.querySelector('[data-role="card"]');
	const title=overlay.querySelector('[data-role="title"]');
	const body=overlay.querySelector('[data-role="body"]');
	const progress=overlay.querySelector('[data-role="progress"]');
	const icon=overlay.querySelector('[data-role="icon"]');
	const prev=overlay.querySelector('[data-role="prev"]');
	const next=overlay.querySelector('[data-role="next"]');
	overlay.classList.toggle('is-intro', !!step.intro);
	spotlight.classList.toggle('d-none', !!step.intro);
	if(!step.intro){
		spotlight.style.left=`${Math.max(8,rect.left-margin)}px`;
		spotlight.style.top=`${Math.max(8,rect.top-margin)}px`;
		spotlight.style.width=`${Math.min(window.innerWidth-16,rect.width+(margin*2))}px`;
		spotlight.style.height=`${Math.min(window.innerHeight-16,rect.height+(margin*2))}px`;
	}
	title.textContent=step.title;
	body.textContent=step.body;
	progress.textContent=step.intro ? 'Snabb introduktion' : `Steg ${getFirstRunTourStepNumber(state.index)} av ${getFirstRunTourStepCount()}`;
	icon.className=`bi ${step.icon||'bi-info-circle'}`;
	prev.classList.toggle('d-none', !!step.intro);
	prev.disabled=state.index===0;
	next.innerHTML=state.index===state.steps.length-1 ? 'Klart <i class="bi bi-check2"></i>' : (step.intro ? 'Starta rundtur <i class="bi bi-arrow-right"></i>' : 'Nästa <i class="bi bi-arrow-right"></i>');
	const cardRect=card.getBoundingClientRect();
	const gap=14;
	let left=(window.innerWidth-cardRect.width)/2;
	let top=(window.innerHeight-cardRect.height)/2;
	if(!step.intro){
		left=rect.right+gap;
		top=rect.top;
		if(step.placement==='bottom'){
			left=rect.left;
			top=rect.bottom+gap;
		}else if(step.placement==='left'){
			left=rect.left-cardRect.width-gap;
			top=rect.top;
		}
	}
	left=Math.min(Math.max(12,left),window.innerWidth-cardRect.width-12);
	top=Math.min(Math.max(12,top),window.innerHeight-cardRect.height-12);
	card.style.left=`${left}px`;
	card.style.top=`${top}px`;
}

function replayFirstRunTour(){
	if(!isCoordinatorTourAvailable()){
		showToast('info','Koordinatorläge krävs','Introduktionen kan bara visas i koordinatorläge.');
		return;
	}
	resetFirstRunTourFlag();
	closeTourOwnedModals();
	window.setTimeout(()=>startFirstRunTour({force:true}), 250);
}

function maybeStartFirstRunTour(){
	if(!shouldStartFirstRunTour()) return;
	window.setTimeout(()=>startFirstRunTour(), 350);
}

function showCoordLogin({onSuccess}={}){
	const saved=sessionStorage.getItem('planning.coord');
	if(saved==='ok'){
		if(typeof onSuccess==='function') onSuccess();
		return;
	}

	const el=document.getElementById('coordModal');
	const pwdEl=document.getElementById('coordPwd');
	const fbEl=document.getElementById('coordPwdFeedback');
	const btn=document.getElementById('coordLoginBtn');

	// Hard-lock the modal (no backdrop/Esc close)
	const m=new bootstrap.Modal(el,{backdrop:'static',keyboard:false});

	// Prevent close unless logged in (bind once per open by replacing previous handler)
	if(el._coordHideHandler){
		el.removeEventListener('hide.bs.modal', el._coordHideHandler);
	}
	el._coordHideHandler=(ev)=>{
		if(sessionStorage.getItem('planning.coord')!=='ok'){
			ev.preventDefault();
			if(typeof showToast==='function'){
				showToast('info','Inloggning krävs','Du måste logga in för att fortsätta.');
			}
		}
	};
	el.addEventListener('hide.bs.modal', el._coordHideHandler);

	// Clear invalid state when typing
	pwdEl.oninput=()=>{
		pwdEl.classList.remove('is-invalid');
	};

	// Focus when shown
	if(el._coordShownHandler){
		el.removeEventListener('shown.bs.modal', el._coordShownHandler);
	}
	el._coordShownHandler=()=>pwdEl.focus();
	el.addEventListener('shown.bs.modal', el._coordShownHandler);

	// Pretty error feedback
	function showPrettyError(msg){
		pwdEl.classList.add('is-invalid');
		if(fbEl) fbEl.textContent=msg||'Fel lösenord';
		const dlg=el.querySelector('.modal-dialog');
		if(dlg){
			dlg.classList.remove('shake'); // restart animation if repeated
			// force reflow
			void dlg.offsetWidth;
			dlg.classList.add('shake');
			dlg.addEventListener('animationend', ()=>dlg.classList.remove('shake'), {once:true});
		}
		if(typeof showToast==='function'){
			showToast('danger','Fel lösenord','Försök igen.');
		}
		pwdEl.select();
	}

	// Submit handler (button + Enter)
	async function doLogin(){
		if(btn.disabled) return;
		btn.disabled=true;
		const pwd=pwdEl.value;
		try{
			const ok=await verifyPassword(pwd);
			if(ok){
				sessionStorage.setItem('planning.coord','ok');
				m.hide();
				if(typeof onSuccess==='function') onSuccess();
			}else{
				showPrettyError('Fel lösenord');
			}
		}finally{
			btn.disabled=false;
		}
	}

	btn.onclick=doLogin;
	pwdEl.onkeydown=(e)=>{
		if(e.key==='Enter'){
			e.preventDefault();
			doLogin();
		}
	};

	m.show();
}

async function verifyPassword(pwd){
	const hash=await sha256(pwd);
	const stored=DB.appSettings.CoordinatorPasswordHash||hash;
	DB.appSettings.CoordinatorPasswordHash=stored;
	return hash===stored;
}

function showConfirm(opts={}){
	return new Promise(resolve=>{
		const modalEl=document.getElementById('confirmModal');
		modalEl.querySelector('[data-role="ttl"]').textContent=opts.title||'Bekräfta';
		modalEl.querySelector('[data-role="msg"]').textContent=opts.message||'Är du säker?';
		modalEl.querySelector('[data-role="sub"]').innerHTML=opts.sub||'';
		const okBtn=document.getElementById('confirmOkBtn');
		okBtn.textContent=opts.okText||'Ta bort';
		okBtn.className='btn ' + (opts.okClass||'btn-danger');

		// Dim/blur any already open modal(s)
		const underlays=[...document.querySelectorAll('.modal.show')].filter(m=>m!==modalEl);
		underlays.forEach(m=>m.classList.add('underlay'));

		const m=new bootstrap.Modal(modalEl,{backdrop:'static',keyboard:true});
		let confirmed=false;

		function onOk(){
			confirmed=true;
			m.hide(); // don't dispose here; wait for 'hidden'
		}
		function onKey(ev){
			if(ev.key==='Enter'){
				ev.preventDefault();
				onOk();
			}
		}
		function onHidden(){
			underlays.forEach(u=>u.classList.remove('underlay'));
			okBtn.removeEventListener('click',onOk);
			modalEl.removeEventListener('keydown',onKey);
			modalEl.removeEventListener('hidden.bs.modal',onHidden);
			m.dispose(); // safe now
			resolve(confirmed);
		}

		okBtn.addEventListener('click',onOk);
		modalEl.addEventListener('keydown',onKey);
		modalEl.addEventListener('hidden.bs.modal',onHidden,{once:true});

		m.show();
		setTimeout(()=>okBtn.focus(),120);
	});
}

function fitToViewport(){
	const scroller=document.getElementById('gridScroller');
	const scaler=document.getElementById('gridScaler');
	if(!scaler.firstChild) return;

	// measure grid width unscaled
	const grid=scaler.firstChild;
	scaler.style.transform='scale(1)';

	// exact width fit
	const needW=grid.scrollWidth||1;
	const availW=scroller.clientWidth||1;
	const scale=availW/needW;
	const inv=1/Math.max(scale,0.0001);

	// keep fonts/icons visually constant
	document.documentElement.style.setProperty('--font-comp',String(inv));
	document.documentElement.style.setProperty('--time-col-w',(65*inv)+'px');
	document.documentElement.style.setProperty('--hdr-group-h',(26*inv)+'px');
	document.documentElement.style.setProperty('--hdr-station-h',(34*inv)+'px');

	// exact row math: split the visible height across all rendered slots
	const slotCount=DB.timeSlots.filter(ts=>ts.factoryId===currentFactoryId&&ts.dayType===currentDayType).length||1;
	const headersVisible=26+34;		// px on screen

	const usableVisible=Math.max(0, scroller.clientHeight-(headersVisible));
	const rowVisible=usableVisible/slotCount;	// fractional px on screen

	document.documentElement.style.setProperty('--row-h', (rowVisible*inv)+'px');
	document.documentElement.style.setProperty('--row-extra', '0px');


	// apply transform
	scaler.style.transform=`scale(${scale})`;
}

function showWarn(msg){
	const a=document.getElementById('warnAlert');
	a.textContent=msg;
	a.classList.remove('d-none');
	setTimeout(()=>a.classList.add('d-none'),4000);
}

function updateToastAreaPosition(){
	const area=document.getElementById('toastArea');
	if(!area) return;
	const topMenu=document.querySelector('nav.navbar.sticky-top');
	const menuBottom=topMenu ? topMenu.getBoundingClientRect().bottom : 0;
	const safeTop=Math.max(0, Math.ceil(menuBottom))+8;
	area.style.setProperty('top', `${safeTop}px`, 'important');
}

function showToast(kind, title, msg, opts={}){
	const area=document.getElementById('toastArea');
	if(!area) return;
	updateToastAreaPosition();
	const icon = (kind==='danger') ? 'exclamation-octagon' : (kind==='warning' ? 'exclamation-triangle' : 'info-circle');

	const el=document.createElement('div');
	el.className=`toast app-toast toast-${kind}`;
	el.setAttribute('role','alert');
	el.setAttribute('aria-live','assertive');
	el.setAttribute('aria-atomic','true');
	el.innerHTML=
		`<div class="toast-header">
			<i class="bi bi-${icon} me-2"></i>
			<strong class="me-auto">${escapeHtml(title)}</strong>
			<button type="button" class="btn-close ms-2 mb-1" data-bs-dismiss="toast" aria-label="Close"></button>
		</div>
		<div class="toast-body">${msg}</div>`;
	area.appendChild(el);

	const t=new bootstrap.Toast(el,{delay:opts.delay??4500,autohide:true,animation:true});
	el.addEventListener('hidden.bs.toast',()=>el.remove());
	t.show();
}

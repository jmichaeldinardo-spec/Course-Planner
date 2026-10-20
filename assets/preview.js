/* Fictional, disposable demonstration. No storage, network calls, or live integrations. */
'use strict';
const colors = { purple: '#a896f5', blue: '#84b7ed', mint: '#80c5ac', amber: '#e4b96f', pink: '#e79eaf' };
const templates = {
  connected: { name: 'Connected plan', modules: ['goals', 'activities', 'assessment', 'differentiation', 'materials', 'notes'] },
  discussion: { name: 'Discussion focus', modules: ['goals', 'assessment', 'activities', 'materials', 'notes'] }
};
const moduleNames = { goals: 'Learning goals', activities: 'Instructional activities', assessment: 'Assessment', differentiation: 'Differentiation', materials: 'Materials & resources', notes: 'Homework, notes & reflection' };
function createSampleCourse() {
const units = [
  {
    title: 'Foundations', color: 'purple', icon: 'unit',
    question: 'Why do people create governments?',
    objective: 'Explain the purposes of government and compare ways societies organize political power.',
    lessons: [
      { title: 'What is Government?', duration: 50,
        objective: 'Explain what government is and identify its core purposes using everyday examples.',
        guidingQuestion: 'How does government affect decisions in a community?',
        standard: 'GOV.1', standardText: 'Explain the purposes of government. Sample curriculum standard.',
        activities: 'Notice and wonder: community rules. Compare three scenarios, then build a shared definition of government.',
        materials: ['Unit 1 slide deck', 'Community scenarios', 'Concept organizer'],
        differentiation: 'Offer a vocabulary bank and sentence starters; extend with a comparison of competing public priorities.',
        assessment: 'Exit ticket: Explain one purpose of government and support it with a specific example.' },
      { title: 'Types of Government', duration: 50,
        objective: 'Compare systems of government by how leaders are selected and power is distributed.',
        guidingQuestion: 'Who holds power, and how are decisions made?',
        standard: 'GOV.2', standardText: 'Compare political systems. Sample curriculum standard.',
        activities: 'Sort government scenario cards. Build a comparison chart and discuss the tradeoffs in each system.',
        materials: ['Political systems chart', 'Scenario card set', 'Comparison organizer'],
        differentiation: 'Use an illustrated comparison chart; invite an extension on hybrid systems.',
        assessment: 'Write a claim comparing two systems and cite evidence from the scenarios.' },
      { title: 'Why Government Matters', duration: 50,
        objective: 'Evaluate how public decisions balance individual rights and collective needs.',
        guidingQuestion: 'What should a community expect from its government?',
        standard: 'GOV.3', standardText: 'Analyze public decision-making. Sample curriculum standard.',
        activities: 'Consider a fictional town budget. Prioritize needs in small groups and explain the reasoning behind a proposal.',
        materials: ['Fictional town budget', 'Priority cards', 'Reflection prompt'],
        differentiation: 'Provide a worked example and discussion roles; offer an additional constraint for extension.',
        assessment: 'Defend one budget choice and acknowledge a competing community need.' }
    ]
  },
  {
    title: 'The Constitution', color: 'blue', icon: 'file',
    question: 'How can a constitution limit power and protect liberty?',
    objective: 'Analyze the principles and compromises that shape the structure of the U.S. Constitution.',
    lessons: [
      { title: 'A New Framework', duration: 50,
        objective: 'Identify challenges under the Articles of Confederation and explain the need for a new framework.',
        guidingQuestion: 'What makes a national government effective?',
        standard: 'GOV.4', standardText: 'Explain constitutional foundations. Sample curriculum standard.',
        activities: 'Investigate fictional state disagreements, then connect the challenges to weaknesses in the Articles.',
        materials: ['Constitution overview', 'Articles excerpt', 'Problem-solution organizer'],
        differentiation: 'Provide annotated excerpts and a cause-and-effect organizer; extend with an alternative proposal.',
        assessment: 'Explain how a constitutional change responded to a specific problem.' },
      { title: 'Principles in Practice', duration: 50,
        objective: 'Apply federalism, separation of powers, and checks and balances to example decisions.',
        guidingQuestion: 'How does the Constitution divide and limit power?',
        standard: 'GOV.5', standardText: 'Apply constitutional principles. Sample curriculum standard.',
        activities: 'Match principles to scenarios. Annotate a diagram showing where power is divided and checked.',
        materials: ['Principles reference sheet', 'Scenario set', 'Government structure diagram'],
        differentiation: 'Model one scenario before independent work; offer a multi-principle scenario for extension.',
        assessment: 'Identify a constitutional principle in a new scenario and explain the connection.' },
      { title: 'The Ratification Debate', duration: 50,
        objective: 'Compare arguments for and against ratification using short, adapted source excerpts.',
        guidingQuestion: 'Why did people disagree about the proposed Constitution?',
        standard: 'GOV.6', standardText: 'Evaluate constitutional arguments. Sample curriculum standard.',
        activities: 'Read paired excerpts and prepare a structured discussion about power and safeguards.',
        materials: ['Adapted debate excerpts', 'Evidence organizer', 'Discussion prompts'],
        differentiation: 'Offer glossed excerpts and audio-ready text; extend with a rebuttal paragraph.',
        assessment: 'Use evidence to explain one concern and a proposed response.' }
    ]
  },
  {
    title: 'Branches of Government', color: 'mint', icon: 'layers',
    question: 'How do the branches share power and hold one another accountable?',
    objective: 'Explain the responsibilities of the three branches and evaluate their interactions.',
    lessons: [
      { title: 'Making the Laws', duration: 50,
        objective: 'Trace how a proposal can become law and identify key responsibilities of Congress.',
        guidingQuestion: 'How does an idea become a public decision?',
        standard: 'GOV.7', standardText: 'Explain legislative processes. Sample curriculum standard.',
        activities: 'Sequence a fictional bill and discuss the points at which it can change or stop.',
        materials: ['Branches overview', 'Fictional bill cards', 'Legislative flowchart'],
        differentiation: 'Provide a partially completed flowchart; extend by adding a committee revision.',
        assessment: 'Annotate a bill pathway and explain one opportunity for deliberation.' },
      { title: 'The Executive Branch', duration: 50,
        objective: 'Distinguish the responsibilities of the president and executive agencies.',
        guidingQuestion: 'What does it mean to carry out a law?',
        standard: 'GOV.8', standardText: 'Explain executive responsibilities. Sample curriculum standard.',
        activities: 'Sort responsibility cards and apply an executive decision to a fictional public policy.',
        materials: ['Executive roles guide', 'Policy scenario', 'Decision organizer'],
        differentiation: 'Use role descriptions with concrete examples; extend with a checks-and-balances challenge.',
        assessment: 'Explain an executive responsibility and one constitutional limit.' },
      { title: 'Interpreting the Law', duration: 50,
        objective: 'Explain the role of courts and apply judicial reasoning to a fictional case.',
        guidingQuestion: 'How do courts resolve questions about the law?',
        standard: 'GOV.9', standardText: 'Explain judicial responsibilities. Sample curriculum standard.',
        activities: 'Examine a fictional dispute, identify the legal question, and compare two reasoned interpretations.',
        materials: ['Court structure guide', 'Fictional case brief', 'Reasoning organizer'],
        differentiation: 'Provide a case summary and reasoning frames; extend with a dissenting opinion.',
        assessment: 'Write a short decision that connects a claim to a rule and evidence.' }
    ]
  }
];

  const unitIds = ['unit-foundations', 'unit-constitution', 'unit-branches'];
  const lessonIds = ['lesson-government', 'lesson-systems', 'lesson-public-good', 'lesson-framework', 'lesson-principles', 'lesson-ratification', 'lesson-laws', 'lesson-executive', 'lesson-courts'];
  const baselineDates = [['2026-09-01'], ['2026-09-02'], ['2026-09-03'], ['2026-09-08'], ['2026-09-09', '2026-09-10'], ['2026-09-11'], ['2026-09-14'], ['2026-09-15'], ['2026-09-16']];
  const unitFields = [
    { targetDays: 3, understandings: 'Governments make collective decisions. Authority and individual rights can be in tension.', outcomes: 'Compare political systems; explain the public good; support a civic claim with evidence.', assessment: 'A short community-budget proposal provides evidence of reasoning about public priorities.', formative: 'Scenario sorts, discussion notes, and a claim with one supporting example.', vocabulary: 'Authority, legitimacy, rights, public good.', supports: 'Begin with familiar community rules. Address the misconception that government is only a national institution. Offer visual vocabulary and sentence frames.', texts: 'Fictional town budget; teacher-created community scenarios.', notes: 'Keep examples fictional and invite more than one defensible perspective.' },
    { targetDays: 4, understandings: 'Constitutional structures respond to problems of power, representation, and accountability.', outcomes: 'Explain the need for a new framework; apply constitutional principles; compare ratification arguments.', assessment: 'The Ratification Debate is the linked assessment lesson, pinned to September 11 in the sample calendar.', formative: 'Problem-solution organizer, principle-to-scenario explanations, and source annotations.', vocabulary: 'Federalism, ratification, checks and balances.', supports: 'Review the Articles of Confederation. Distinguish separation of powers from federalism. Provide glossed excerpts and model one evidence-based claim.', texts: 'Adapted fictional debate excerpts; constitutional-principles reference sheet.', notes: 'Principles in Practice spans two instructional days. The linked debate uses one day.' },
    { targetDays: 4, understandings: 'Separate institutions share responsibility and place limits on one another.', outcomes: 'Trace a bill; distinguish executive responsibilities; explain judicial reasoning.', assessment: 'An explanatory branch-interaction map is a unit assessment idea; it is not an extra scheduled event.', formative: 'Bill-pathway annotations, responsibility sort, and a short fictional court decision.', vocabulary: 'Legislation, implementation, judicial review.', supports: 'Revisit checks and balances. Address the idea that one branch acts alone. Offer a partially completed flowchart and structured reasoning frames.', texts: 'Fictional bill cards; executive-role guide; fictional case brief.', notes: 'Three lesson days are planned against a four-day target. The variance is visible; no extra day is silently scheduled.' }
  ];
  let index = 0;
  const lessons = [];
  units.forEach((unit, unitIndex) => {
    Object.assign(unit, unitFields[unitIndex], { id: unitIds[unitIndex], position: unitIndex + 1, purpose: unit.objective });
    unit.lessons.forEach(lesson => {
      Object.assign(lesson, {
        id: lessonIds[index], unitId: unit.id, order: index + 1,
        dates: [...baselineDates[index]], baselineDates: [...baselineDates[index]],
        type: index === 5 ? 'Assessment' : index === 4 ? 'Workshop' : 'Lesson',
        status: index < 3 ? 'Ready' : 'Draft', pinned: index === 5, preference: null,
        baseTemplate: 'connected', templateOverride: null,
        homework: 'Optional: revisit the lesson question and add one example.',
        notes: 'Fictional planning notes. Adapt the examples to the discussion.',
        reflection: 'After teaching: what evidence would inform the next lesson?'
      });
      lessons.push(lesson); index += 1;
    });
    delete unit.lessons;
  });
  return {
    id: 'course-american-government', title: 'American Government', defaultTemplate: 'connected', units, lessons,
    rules: [
      { id: 'rule-flex', date: '2026-09-04', type: 'Flex day', label: 'Reserved flex capacity', detail: 'One instructional day reserved for review or catch-up; no lesson assigned.', unavailable: true },
      { id: 'rule-closure', date: '2026-09-07', type: 'Closure', label: 'Sample school closure', detail: 'School is closed. No instructional capacity is available.', unavailable: true },
      { id: 'rule-testing', date: '2026-09-17', type: 'Instructional exception', label: 'Testing day · no course instruction', detail: 'A full-day testing exception blocks normal lessons for this course.', unavailable: true }
    ]
  };
}
const course = createSampleCourse();
const state = {
  workspace: 'sequence', sequenceView: 'table', unitFilter: 'all', unitId: course.units[0].id,
  lessonId: course.lessons[0].id, search: '', calendarView: 'month', month: '2026-09', day: '2026-09-14',
  openSections: {}, history: [], pending: null
};
const app = document.getElementById('application');
const stage = document.getElementById('workspace-content');
const dialog = document.getElementById('demo-dialog');
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = escapeHTML;
const unitById = id => course.units.find(unit => unit.id === id);
const lessonById = id => course.lessons.find(lesson => lesson.id === id);
const currentUnit = () => unitById(state.unitId);
const currentLesson = () => lessonById(state.lessonId);
const unitLessons = id => course.lessons.filter(lesson => lesson.unitId === id);
const asDate = iso => new Date(`${iso}T12:00:00Z`);
const isoDate = date => date.toISOString().slice(0, 10);
const addDays = (iso, count) => { const date = asDate(iso); date.setUTCDate(date.getUTCDate() + count); return isoDate(date); };
const dateLabel = (iso, options = { month: 'short', day: 'numeric' }) => asDate(iso).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
const fullDate = iso => dateLabel(iso, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const dateRange = dates => dates.length > 1 ? `${dateLabel(dates[0])}–${dateLabel(dates.at(-1), { day: 'numeric' })}` : dateLabel(dates[0]);
const unitStyle = id => `--cp-unit:${colors[unitById(id).color]}`;
const badge = (label, kind = '') => `<span class="cp-badge ${kind}">${h(label)}</span>`;
const button = (label, attrs = '', extra = '') => `<button type="button" class="cp-button ${extra}" ${attrs}>${h(label)}</button>`;
function announce(message) { document.getElementById('demo-status').textContent = message; }
function options(values, selected) { return values.map(value => `<option value="${h(value)}"${value === selected ? ' selected' : ''}>${h(value)}</option>`).join(''); }
function lessonLink(lesson) { return `<button type="button" class="cp-link" data-open-lesson="${lesson.id}">${h(lesson.title)}</button>`; }
function planningStats(unit) {
  const lessons = unitLessons(unit.id);
  const dates = lessons.flatMap(lesson => lesson.dates).sort();
  const days = dates.length;
  const delta = days - unit.targetDays;
  return { days, range: dateRange(dates), variance: delta === 0 ? 'On target' : `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} ${delta < 0 ? 'under' : 'over'} target` };
}
function filteredLessons() {
  return course.lessons.filter(lesson => (state.unitFilter === 'all' || lesson.unitId === state.unitFilter) && lesson.title.toLowerCase().includes(state.search.toLowerCase()));
}
function selectUnitMarkup() {
  return `<label class="cp-field cp-grow">Sample unit<select id="unit-selector">${course.units.map(unit => `<option value="${unit.id}"${unit.id === state.unitId ? ' selected' : ''}>${unit.position}. ${h(unit.title)}</option>`).join('')}</select></label>`;
}
function renderSequence() {
  const lessons = filteredLessons();
  const selectedUnits = course.units.filter(unit => state.unitFilter === 'all' || unit.id === state.unitFilter);
  const filters = `<div class="cp-unit-filters" role="group" aria-label="Filter course lessons">${button('All Units', `data-filter="all" aria-pressed="${state.unitFilter === 'all'}"`)}${course.units.map(unit => `<button type="button" class="cp-unit-filter" style="${unitStyle(unit.id)}" data-filter="${unit.id}" aria-pressed="${state.unitFilter === unit.id}"><span class="cp-color-dot"></span><span>${h(unit.title)}<small>${unitLessons(unit.id).length} lessons</small></span></button>`).join('')}</div>`;
  const controls = `<div class="cp-toolbar cp-sequence-toolbar"><label class="cp-field cp-search"><span class="cp-search-label">Find a lesson</span><input id="sequence-search" type="search" placeholder="Search lessons" value="${h(state.search)}"></label><div class="cp-segment" aria-label="Course Sequence presentation">${['table', 'board'].map(view => button(view === 'table' ? 'Table' : 'Board', `data-sequence-view="${view}" aria-pressed="${state.sequenceView === view}"`)).join('')}</div></div><p class="cp-muted cp-scope">Showing ${lessons.length} of ${course.lessons.length} lessons · ${state.unitFilter === 'all' ? 'All units' : h(currentFilterUnit().title)}${state.search ? ' · Search active' : ''}</p>`;
  const statusSelect = lesson => `<select data-status="${lesson.id}" aria-label="Planning status: ${h(lesson.title)}">${options(['Draft', 'In progress', 'Ready'], lesson.status)}</select>`;
  let content;
  if (state.sequenceView === 'table') {
    content = `<table class="cp-table"><caption class="sr-only">Course-wide master lesson record. Status edits are disposable sample changes.</caption><thead><tr><th scope="col">#</th><th scope="col">Lesson title</th><th scope="col">Type</th><th scope="col">Planning status</th><th scope="col">Scheduled</th></tr></thead>${selectedUnits.map(unit => {
      const rows = lessons.filter(lesson => lesson.unitId === unit.id);
      if (!rows.length) return '';
      return `<tbody><tr class="cp-unit-row" style="${unitStyle(unit.id)}"><th colspan="5" scope="rowgroup"><div><span>${unit.position}. ${h(unit.title)} · ${rows.length} lessons</span>${button('Open Unit Plan', `data-open-unit="${unit.id}"`)}</div></th></tr>${rows.map(lesson => `<tr class="cp-lesson-row" data-record-id="${lesson.id}"><td data-label="Sequence">${String(lesson.order).padStart(2, '0')}</td><td data-label="Lesson">${lessonLink(lesson)}${lesson.dates.length > 1 ? '<small>2 instructional days</small>' : ''}</td><td data-label="Type">${badge(lesson.type, lesson.type === 'Assessment' ? 'cp-assessment' : '')}</td><td data-label="Status">${statusSelect(lesson)}</td><td data-label="Scheduled">${dateRange(lesson.dates)}${lesson.pinned ? '<small>◆ Pinned</small>' : lesson.preference ? '<small>↝ Flexible preference</small>' : ''}</td></tr>`).join('')}</tbody>`;
    }).join('')}</table>`;
  } else {
    content = `<div class="cp-board">${selectedUnits.map(unit => {
      const rows = lessons.filter(lesson => lesson.unitId === unit.id);
      if (!rows.length) return '';
      return `<section class="cp-board-unit" style="${unitStyle(unit.id)}"><h5>${unit.position}. ${h(unit.title)}</h5>${button('Open Unit Plan', `data-open-unit="${unit.id}"`)}${rows.map(lesson => `<article class="cp-board-lesson" data-record-id="${lesson.id}"><small>${String(lesson.order).padStart(2, '0')} · ${dateRange(lesson.dates)}${lesson.pinned ? ' · ◆ Pinned' : ''}</small>${lessonLink(lesson)}<div>${badge(lesson.type)}</div>${statusSelect(lesson)}</article>`).join('')}</section>`;
    }).join('')}</div>`;
  }
  return filters + controls + (lessons.length ? content : '<p class="cp-empty">No sample lessons match. Clear the search or choose All Units.</p>') + '<p class="cp-local-note">Try changing a planning status. It updates the same lesson in every workspace, only for this visit.</p>';
}
function currentFilterUnit() { return unitById(state.unitFilter); }
function expandable(key, title, content, initiallyOpen = false) {
  const open = state.openSections[key] ?? initiallyOpen;
  return `<details class="cp-module" data-section="${key}"${open ? ' open' : ''}><summary>${h(title)}<span aria-hidden="true">+</span></summary><div class="cp-module-content">${content}</div></details>`;
}
function editUnitField(unit, field, label) {
  return `<label class="cp-field">${h(label)}<textarea rows="3" data-unit-field="${field}" data-owner="${unit.id}">${h(unit[field])}</textarea></label>`;
}
function renderUnit() {
  const unit = currentUnit(); const stats = planningStats(unit);
  const index = course.units.indexOf(unit);
  const navigation = `<div class="cp-toolbar">${button('← Previous unit', `data-unit-step="-1"${index === 0 ? ' disabled' : ''}`)}${selectUnitMarkup()}${button('Next unit →', `data-unit-step="1"${index === course.units.length - 1 ? ' disabled' : ''}`)}</div>`;
  const overview = `<article class="cp-overview cp-unit-overview" style="${unitStyle(unit.id)}"><span class="cp-eyebrow">UNIT ${unit.position} · PLANNING OVERVIEW</span><h5>${h(unit.title)}</h5><div class="cp-stats"><label class="cp-field">Target days · editable<input type="number" min="1" max="20" data-unit-field="targetDays" data-owner="${unit.id}" value="${unit.targetDays}"></label><div><strong>${stats.days}</strong><span>Planned instructional days</span></div><div><strong>${stats.days}</strong><span>Scheduled lesson days</span></div><div><strong>${h(stats.variance)}</strong><span>Pacing variance · planned − target</span></div></div><p class="cp-muted">${unitLessons(unit.id).length} lessons · ${stats.range}, 2026. A target edit changes this comparison, never the schedule.</p>${editUnitField(unit, 'question', 'Unit Essential Question · owned by this unit')}</article>`;
  const fields = [
    ['purpose', 'Purpose & enduring understandings', editUnitField(unit, 'purpose', 'Purpose / rationale') + editUnitField(unit, 'understandings', 'Enduring understandings')],
    ['outcomes', 'Learning outcomes & sample standards', editUnitField(unit, 'outcomes', 'Priority learning outcomes') + '<p class="cp-muted">Sample standards: ' + unitLessons(unit.id).map(lesson => h(lesson.standard)).join(', ') + '. Fictional curriculum labels, not verified district standards.</p>'],
    ['assessment', 'Assessments & evidence', editUnitField(unit, 'assessment', 'Culminating assessment strategy') + editUnitField(unit, 'formative', 'Formative evidence')],
    ['supports', 'Instructional supports', editUnitField(unit, 'vocabulary', 'Vocabulary') + editUnitField(unit, 'supports', 'Prerequisites, misconceptions & scaffolds')],
    ['texts', 'Core texts & resources', editUnitField(unit, 'texts', 'Illustrative material labels') + '<p class="cp-muted">No live files or external services are connected.</p>'],
    ['notes', 'Unit notes', editUnitField(unit, 'notes', 'Notes')]
  ];
  const connected = `<ul class="cp-connected">${unitLessons(unit.id).map(lesson => `<li data-record-id="${lesson.id}">${lessonLink(lesson)}<span>${dateRange(lesson.dates)} · ${h(lesson.type)}${lesson.dates.length > 1 ? ' · 2 days' : ''}</span></li>`).join('')}</ul>`;
  return navigation + overview + `<div class="cp-modules">${fields.map(([key, title, content]) => expandable(`${unit.id}:${key}`, title, content)).join('')}${expandable(`${unit.id}:connected`, 'Connected lessons', connected, true)}</div><p class="cp-local-note">Unit edits are local sample changes. Essential Questions flow into this unit’s lessons automatically.</p>`;
}
const lessonFields = {
  goals: [['objective', 'Objective'], ['standardText', 'Sample standard description'], ['guidingQuestion', 'Lesson Guiding Question · owned by this lesson']],
  activities: [['activities', 'Instructional activities']], assessment: [['assessment', 'Assessment evidence']],
  differentiation: [['differentiation', 'Differentiation & instructional supports']],
  notes: [['homework', 'Homework'], ['notes', 'Notes'], ['reflection', 'Reflection']]
};
function lessonModuleContent(lesson, name) {
  if (name === 'materials') return `<ul class="cp-materials">${lesson.materials.map(material => `<li>${h(material)}<small>Illustrative material · no file attached</small></li>`).join('')}</ul><p class="cp-muted">Sample labels only. No downloads, uploads, or Google Drive connection.</p>`;
  return (name === 'goals' ? badge(`${lesson.standard} · Sample standard`) : '') + lessonFields[name].map(([field, label]) => `<label class="cp-field">${h(label)}<textarea rows="3" data-lesson-field="${field}" data-owner="${lesson.id}">${h(lesson[field])}</textarea></label>`).join('');
}
function renderLesson() {
  const lesson = currentLesson(); const unit = unitById(lesson.unitId); const index = course.lessons.indexOf(lesson);
  const template = templates[lesson.templateOverride || lesson.baseTemplate];
  const hidden = Object.keys(moduleNames).filter(name => !template.modules.includes(name));
  return `<div class="cp-toolbar">${button('← Previous', `data-lesson-step="-1"${index === 0 ? ' disabled' : ''}`)}<label class="cp-field cp-grow">Select a sample lesson<select id="lesson-selector">${course.units.map(u => `<optgroup label="${h(u.title)}">${unitLessons(u.id).map(l => `<option value="${l.id}"${lesson.id === l.id ? ' selected' : ''}>${l.order}. ${h(l.title)}</option>`).join('')}</optgroup>`).join('')}</select></label>${button('Next →', `data-lesson-step="1"${index === course.lessons.length - 1 ? ' disabled' : ''}`)}</div>
  <article class="cp-overview" style="${unitStyle(unit.id)}" data-lesson-id="${lesson.id}"><span class="cp-eyebrow">${h(unit.title)} · LESSON ${lesson.order}</span><h5>${h(lesson.title)}</h5><div class="cp-meta">${badge(lesson.type)}${badge(lesson.status)}<span>${dateRange(lesson.dates)}, 2026 · ${lesson.dates.length} instructional day${lesson.dates.length > 1 ? 's' : ''} · ${lesson.duration} min/day</span>${lesson.pinned ? badge('◆ Pinned date') : lesson.preference ? badge('↝ Flexible preference') : ''}</div><div class="cp-inherited"><strong>Unit Essential Question <small>Inherited · read-only here</small></strong><p>${h(unit.question)}</p>${button('Open Unit Plan', `data-open-unit="${unit.id}"`)}</div></article>
  <div class="cp-template-bar"><div><strong>${h(template.name)}</strong><p>${lesson.templateOverride ? 'Lesson-specific override' : 'Course-default template at creation'} · fields stay with this lesson</p></div>${button('Customize modules', 'data-template-options="true"')}</div>
  <div class="cp-modules">${template.modules.map(name => expandable(`${lesson.id}:${name}`, moduleNames[name], lessonModuleContent(lesson, name), name === 'goals')).join('')}
  ${hidden.length ? expandable(`${lesson.id}:retained`, `${hidden.length} retained module · content preserved`, hidden.map(name => `<section><h5>${h(moduleNames[name])}</h5>${lessonModuleContent(lesson, name)}</section>`).join('')) : ''}</div>
  <p class="cp-local-note">Edit these fictional fields to explore connected planning. Nothing is saved beyond this page session.</p>`;
}
function dayEvents(date) {
  return [
    ...course.rules.filter(rule => rule.date === date).map(rule => ({ ...rule, kind: 'rule' })),
    ...course.lessons.filter(lesson => lesson.dates.includes(date)).map(lesson => ({ id: lesson.id, date, kind: 'lesson', type: lesson.type, label: lesson.title, pinned: lesson.pinned, unitId: lesson.unitId, continuation: lesson.dates.indexOf(date) > 0 }))
  ];
}
const eventSymbol = event => event.kind === 'rule' ? ({ Closure: '×', 'Flex day': '◇', 'Instructional exception': '!' }[event.type]) : event.pinned ? '◆' : event.type === 'Assessment' ? '◎' : '•';
function dayDetail() {
  const events = dayEvents(state.day);
  const weekend = [0, 6].includes(asDate(state.day).getUTCDay());
  return `<aside class="cp-day-detail"><h5>${fullDate(state.day)}</h5>${events.length ? events.map(event => `<article class="cp-event-detail">${badge(`${eventSymbol(event)} ${event.type}${event.pinned ? ' · Pinned' : ''}`)}${event.kind === 'lesson' ? `<h6>${h(event.label)}</h6><p>${h(unitById(event.unitId).title)}${event.continuation ? ' · Day 2 of 2' : ''}</p>${lessonLink(lessonById(event.id))}` : `<h6>${h(event.label)}</h6><p>${h(event.detail)}</p>`}</article>`).join('') : `<p class="cp-muted">${weekend ? 'Weekend · no teaching capacity in this example.' : 'Open weekday · no sample lesson assigned.'}</p>`}<p class="cp-muted">${course.lessons.length} lessons use ${course.lessons.flatMap(l => l.dates).length} instructional days. Unit targets: ${course.units.reduce((total, u) => total + u.targetDays, 0)} days. Flex and blocked dates are separate calendar rules.</p></aside>`;
}
function renderCalendar() {
  const first = `${state.month}-01`; const start = addDays(first, -asDate(first).getUTCDay());
  const last = new Date(Date.UTC(asDate(first).getUTCFullYear(), asDate(first).getUTCMonth() + 1, 0, 12));
  const cellCount = Math.ceil((asDate(first).getUTCDay() + last.getUTCDate()) / 7) * 7;
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let calendar;
  if (state.calendarView === 'month') {
    calendar = `<div class="cp-month" aria-label="${dateLabel(first, { month: 'long', year: 'numeric' })}"><div class="cp-weekdays">${weekdays.map(day => `<span>${day}</span>`).join('')}</div><div class="cp-month-days">${Array.from({ length: cellCount }, (_, i) => {
      const date = addDays(start, i); const events = dayEvents(date);
      return `<button type="button" class="cp-day${date.slice(0, 7) !== state.month ? ' cp-outside' : ''}" data-day="${date}" aria-pressed="${date === state.day}" aria-label="${h(fullDate(date))}${events.length ? ': ' + h(events.map(e => `${e.type}: ${e.label}${e.pinned ? ', pinned' : ''}`).join('; ')) : ', no events'}"><span class="cp-day-number">${asDate(date).getUTCDate()}</span>${events.map(e => `<span class="cp-event ${e.kind === 'rule' ? 'cp-rule' : ''}"${e.unitId ? ` style="${unitStyle(e.unitId)}"` : ''}><b>${eventSymbol(e)}</b><span>${h(e.label)}${e.continuation ? ' · day 2' : ''}</span></span>`).join('')}</button>`;
    }).join('')}</div></div>`;
  } else {
    const weekStart = addDays(state.day, -asDate(state.day).getUTCDay());
    calendar = `<div class="cp-agenda"><p class="cp-muted">Week of ${dateLabel(weekStart)}–${dateLabel(addDays(weekStart, 6))}</p>${Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i); const events = dayEvents(date);
      return `<button type="button" class="cp-agenda-day" data-day="${date}" aria-pressed="${date === state.day}"><strong>${dateLabel(date, { weekday: 'short', month: 'short', day: 'numeric' })}</strong><span>${events.length ? events.map(e => `${eventSymbol(e)} ${h(e.type)}: ${h(e.label)}${e.pinned ? ' · Pinned' : ''}`).join('<br>') : [0, 6].includes(asDate(date).getUTCDay()) ? 'Weekend' : 'Open weekday'}</span></button>`;
    }).join('')}</div>`;
  }
  return `<div class="cp-toolbar"><div class="cp-calendar-nav">${button('←', 'data-period="-1" aria-label="Previous calendar period"')}<h5>${dateLabel(first, { month: 'long', year: 'numeric' })}</h5>${button('→', 'data-period="1" aria-label="Next calendar period"')}</div><div class="cp-segment" aria-label="Calendar presentation">${['month', 'week'].map(view => button(view === 'month' ? 'Month' : 'Week', `data-calendar-view="${view}" aria-pressed="${state.calendarView === view}"`)).join('')}</div></div>
  <p class="cp-calendar-legend">• Lesson &nbsp; ◎ Assessment &nbsp; × Closure &nbsp; ! Exception &nbsp; ◇ Flex &nbsp; ◆ Pinned<br><span class="cp-muted">Unit colors identify the curriculum. Symbols and labels identify event types.</span></p>
  <div class="cp-calendar-layout">${calendar}${dayDetail()}</div>
  <section class="cp-scenario"><div><span class="cp-eyebrow">SCRIPTED SCHEDULE EXAMPLE</span><h5>What changes when a lesson moves?</h5><p>Try moving “Making the Laws” to Sep 15. Its two following lessons move forward in order, around the Sep 17 testing block. The Sep 11 assessment stays pinned.</p></div><div class="cp-actions">${button('Preview Flexible Move', 'data-schedule="flexible"')}${button('Preview Pin to Date', 'data-schedule="pin"')}${button('Preview new closure & recalculation', 'data-schedule="recalculate"')}</div><p class="cp-muted">Flexible Move is a preference. Pin to Date is a protected commitment. Recalculation adds a fictional Sep 15 closure to demonstrate the difference. This is a bounded example, not a production scheduling engine.</p></section>`;
}
function renderCustomization() {
  const unit = currentUnit();
  document.getElementById('customization-sample').innerHTML = `<label class="cp-field">Course default for new lessons<select id="course-template">${Object.entries(templates).map(([id, template]) => `<option value="${id}"${course.defaultTemplate === id ? ' selected' : ''}>${template.name}</option>`).join('')}</select></label><p class="cp-muted">Changing this sample default leaves all existing lesson plans intact. Each lesson can preview its own override in Lesson Planning.</p><ol class="cp-template-list">${templates[course.defaultTemplate].modules.map(id => `<li>${h(moduleNames[id])}</li>`).join('')}</ol><label class="cp-field">Unit color example<select id="color-unit">${course.units.map(u => `<option value="${u.id}"${u.id === unit.id ? ' selected' : ''}>${h(u.title)}</option>`).join('')}</select></label><div class="cp-swatches" role="group" aria-label="Sample unit color">${Object.keys(colors).map(color => `<button type="button" data-color="${color}" style="--swatch:${colors[color]}" aria-label="${color} unit color" aria-pressed="${unit.color === color}"><span aria-hidden="true">${unit.color === color ? '✓' : ''}</span></button>`).join('')}</div><p class="cp-local-note">Sample choices are not saved. No template library or storage is connected.</p>`;
}
const workspaceInfo = {
  sequence: ['Course Sequence', 'The whole course, in order. One shared lesson record.'],
  unit: ['Unit Planning', 'Define the understanding that connects a unit’s lessons.'],
  lesson: ['Lesson Planning', 'Develop the details of one connected lesson.'],
  calendar: ['Calendar', 'See instructional days, commitments, and the impact of change.']
};
function render(focusSelector, resetScroll = false) {
  const previousScroll = stage.scrollTop;
  document.querySelectorAll('[data-workspace]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.workspace === state.workspace)));
  document.getElementById('workspace-label').textContent = workspaceInfo[state.workspace][0];
  document.getElementById('workspace-purpose').textContent = workspaceInfo[state.workspace][1];
  document.getElementById('course-counts').textContent = `${course.units.length} units · ${course.lessons.length} lessons · ${course.lessons.filter(l => l.type === 'Assessment').length} assessment`;
  stage.innerHTML = ({ sequence: renderSequence, unit: renderUnit, lesson: renderLesson, calendar: renderCalendar })[state.workspace]();
  stage.scrollTop = resetScroll ? 0 : previousScroll;
  document.getElementById('demo-back').hidden = state.history.length === 0;
  renderCustomization();
  document.querySelector('.example-question').textContent = course.units[0].question;
  document.querySelector('.sequence-strips').innerHTML = course.units.map(unit => `<i style="background:${colors[unit.color]}" aria-label="${h(unit.title)}"></i>`).join('');
  if (focusSelector) document.querySelector(focusSelector)?.focus({ preventScroll: true });
}
function navigate(workspace, lessonId, unitId) {
  if (state.workspace !== workspace) state.history.push({ workspace: state.workspace, lessonId: state.lessonId, unitId: state.unitId, scroll: stage.scrollTop });
  state.workspace = workspace;
  if (lessonId) { state.lessonId = lessonId; state.unitId = lessonById(lessonId).unitId; }
  if (unitId) state.unitId = unitId;
  render('#workspace-label', true);
  announce(`${workspaceInfo[workspace][0]} opened.`);
}
// All scheduling proposals are pure: no records or rules change until Confirm.
function makeScheduleProposal(action) {
  const extraClosure = { id: 'rule-demo-closure', date: '2026-09-15', type: 'Closure', label: 'New sample closure', detail: 'Added only after confirming the scripted recalculation.', unavailable: true };
  const rules = course.rules.map(rule => ({ ...rule }));
  if (action === 'recalculate' && !rules.some(rule => rule.id === extraClosure.id)) rules.push(extraClosure);
  const rows = course.lessons.map(lesson => ({ id: lesson.id, dates: [...lesson.dates], pinned: lesson.pinned, preference: lesson.preference }));
  const mover = rows.find(row => row.id === 'lesson-laws');
  if (action === 'flexible') { mover.pinned = false; mover.preference = '2026-09-15'; }
  if (action === 'pin') { mover.pinned = true; mover.preference = null; mover.dates = ['2026-09-15']; }
  const conflicts = [];
  const blocked = date => [0, 6].includes(asDate(date).getUTCDay()) || rules.some(rule => rule.date === date && rule.unavailable);
  let cursor = '2026-09-14';
  for (const row of rows.filter(row => ['lesson-laws', 'lesson-executive', 'lesson-courts'].includes(row.id))) {
    if (row.pinned) {
      const date = row.dates[0];
      if (blocked(date)) conflicts.push(`${lessonById(row.id).title} is pinned to ${dateLabel(date)}, which is blocked. Cancel this proposal; it cannot overwrite the pin or closure.`);
      if (date < cursor) conflicts.push('The protected date conflicts with the course lesson order. No changes can be applied.');
      cursor = addDays(date, 1);
    } else {
      let date = row.preference && row.preference > cursor ? row.preference : cursor;
      while (blocked(date)) date = addDays(date, 1);
      row.dates = [date]; cursor = addDays(date, 1);
    }
  }
  const affected = rows.filter(row => { const old = lessonById(row.id); return old.dates.join() !== row.dates.join() || old.pinned !== row.pinned || old.preference !== row.preference || (row.pinned && rules.some(rule => rule.date === row.dates[0] && rule.unavailable)); });
  return { type: 'schedule', action, rows, rules, affected, conflicts };
}
function openDialog(pending, html) {
  state.pending = pending;
  dialog.innerHTML = html;
  dialog.showModal();
  // Begin a long preview at its heading, rather than scrolling to its action buttons.
  const heading = dialog.querySelector('#dialog-title');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  dialog.scrollTop = 0;
}
function showSchedule(action) {
  const plan = makeScheduleProposal(action);
  const title = { flexible: 'Preview a flexible date move', pin: 'Preview Pin to Date', recalculate: 'Preview a new closure & recalculation' }[action];
  openDialog(plan, `<div class="cp-dialog-body cp-schedule-body"><span class="cp-eyebrow">INTERACTIVE SCHEDULE EXAMPLE</span><h4 id="dialog-title">${title}</h4><p class="cp-schedule-lead">${action === 'flexible' ? 'Sep 15 is a flexible preference for Making the Laws. It may move again when the sample schedule changes.' : action === 'pin' ? 'Protect Making the Laws on Sep 15. This pinned commitment stays fixed during recalculation.' : 'Preview a full-day Sep 15 closure. Flexible lessons may move; a protected pin must be resolved first.'}</p>
  <dl class="cp-preview-summary"><div><dt>Affected lessons</dt><dd>${plan.affected.length}</dd></div><div${plan.conflicts.length ? ' class="cp-summary-conflict"' : ''}><dt>Conflicts</dt><dd>${plan.conflicts.length}</dd></div><div><dt>Unscheduled</dt><dd>0</dd></div></dl>
  ${plan.conflicts.length ? `<section class="cp-conflict-section" aria-labelledby="conflicts-title"><h5 id="conflicts-title">Resolve before confirming</h5>${plan.conflicts.map(conflict => `<p class="cp-conflict" role="alert">${h(conflict)}</p>`).join('')}</section>` : ''}
  <section class="cp-proposed-section" aria-labelledby="proposed-title"><h5 id="proposed-title">Proposed lesson dates</h5><ul class="cp-impact">${plan.affected.map(row => { const old = lessonById(row.id); return `<li><strong>${h(old.title)}</strong><div class="cp-date-comparison"><div><span>Before</span><b>${dateRange(old.dates)}</b></div><span class="cp-date-arrow" aria-hidden="true">→</span><div><span>Proposed</span><b>${dateRange(row.dates)}</b></div></div><small>${row.pinned ? '◆ Protected pin' : row.preference ? `↝ Flexible preference: ${dateLabel(row.preference)}` : 'Follows the course sequence'}${old.pinned && !row.pinned ? ' · Existing pin explicitly removed by Flexible Move' : ''}</small></li>`; }).join('') || '<li>No lesson dates change in this proposal.</li>'}</ul></section>
  <section class="cp-constraint" aria-labelledby="constraints-title"><h5 id="constraints-title">Protected commitments & teaching days</h5><ul class="cp-fixed-dates">${plan.rows.filter(r => r.pinned).map(r => `<li><span>◆ ${h(lessonById(r.id).title)}</span><strong>${dateRange(r.dates)}</strong></li>`).join('')}</ul><p><strong>Unavailable:</strong> Sep 7 closure · Sep 17 testing block · Sep 4 reserved flex day · weekends.</p><p>Lesson order stays unchanged. The affected lessons use one day each; the earlier two-day workshop stays intact.</p>${action === 'recalculate' ? `<p>${plan.conflicts.length ? 'The proposed Sep 15 closure conflicts with a protected pin. Nothing can be confirmed until that conflict is resolved.' : 'The proposed Sep 15 closure prevents the flexible preference. Lessons move to the next available teaching days.'}</p>` : ''}</section>
  <p class="cp-preview-disclosure">${plan.conflicts.length ? 'Proposal blocked. Cancel to keep the current sample schedule.' : 'Confirm applies these changes to the example only. Sample changes are not saved.'}</p></div><div class="cp-dialog-actions">${button('Cancel', 'data-cancel="true"')}${button('Confirm sample change', `data-confirm="true"${plan.conflicts.length ? ' disabled' : ''}`, 'cp-primary')}</div>`);
}
function showTemplateOptions() {
  const lesson = currentLesson();
  openDialog({ type: 'template-options' }, `<div class="cp-dialog-body"><h4 id="dialog-title">A template changes the arrangement</h4><p>These templates are local examples. The course default for future lessons is ${h(templates[course.defaultTemplate].name)}. Existing lesson fields remain attached to their original record.</p>${Object.entries(templates).map(([id, template]) => `<section class="cp-template-choice"><h5>${h(template.name)}</h5><p>${template.modules.map(name => h(moduleNames[name])).join(' · ')}</p>${button('Preview ' + template.name, `data-template-preview="${id}"`)}</section>`).join('')}<p class="cp-muted">This lesson started with ${h(templates[lesson.baseTemplate].name)}. Discussion focus places Assessment earlier and retains Differentiation in a collapsed “content preserved” section.</p></div><div class="cp-dialog-actions">${button('Cancel', 'data-cancel="true"')}</div>`);
}
function showTemplatePreview(templateId) {
  const lesson = currentLesson(); const target = templates[templateId];
  state.pending = { type: 'template', lessonId: lesson.id, templateId };
  dialog.innerHTML = `<div class="cp-dialog-body"><h4 id="dialog-title">Preview ${h(target.name)}</h4><p>Apply to “${h(lesson.title)}” only. All authored fields remain unchanged.</p><p><strong>Before:</strong> ${h(templates[lesson.templateOverride || lesson.baseTemplate].name)}<br><strong>After:</strong> ${h(target.name)}</p><ol class="cp-template-list">${target.modules.map(id => `<li>${h(moduleNames[id])}</li>`).join('')}</ol><p>${templateId === 'discussion' ? 'Assessment moves before activities. Differentiation remains available under “retained module · content preserved.”' : 'All six modules are visible in the course’s original arrangement.'}</p><p class="cp-local-note">Only this lesson’s presentation changes. The course default and other lessons are untouched.</p></div><div class="cp-dialog-actions">${button('Cancel', 'data-cancel="true"')}${button('Apply sample template', 'data-confirm="true"', 'cp-primary')}</div>`;
  dialog.querySelector('[data-cancel]').focus();
}
function closeDialog() { state.pending = null; dialog.close(); }
dialog.addEventListener('cancel', () => { state.pending = null; });
// Capture each native details toggle independently, including when several remain open.
stage.addEventListener('toggle', event => {
  if (event.target.matches('details[data-section]') && event.target.isConnected) state.openSections[event.target.dataset.section] = event.target.open;
}, true);
document.addEventListener('click', event => {
  const b = event.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.workspace) { navigate(d.workspace); return; }
  if (b.id === 'demo-back') {
    const previous = state.history.pop(); if (!previous) return;
    Object.assign(state, { workspace: previous.workspace, unitId: previous.unitId, lessonId: previous.lessonId });
    render('#workspace-label'); stage.scrollTop = previous.scroll; return;
  }
  if (d.openLesson) { navigate('lesson', d.openLesson); return; }
  if (d.openUnit) { navigate('unit', null, d.openUnit); return; }
  if (d.filter) { state.unitFilter = state.unitFilter === d.filter ? 'all' : d.filter; render(`[data-filter="${d.filter}"]`, true); return; }
  if (d.sequenceView) { state.sequenceView = d.sequenceView; render(`[data-sequence-view="${d.sequenceView}"]`, true); return; }
  if (d.unitStep) { state.unitId = course.units[course.units.indexOf(currentUnit()) + Number(d.unitStep)].id; render(`[data-unit-step="${d.unitStep}"]`, true); return; }
  if (d.lessonStep) { const lesson = course.lessons[course.lessons.indexOf(currentLesson()) + Number(d.lessonStep)]; state.lessonId = lesson.id; state.unitId = lesson.unitId; render(`[data-lesson-step="${d.lessonStep}"]`, true); return; }
  if (d.calendarView) { state.calendarView = d.calendarView; render(`[data-calendar-view="${d.calendarView}"]`, true); return; }
  if (d.day) {
    state.day = d.day; state.month = d.day.slice(0, 7); render(`[data-day="${d.day}"]`);
    if (matchMedia('(max-width: 760px)').matches) stage.querySelector('.cp-day-detail').scrollIntoView({ block: 'nearest', behavior: 'instant' });
    announce(fullDate(state.day) + ': ' + (dayEvents(state.day).map(e => e.label).join(', ') || 'No sample events.')); return;
  }
  if (d.period) {
    if (state.calendarView === 'week') state.day = addDays(state.day, Number(d.period) * 7);
    else { const date = asDate(state.month + '-01'); date.setUTCMonth(date.getUTCMonth() + Number(d.period)); state.day = isoDate(date); }
    state.month = state.day.slice(0, 7); render(`[data-period="${d.period}"]`, true); return;
  }
  if (d.schedule) { showSchedule(d.schedule); return; }
  if (d.templateOptions) { showTemplateOptions(); return; }
  if (d.templatePreview) { showTemplatePreview(d.templatePreview); return; }
  if (d.cancel) { closeDialog(); announce('Canceled. Sample records are unchanged.'); return; }
  if (d.confirm) {
    const pending = state.pending;
    if (pending?.type === 'schedule' && !pending.conflicts.length) {
      pending.rows.forEach(row => Object.assign(lessonById(row.id), { dates: [...row.dates], pinned: row.pinned, preference: row.preference }));
      course.rules = pending.rules; state.day = lessonById('lesson-laws').dates[0]; state.month = state.day.slice(0, 7);
    } else if (pending?.type === 'template') {
      const lesson = lessonById(pending.lessonId); lesson.templateOverride = pending.templateId === lesson.baseTemplate ? null : pending.templateId;
    } else return;
    closeDialog(); render('#workspace-label'); announce('Sample change applied locally. Not saved.'); return;
  }
  if (d.color) { currentUnit().color = d.color; render(`[data-color="${d.color}"]`); announce('Sample unit color changed. Not saved.'); }
});
document.addEventListener('change', event => {
  const input = event.target; const d = input.dataset;
  if (d.status) { lessonById(d.status).status = input.value; announce('Planning status changed in this sample only.'); }
  else if (d.unitField) {
    const unit = unitById(d.owner);
    if (d.unitField === 'targetDays') {
      if (!input.checkValidity() || !input.value) { input.reportValidity(); input.value = unit.targetDays; return; }
      unit.targetDays = Number(input.value); render('[data-unit-field="targetDays"]');
    } else unit[d.unitField] = input.value;
    announce('Unit field updated locally. Lesson context stays connected.');
  } else if (d.lessonField) { lessonById(d.owner)[d.lessonField] = input.value; announce('Lesson field updated locally. Not saved.'); }
  else if (input.id === 'unit-selector') { state.unitId = input.value; render('#unit-selector', true); }
  else if (input.id === 'lesson-selector') { state.lessonId = input.value; state.unitId = currentLesson().unitId; render('#lesson-selector', true); }
  else if (input.id === 'course-template') { course.defaultTemplate = input.value; renderCustomization(); document.getElementById('course-template').focus({ preventScroll: true }); announce('Sample default changed for future lessons. Existing lessons are unchanged.'); }
  else if (input.id === 'color-unit') { state.unitId = input.value; render('#color-unit'); }
});
document.addEventListener('input', event => {
  if (event.target.id !== 'sequence-search') return;
  const caret = event.target.selectionStart; state.search = event.target.value;
  render('#sequence-search');
  // Search inputs do not support setSelectionRange consistently; focus and value are preserved.
  if (caret !== null) document.getElementById('sequence-search').focus({ preventScroll: true });
});
document.getElementById('year').textContent = new Date().getFullYear();
render();

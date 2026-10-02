import ApiService from '../../services/apiService.js';
import AuthComponent from '../../components/authComponent.js';
import Navbar from '../../components/navbar.js';
import NotificationBanner from '../../components/notificationBanner.js';
import { navigateTo } from '../../utils/navigationUtils.js';
import { setFavicon } from '../../utils/faviconUtils.js';

const element = id => document.getElementById(id);
const svgNamespace = 'http://www.w3.org/2000/svg';

function localDay(timezone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date()).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function cell(value) {
    const td = document.createElement('td');
    td.textContent = value ?? '—';
    return td;
}

function emptyTable(body, columns, message) {
    const row = document.createElement('tr');
    const td = cell(message);
    td.colSpan = columns;
    row.append(td);
    body.append(row);
}

class ActivityPage {
    constructor() {
        this.api = new ApiService();
        this.auth = new AuthComponent(this.api);
        this.navbar = new Navbar();
        this.report = null;
        this.studentId = null;
        this.generation = 0;
        this.detailGeneration = 0;
        this.currentView = 'overview';
        this.init().catch(error => this.status(error.message, true));
    }

    async init() {
        const authenticated = await this.auth.checkAuth();
        if (authenticated === null) return;
        if (!authenticated) return navigateTo('login.html');
        if (!this.auth.isAdmin()) return navigateTo('languages.html');
        window.authComponent = this.auth;
        setFavicon();
        element('navbar-container').innerHTML = this.navbar.render({ showBack: true, backText: 'back',
            backUrl: 'admin/index.html', workspaceIndicator: '[admin]', appTitle: 'Student activity', isAdminPage: true });
        document.querySelector('.activity-page').hidden = false;
        await this.navbar.init(this.auth);
        new NotificationBanner().init().catch(console.warn);
        const filters = await this.api._get('/api/admin/activity/filters');
        this.filters = filters;
        for (const language of filters.languages) this.option('activity-language', language.id, language.name);
        const zones = new Set([filters.timezone, 'Europe/Brussels', 'UTC', Intl.DateTimeFormat().resolvedOptions().timeZone]);
        for (const zone of zones) this.option('activity-timezone', zone, zone);
        element('activity-timezone').value = filters.timezone;
        this.updateChapters();
        this.setPeriod();
        const views = ['overview', 'students', 'exercises'];
        for (const [index, view] of views.entries()) {
            const tab = element(`activity-tab-${view}`);
            tab.addEventListener('click', () => this.showView(view));
            tab.addEventListener('keydown', event => {
                let target;
                if (event.key === 'ArrowRight') target = views[(index + 1) % views.length];
                if (event.key === 'ArrowLeft') target = views[(index + views.length - 1) % views.length];
                if (event.key === 'Home') target = views[0];
                if (event.key === 'End') target = views[views.length - 1];
                if (target) { event.preventDefault(); this.showView(target, true); }
            });
        }
        element('activity-back-students').addEventListener('click', () => this.showStudentList());
        element('activity-filters').addEventListener('submit', event => { event.preventDefault(); this.load(); });
        element('activity-period').addEventListener('change', () => { this.setPeriod(); this.load(); });
        for (const id of ['activity-start', 'activity-end']) element(id).addEventListener('change', () => {
            element('activity-period').value = 'custom';
        });
        element('activity-language').addEventListener('change', () => { this.updateChapters(); this.load(); });
        element('activity-chapter').addEventListener('change', () => this.load());
        element('activity-archived').addEventListener('change', () => this.load());
        element('activity-timezone').addEventListener('change', () => { this.setPeriod(); this.load(); });
        element('activity-search').addEventListener('input', () => this.renderStudents());
        element('activity-sort').addEventListener('change', () => this.renderStudents());
        await this.load();
    }

    option(id, value, label) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        element(id).append(option);
    }

    updateChapters() {
        const language = element('activity-language').value;
        element('activity-chapter').replaceChildren();
        this.option('activity-chapter', '', 'All chapters');
        for (const chapter of this.filters.chapters.filter(c => !language || c.language_id === language)) {
            const languageName = this.filters.languages.find(l => l.id === chapter.language_id)?.name;
            this.option('activity-chapter', chapter.id, `${languageName}: ${chapter.name}`);
        }
    }

    setPeriod() {
        const period = element('activity-period').value;
        if (period === 'custom') return;
        const end = localDay(element('activity-timezone').value);
        element('activity-end').value = end;
        element('activity-start').value = new Date(Date.parse(`${end}T00:00:00Z`) - (Number(period) - 1) * 86400000)
            .toISOString().slice(0, 10);
    }

    query() {
        return new URLSearchParams({ start: element('activity-start').value, end: element('activity-end').value,
            timezone: element('activity-timezone').value, language: element('activity-language').value,
            chapter: element('activity-chapter').value, includeArchived: String(element('activity-archived').checked) });
    }

    status(message, error = false) {
        element('activity-status').textContent = message;
        element('activity-status').classList.toggle('activity-error', error);
    }

    showView(view, focus = false) {
        this.currentView = view;
        for (const name of ['overview', 'students', 'exercises']) {
            const selected = name === view;
            element(`activity-view-${name}`).hidden = !selected;
            const tab = element(`activity-tab-${name}`);
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        }
        if (focus) element(`activity-tab-${view}`).focus();
    }

    reveal(section, heading) {
        heading.focus({ preventScroll: true });
        section.scrollIntoView({ block: 'start',
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }

    showStudentList() {
        const selected = this.studentId;
        this.studentId = null;
        ++this.detailGeneration;
        element('activity-detail').hidden = true;
        element('activity-student-list').hidden = false;
        const focus = element(`activity-student-${selected}`) || element('activity-search');
        this.reveal(element('activity-student-list'), focus);
    }

    async load() {
        if (!element('activity-filters').reportValidity()) return;
        const days = (Date.parse(element('activity-end').value) - Date.parse(element('activity-start').value)) / 86400000 + 1;
        if (!Number.isFinite(days) || days < 1 || days > 366) {
            this.status('Choose a date range of 1 to 366 days.', true);
            return;
        }
        const generation = ++this.generation;
        ++this.detailGeneration;
        element('activity-detail').hidden = true;
        element('activity-student-list').hidden = false;
        this.status('Loading activity…');
        try {
            const query = this.query().toString();
            const report = await this.api._get(`/api/admin/activity?${query}`);
            if (generation !== this.generation) return;
            this.report = report;
            this.reportQuery = query;
            const language = this.filters.languages.find(l => l.id === element('activity-language').value)?.name || 'All languages';
            const chapter = this.filters.chapters.find(c => c.id === element('activity-chapter').value)?.name;
            this.status(`${report.range.start} → ${report.range.end} · ${language}${chapter ? ` / ${chapter}` : ''} · ${element('activity-archived').checked ? 'Including archived students' : 'Current students'} · ${report.range.timezone}`);
            element('activity-history').textContent = report.historyStartsAt
                ? `Recorded submission history begins ${this.date(report.historyStartsAt)}. Earlier practice cannot be reconstructed; first completions use existing progress records. Exercise filters use the current chapter and language assignments.`
                : 'No submissions have been recorded yet. Activity will appear as students run exercises; existing progress is preserved.';
            const summary = element('activity-summary');
            summary.replaceChildren();
            for (const [key, label] of [['activeStudents', 'Active students'], ['submissions', 'Submissions'],
                ['firstCompletions', 'First completions'], ['configurationErrors', 'Configuration errors']]) {
                const card = document.createElement('div');
                const number = document.createElement('strong');
                number.textContent = report.summary[key];
                const text = document.createElement('span');
                text.textContent = label;
                card.append(number, text);
                summary.append(card);
            }
            this.renderChart(report.daily);
            this.renderCalendar('activity-calendar', report.daily, {
                interactive: true, readoutId: 'activity-calendar-selection'
            });
            this.renderStudents();
            const exercises = element('activity-exercises');
            exercises.replaceChildren();
            for (const ex of report.exercises) {
                const row = document.createElement('tr');
                for (const value of [ex.title, ex.language, ex.activeStudents, ex.submissions, ex.passed,
                    ex.firstCompletions, ex.configurationErrors]) row.append(cell(value));
                exercises.append(row);
            }
            if (!report.exercises.length) emptyTable(exercises, 7, 'No exercise activity in this date range.');
            if (this.studentId !== null) {
                if (report.students.some(student => student.id === this.studentId)) {
                    await this.loadStudent(this.studentId, false);
                } else {
                    this.studentId = null;
                }
            }
        } catch (error) {
            if (generation === this.generation) this.status(`Could not load activity: ${error.message}. Previously loaded results remain below.`, true);
        }
    }

    date(value) {
        if (!value) return '—';
        return new Intl.DateTimeFormat('en-GB', { timeZone: this.report.range.timezone,
            dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    }

    renderCalendar(containerId, days, { interactive = false, readoutId = null } = {}) {
        const container = element(containerId);
        container.replaceChildren();
        if (!days.length) return;
        const months = document.createElement('div');
        months.className = 'activity-calendar-months';
        const body = document.createElement('div');
        body.className = 'activity-calendar-body';
        const weekdays = document.createElement('div');
        weekdays.className = 'activity-calendar-weekdays';
        for (const name of ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']) {
            const label = document.createElement('span');
            label.textContent = name;
            weekdays.append(label);
        }
        const heatmap = document.createElement('div');
        heatmap.className = 'activity-heatmap';
        const offset = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
        for (let index = 0; index < offset; index++) heatmap.append(document.createElement('span'));
        const maximum = Math.max(1, ...days.map(day => day.exercisesPracticed));
        let previousMonth = null;
        let previousMonthLabel = null;
        days.forEach((day, index) => {
            const month = day.date.slice(0, 7);
            if (month !== previousMonth) {
                const label = document.createElement('span');
                label.className = 'activity-calendar-month';
                label.style.gridColumn = String(Math.floor((index + offset) / 7) + 1);
                label.textContent = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' })
                    .format(new Date(`${day.date}T00:00:00Z`));
                if (previousMonthLabel?.style.gridColumn === label.style.gridColumn) {
                    previousMonthLabel.textContent += `/${label.textContent}`;
                } else {
                    months.append(label);
                    previousMonthLabel = label;
                }
                previousMonth = month;
            }
            const square = document.createElement(interactive ? 'button' : 'span');
            square.className = 'activity-day';
            square.dataset.level = String(day.exercisesPracticed === 0 ? 0 : Math.ceil(day.exercisesPracticed / maximum * 4));
            square.tabIndex = 0;
            const description = `${day.date}: ${day.exercisesPracticed} exercises practiced across ${day.activeStudents} students, ${day.submissions} submissions, ${day.firstCompletions} first completions, ${day.configurationErrors} configuration errors`;
            square.title = description;
            square.setAttribute('aria-label', description);
            if (readoutId) {
                const describe = () => { element(readoutId).textContent = description; };
                square.addEventListener('mouseenter', describe);
                square.addEventListener('focus', describe);
            }
            if (interactive) {
                square.type = 'button';
                square.addEventListener('click', () => {
                    element('activity-period').value = 'custom';
                    element('activity-start').value = day.date;
                    element('activity-end').value = day.date;
                    this.load();
                });
            } else square.setAttribute('role', 'img');
            heatmap.append(square);
        });
        body.append(weekdays, heatmap);
        container.append(months, body);
    }

    renderChart(days) {
        const width = Math.max(850, days.length * 15 + 60);
        const maximum = Math.max(1, ...days.map(day => Math.max(day.submissions, day.activeStudents, day.firstCompletions)));
        const svg = document.createElementNS(svgNamespace, 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} 260`);
        svg.style.width = `${width}px`;
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Daily submissions, active students, and first completions. Exact values are available in each bar tooltip.');
        const add = (tag, attributes, text) => {
            const node = document.createElementNS(svgNamespace, tag);
            for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
            if (text !== undefined) node.textContent = text;
            svg.append(node);
            return node;
        };
        for (let step = 0; step <= 4; step++) {
            const y = 220 - step * 48;
            add('line', { x1: 40, x2: width - 10, y1: y, y2: y, class: 'axis' });
            add('text', { x: 32, y: y + 4, 'text-anchor': 'end' }, Math.round(maximum * step / 4));
        }
        const groupWidth = (width - 60) / days.length;
        days.forEach((day, index) => {
            const label = `${day.date}: ${day.submissions} submissions, ${day.activeStudents} active students, ${day.firstCompletions} first completions, ${day.configurationErrors} configuration errors`;
            for (const [series, key] of [['runs', 'submissions'], ['students', 'activeStudents'], ['completions', 'firstCompletions']]) {
                const seriesIndex = ['runs', 'students', 'completions'].indexOf(series);
                const height = day[key] / maximum * 192;
                const bar = add('rect', { x: 40 + index * groupWidth + seriesIndex * groupWidth / 3,
                    y: 220 - height, width: Math.max(1, groupWidth / 3 - 1), height: Math.max(1, height), class: series });
                const title = document.createElementNS(svgNamespace, 'title');
                title.textContent = label;
                bar.append(title);
            }
            if (index % Math.max(1, Math.ceil(days.length / 12)) === 0) {
                add('text', { x: 40 + index * groupWidth, y: 245 }, day.date.slice(5));
            }
        });
        element('activity-chart').replaceChildren(svg);
    }

    renderStudents() {
        if (!this.report) return;
        const search = element('activity-search').value.toLowerCase();
        const sort = element('activity-sort').value;
        const students = this.report.students.filter(s => `${s.name} ${s.email}`.toLowerCase().includes(search));
        students.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name)
            : sort === 'lastSubmission' ? (b.lastSubmission || '').localeCompare(a.lastSubmission || '')
                : b[sort] - a[sort] || a.name.localeCompare(b.name));
        const body = element('activity-students');
        element('activity-student-count').textContent = `${students.length} of ${this.report.students.length}`;
        body.replaceChildren();
        for (const student of students) {
            const row = document.createElement('tr');
            const name = cell('');
            const button = document.createElement('button');
            button.className = 'activity-student-button';
            button.textContent = `${student.name}${student.archived ? ' (archived)' : ''}`;
            button.addEventListener('click', () => this.loadStudent(student.id));
            const email = document.createElement('small');
            email.textContent = student.email;
            name.append(button, email);
            row.append(name);
            for (const value of [student.practiceDays, student.submissions, student.exercisesAttempted,
                student.completed, student.configurationErrors, this.date(student.lastSubmission)]) row.append(cell(value));
            const view = document.createElement('button');
            view.type = 'button';
            view.id = `activity-student-${student.id}`;
            view.className = 'activity-view-student';
            view.textContent = 'View activity →';
            view.setAttribute('aria-label', `View activity for ${student.name}`);
            view.addEventListener('click', () => this.loadStudent(student.id));
            name.append(view);
            body.append(row);
        }
        if (!students.length) emptyTable(body, 7, 'No students match these filters.');
    }

    async loadStudent(id, reveal = true) {
        this.studentId = id;
        const generation = ++this.detailGeneration;
        const query = this.reportQuery;
        if (reveal) this.showView('students');
        element('activity-detail').hidden = false;
        element('activity-student-list').hidden = true;
        const student = this.report.students.find(s => s.id === id);
        element('detail-heading').textContent = `${student?.name || 'Student detail'}${student?.archived ? ' (archived)' : ''}`;
        element('activity-student-email').textContent = student?.email || '';
        element('activity-detail-status').textContent = 'Loading student activity…';
        element('activity-student-summary').replaceChildren();
        element('activity-heatmap').replaceChildren();
        element('activity-timeline').replaceChildren();
        if (reveal) this.reveal(element('activity-detail'), element('detail-heading'));
        try {
            const detail = await this.api._get(`/api/admin/activity/students/${encodeURIComponent(id)}?${query}`);
            if (generation !== this.detailGeneration) return;
            element('activity-detail-status').textContent = `${detail.students[0].practiceDays} practice days · ${detail.students[0].exercisesAttempted} exercises attempted`;
            for (const [key, label] of [['practiceDays', 'Practice days'], ['exercisesAttempted', 'Exercises attempted'],
                ['submissions', 'Submissions'], ['completed', 'First completions']]) {
                const card = document.createElement('div');
                const number = document.createElement('strong');
                number.textContent = detail.students[0][key];
                const text = document.createElement('span');
                text.textContent = label;
                card.append(number, text);
                element('activity-student-summary').append(card);
            }
            this.renderCalendar('activity-heatmap', detail.daily);
            const timeline = element('activity-timeline');
            for (const attempt of detail.timeline) {
                const row = document.createElement('tr');
                const outcome = attempt.passed ? 'Passed' : (attempt.failure_category || 'Failed').replaceAll('_', ' ');
                for (const value of [this.date(attempt.created_at), attempt.title, outcome,
                    `${(attempt.runtime_ms / 1000).toFixed(1)} s`, attempt.failed_test_number]) row.append(cell(value));
                timeline.append(row);
            }
            if (!detail.timeline.length) emptyTable(timeline, 5, 'No submissions in this date range.');
        } catch (error) {
            if (generation === this.detailGeneration) element('activity-detail-status').textContent = `Could not load student activity: ${error.message}`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new ActivityPage());

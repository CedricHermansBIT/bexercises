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
        this.status('Loading activity…');
        try {
            const query = this.query().toString();
            const report = await this.api._get(`/api/admin/activity?${query}`);
            if (generation !== this.generation) return;
            this.report = report;
            this.reportQuery = query;
            this.status(`Showing ${report.range.start} through ${report.range.end} in ${report.range.timezone}.`);
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
            if (this.studentId !== null) await this.loadStudent(this.studentId);
        } catch (error) {
            if (generation === this.generation) this.status(`Could not load activity: ${error.message}. Previously loaded results remain below.`, true);
        }
    }

    date(value) {
        if (!value) return '—';
        return new Intl.DateTimeFormat('en-GB', { timeZone: this.report.range.timezone,
            dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
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
            body.append(row);
        }
        if (!students.length) emptyTable(body, 7, 'No students match these filters.');
    }

    async loadStudent(id) {
        this.studentId = id;
        const generation = ++this.detailGeneration;
        const query = this.reportQuery;
        element('activity-detail').hidden = false;
        element('detail-heading').textContent = this.report.students.find(s => s.id === id)?.name || 'Student detail';
        element('activity-detail-status').textContent = 'Loading student activity…';
        element('activity-heatmap').replaceChildren();
        element('activity-timeline').replaceChildren();
        try {
            const detail = await this.api._get(`/api/admin/activity/students/${encodeURIComponent(id)}?${query}`);
            if (generation !== this.detailGeneration) return;
            element('activity-detail-status').textContent = `${detail.students[0].practiceDays} practice days · ${detail.students[0].exercisesAttempted} exercises attempted`;
            const heatmap = element('activity-heatmap');
            const offset = (new Date(`${detail.range.start}T00:00:00Z`).getUTCDay() + 6) % 7;
            for (let index = 0; index < offset; index++) heatmap.append(document.createElement('span'));
            for (const day of detail.daily) {
                const square = document.createElement('span');
                const practice = day.submissions - day.configurationErrors;
                square.className = 'activity-day';
                square.dataset.level = practice === 0 ? '0' : practice < 3 ? '1' : practice < 8 ? '2' : '3';
                square.tabIndex = 0;
                square.title = `${day.date}: ${practice} practice submissions, ${day.configurationErrors} configuration errors, ${day.firstCompletions} first completions`;
                square.setAttribute('role', 'img');
                square.setAttribute('aria-label', square.title);
                heatmap.append(square);
            }
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

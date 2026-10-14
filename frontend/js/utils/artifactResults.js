function escaped(value) {
	return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;',
		'>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function valueText(value) {
	if (value == null) return '(missing)';
	const text = typeof value === 'string' ? value : JSON.stringify(value);
	return escaped(text.length > 300 ? text.slice(0, 300) + '…' : text);
}

function previewHTML(preview, label) {
	if (!preview) return `<div><strong>${label}</strong><p>No preview available.</p></div>`;
	if (Array.isArray(preview.pages)) {
        return `<div><strong>${label}</strong><p>${escaped(preview.totalPages)} page(s)</p>${preview.pages.map(page =>
            `<p>${escaped(page.name)}</p>${previewHTML({png:page.png, width:undefined, height:undefined}, label)}<p>${escaped(page.text)}</p>`).join('')}
            ${preview.totalPages > preview.pages.length ? '<small>Preview shows the first three pages; all pages are graded.</small>' : ''}</div>`;
    }
	if (preview.png && /^[A-Za-z0-9+/=]+$/.test(preview.png) && preview.png.length <= 90000) {
		return `<div><strong>${label}</strong>${preview.width && preview.height ? `<p>${escaped(preview.width)} × ${escaped(preview.height)} pixels</p>` : ''}
			<img src="data:image/png;base64,${preview.png}" alt="${label} image" width="256"
				style="max-width:100%;height:auto;image-rendering:pixelated;background:#ddd;">
			<p><small>Preview scaled to fit; grading uses the full image.</small></p></div>`;
	}
	return `<div><strong>${label}</strong>${(preview.tables || []).map(table => `
		<p>${escaped(table.name)} — ${escaped(table.totalRows)} ${label === 'Expected' ? 'expected' : 'actual'} rows/cells</p>
		<div style="overflow-x:auto"><table class="artifact-table"><thead><tr>${(table.columns || []).map(column => `<th>${escaped(column)}</th>`).join('')}</tr></thead>
		<tbody>${(table.rows || []).map(row => `<tr>${row.map(cell => `<td>${escaped(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
		${table.totalRows > table.rows.length ? '<small>Showing the first 20 rows/cells; all checked data is graded.</small>' : ''}`).join('')}</div>`;
}

export function renderArtifactFeedback(artifact) {
	if (!artifact) return '';
	return `<div class="artifact-feedback">
		<p><strong>${escaped(({ xlsx: 'Spreadsheet cells', sqlite: 'Database query results', image: 'Image pixels', docx: 'Word content', pdf: 'PDF pages and text', plot: 'Plot appearance' })[artifact.kind] || artifact.kind)}</strong>
			— ${artifact.totalDifferences === 0 ? 'Match' : `${escaped(artifact.totalDifferences)} difference(s)`}</p>
		${artifact.metrics ? `<p>Changed pixels: ${escaped((artifact.metrics.differentPixelRatio * 100).toFixed(3))}%; mean channel error: ${escaped(artifact.metrics.meanAbsoluteError.toFixed(3))}</p>` : ''}
		${artifact.scope ? `<p>${escaped(artifact.scope)}</p>` : ''}
		${artifact.differences?.length ? `<div style="overflow-x:auto"><table class="artifact-table"><thead><tr><th>Location</th><th>Expected</th><th>Actual</th></tr></thead><tbody>
			${artifact.differences.map(diff => `<tr><td>${escaped(diff.location)}</td><td>${valueText(diff.expected)}</td><td>${valueText(diff.actual)}</td></tr>`).join('')}
			</tbody></table></div>${artifact.totalDifferences > artifact.differences.length ? '<p>Showing the first 25 differences.</p>' : ''}` : ''}
		<details><summary>View expected and student output</summary><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;padding-top:1rem;">
			${previewHTML(artifact.expectedPreview, 'Expected')}${previewHTML(artifact.actualPreview, 'Student')}
		</div></details>
	</div>`;
}

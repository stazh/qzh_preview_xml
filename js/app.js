/**
 * QZH XML Preview App
 * Main application logic: drag & drop, file handling, UI
 */

const QZHApp = (function() {
    'use strict';

    // DOM Elements
    let dropzone, preview, fileInput;
    let metadataEl, headingEl, bodyEl, backEl, filenameEl;
    let errorModal, errorMessage, closeErrorBtn;
    let newFileBtn;

    /**
     * Initialize application
     */
    function init() {
        // Get DOM elements
        dropzone = document.getElementById('dropzone');
        preview = document.getElementById('preview');
        fileInput = document.getElementById('fileInput');
        metadataEl = document.getElementById('metadata');
        headingEl = document.getElementById('documentHeading');
        bodyEl = document.getElementById('documentBody');
        backEl = document.getElementById('documentBack');
        filenameEl = document.getElementById('filename');
        errorModal = document.getElementById('errorModal');
        errorMessage = document.getElementById('errorMessage');
        closeErrorBtn = document.getElementById('closeError');
        newFileBtn = document.getElementById('newFileBtn');

        // Set up event listeners
        setupDragDrop();
        setupFileInput();
        setupButtons();
    }

    /**
     * Setup drag & drop handlers
     */
    function setupDragDrop() {
        // Prevent default drag behaviors on document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, preventDefaults, false);
        });

        // Highlight dropzone on drag
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, unhighlight, false);
        });

        // Handle drop
        dropzone.addEventListener('drop', handleDrop, false);

        // Also handle drop on preview area (for replacing file)
        preview.addEventListener('drop', handleDrop, false);
        preview.addEventListener('dragover', preventDefaults, false);
    }

    /**
     * Setup file input handler
     */
    function setupFileInput() {
        fileInput.addEventListener('change', function(e) {
            const files = e.target.files;
            if (files.length > 0) {
                handleFile(files[0]);
            }
        });

        // Make dropzone clickable to trigger file input
        dropzone.addEventListener('click', function(e) {
            if (e.target.closest('.file-input-label')) {
                return; // Let the label handle it
            }
            fileInput.click();
        });
    }

    /**
     * Setup button handlers
     */
    function setupButtons() {
        // New file button
        newFileBtn.addEventListener('click', function() {
            showDropzone();
            fileInput.value = '';
        });

        // Close error modal
        closeErrorBtn.addEventListener('click', function() {
            hideError();
        });

        // Close modal on backdrop click
        errorModal.addEventListener('click', function(e) {
            if (e.target === errorModal) {
                hideError();
            }
        });

        // ESC to close modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !errorModal.classList.contains('hidden')) {
                hideError();
            }
        });
    }

    /**
     * Prevent default behavior
     */
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Highlight dropzone
     */
    function highlight() {
        dropzone.classList.add('dragover');
    }

    /**
     * Remove dropzone highlight
     */
    function unhighlight() {
        dropzone.classList.remove('dragover');
    }

    /**
     * Handle dropped files
     */
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }

    /**
     * Handle a file (from drop or input)
     */
    function handleFile(file) {
        // Check file type
        if (!file.name.toLowerCase().endsWith('.xml')) {
            showError('Bitte nur XML-Dateien hochladen.');
            return;
        }

        // Read file
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const xmlString = e.target.result;
                processXML(xmlString, file.name);
            } catch (err) {
                showError('Fehler beim Lesen der Datei: ' + err.message);
            }
        };

        reader.onerror = function() {
            showError('Fehler beim Lesen der Datei.');
        };

        reader.readAsText(file);
    }

    /**
     * Process XML string
     */
    function processXML(xmlString, filename) {
        try {
            // Parse XML
            const xmlDoc = QZHParser.parse(xmlString);
            
            // Transform to HTML
            const result = QZHParser.transform(xmlDoc);
            
            // Render
            renderDocument(result, filename);
            
            // Show preview
            showPreview();
            
        } catch (err) {
            showError('Fehler beim Verarbeiten der XML-Datei: ' + err.message);
        }
    }

    /**
     * Render document to DOM
     */
    function renderDocument(result, filename) {
        // Set filename
        filenameEl.textContent = filename;
        
        // Render metadata
        if (result.metadata) {
            metadataEl.innerHTML = renderMetadata(result.metadata);
            setupMetadataCollapse();
        } else {
            metadataEl.innerHTML = '<p class="no-metadata">Keine Metadaten vorhanden</p>';
        }
        
        // Render heading
        if (result.heading) {
            headingEl.innerHTML = renderHeading(result.heading);
        } else {
            headingEl.innerHTML = '';
        }
        
        // Render body
        if (result.body) {
            bodyEl.innerHTML = result.body;
        } else {
            bodyEl.innerHTML = '<p class="no-content">Kein Inhalt vorhanden</p>';
        }
        
        // Render back matter
        if (result.back) {
            backEl.innerHTML = result.back;
            backEl.classList.remove('hidden');
        } else {
            backEl.innerHTML = '';
            backEl.classList.add('hidden');
        }
        
        // Render footnotes
        if (result.footnotes && result.footnotes.length > 0) {
            renderFootnotes(result.footnotes);
        }
    }

    /**
     * Render metadata to HTML
     */
    function renderMetadata(meta) {
        let html = '';
        
        // Signatur
        if (meta.idno) {
            html += `
                <div class="metadata-section">
                    <h4>Signatur</h4>
                    <div class="metadata-content">
                        ${meta.idnoSource 
                            ? `<a href="${escapeAttr(meta.idnoSource)}" target="_blank" rel="noopener">${escapeHTML(meta.idno)}</a>`
                            : escapeHTML(meta.idno)
                        }
                    </div>
                </div>
            `;
        }
        
        // Datierung
        if (meta.date || meta.dateText) {
            html += `
                <div class="metadata-section">
                    <h4>Datierung</h4>
                    <div class="metadata-content">
                        ${escapeHTML(meta.dateText || meta.date)}
                    </div>
                </div>
            `;
        }
        
        // Überlieferung
        if (meta.filiation || meta.material) {
            html += `
                <div class="metadata-section">
                    <h4>Überlieferung</h4>
                    <div class="metadata-content">
                        <ul>
                            ${meta.filiation ? `<li>${escapeHTML(meta.filiation)}</li>` : ''}
                            ${meta.material ? `<li><span class="metadata-label">Material:</span> ${escapeHTML(meta.material)}</li>` : ''}
                            ${meta.dimensions ? `<li><span class="metadata-label">Format:</span> ${escapeHTML(meta.dimensions)}</li>` : ''}
                            ${meta.condition ? `<li><span class="metadata-label">Zustand:</span> ${escapeHTML(meta.condition)}</li>` : ''}
                        </ul>
                    </div>
                </div>
            `;
        }
        
        // Siegel
        if (meta.seals && meta.seals.length > 0) {
            html += `
                <div class="metadata-section">
                    <h4>Siegel</h4>
                    <div class="metadata-content">
                        <ul>
                            ${meta.seals.map(s => `<li>${escapeHTML(s)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }
        
        // Sprache
        if (meta.textLang) {
            html += `
                <div class="metadata-section">
                    <h4>Sprache</h4>
                    <div class="metadata-content">
                        ${escapeHTML(meta.textLang)}
                    </div>
                </div>
            `;
        }
        
        // Schlagworte
        if (meta.keywords && meta.keywords.length > 0) {
            html += `
                <div class="metadata-section">
                    <h4>Schlagworte</h4>
                    <div class="metadata-content">
                        <ul>
                            ${meta.keywords.map(k => `<li class="term">${escapeHTML(k.text)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }
        
        // Bearbeitung
        if (meta.editors && meta.editors.length > 0) {
            const roleLabels = {
                'transcript': 'Transkription',
                'tagging': 'Auszeichnung',
                'edit': 'Bearbeitung'
            };
            
            html += `
                <div class="metadata-section">
                    <h4>Bearbeitung</h4>
                    <div class="metadata-content">
                        <ul>
                            ${meta.editors.map(e => {
                                const role = roleLabels[e.role] || e.role || '';
                                return `<li>${escapeHTML(e.name)}${role ? ` (${escapeHTML(role)})` : ''}</li>`;
                            }).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    /**
     * Setup collapsible metadata sections
     */
    function setupMetadataCollapse() {
        const sections = metadataEl.querySelectorAll('.metadata-section h4');
        sections.forEach(h4 => {
            h4.addEventListener('click', function() {
                this.parentElement.classList.toggle('collapsed');
            });
        });
    }

    /**
     * Render heading
     */
    function renderHeading(heading) {
        let html = '';
        
        if (heading.title) {
            html += `<h2>${escapeHTML(heading.title)}</h2>`;
        }
        
        if (heading.date || heading.idno) {
            html += '<div class="doc-date">';
            if (heading.date) {
                html += escapeHTML(heading.date);
            }
            if (heading.idno) {
                html += heading.date ? ` (${escapeHTML(heading.idno)})` : escapeHTML(heading.idno);
            }
            html += '</div>';
        }
        
        return html;
    }

    /**
     * Render footnotes
     */
    function renderFootnotes(footnotes) {
        if (footnotes.length === 0) return;
        
        let html = '<div class="footnotes"><h4>Anmerkungen</h4>';
        
        for (const fn of footnotes) {
            html += `
                <div class="footnote" id="fn-${fn.number}">
                    <span class="footnote-number">${fn.number}</span>
                    <span class="fn-content">${fn.content}</span>
                </div>
            `;
        }
        
        html += '</div>';
        
        // Append to body
        bodyEl.insertAdjacentHTML('beforeend', html);
        
        // Setup footnote click handlers
        document.querySelectorAll('.footnote-ref').forEach(ref => {
            ref.addEventListener('click', function() {
                const fnNum = this.getAttribute('data-footnote');
                const fnEl = document.getElementById('fn-' + fnNum);
                if (fnEl) {
                    fnEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    fnEl.classList.add('highlight');
                    setTimeout(() => fnEl.classList.remove('highlight'), 2000);
                }
            });
        });
    }

    /**
     * Show dropzone, hide preview
     */
    function showDropzone() {
        dropzone.classList.remove('hidden');
        preview.classList.add('hidden');
    }

    /**
     * Show preview, hide dropzone
     */
    function showPreview() {
        dropzone.classList.add('hidden');
        preview.classList.remove('hidden');
    }

    /**
     * Show error modal
     */
    function showError(message) {
        errorMessage.textContent = message;
        errorModal.classList.remove('hidden');
    }

    /**
     * Hide error modal
     */
    function hideError() {
        errorModal.classList.add('hidden');
    }

    /**
     * Escape HTML
     */
    function escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape for attributes
     */
    function escapeAttr(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // Public API
    return {
        init: init
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    QZHApp.init();
});

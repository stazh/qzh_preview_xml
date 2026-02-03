/**
 * QZH XML Preview App
 * Main application logic: drag & drop, file handling, UI
 */

const QZHApp = (function() {
    'use strict';

    // DOM Elements
    let dropzonePage, dropzone, preview, fileInput;
    let metadataEl, bodyEl, backEl, regestEl;
    let docIdEl, docTitleEl, docDateEl;
    let registersEl;
    let errorModal, errorMessage, closeErrorBtn;
    let newFileBtn;
    let tabs, tabContents;

    /**
     * Initialize application
     */
    function init() {
        // Get DOM elements
        dropzonePage = document.getElementById('dropzone-page');
        dropzone = document.getElementById('dropzone');
        preview = document.getElementById('preview');
        fileInput = document.getElementById('fileInput');
        metadataEl = document.getElementById('metadata');
        bodyEl = document.getElementById('documentBody');
        backEl = document.getElementById('documentBack');
        regestEl = document.getElementById('documentRegest');
        docIdEl = document.getElementById('docId');
        docTitleEl = document.getElementById('docTitle');
        docDateEl = document.getElementById('docDate');
        registersEl = document.getElementById('registers');
        errorModal = document.getElementById('errorModal');
        errorMessage = document.getElementById('errorMessage');
        closeErrorBtn = document.getElementById('closeError');
        newFileBtn = document.getElementById('newFileBtn');

        // Set up event listeners
        setupDragDrop();
        setupFileInput();
        setupButtons();
        setupTabs();
    }

    /**
     * Setup tab navigation
     */
    function setupTabs() {
        tabs = document.querySelectorAll('.qzh-tab');
        tabContents = document.querySelectorAll('.qzh-tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                
                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // Show correct content
                tabContents.forEach(content => {
                    content.classList.add('hidden');
                });
                document.getElementById('tab-' + targetTab).classList.remove('hidden');
            });
        });
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
        // Set document header info
        if (result.heading) {
            docIdEl.textContent = result.heading.idno || extractIdFromFilename(filename);
            docTitleEl.textContent = result.heading.title || 'Dokument';
            docDateEl.textContent = result.heading.date || '';
        }
        
        // Render metadata (Stückbeschreibung)
        if (result.metadata) {
            metadataEl.innerHTML = renderMetadata(result.metadata);
        } else {
            metadataEl.innerHTML = '<p class="no-metadata">Keine Metadaten vorhanden</p>';
        }
        
        // Render body (Editionstext)
        if (result.body) {
            bodyEl.innerHTML = result.body;
        } else {
            bodyEl.innerHTML = '<p class="no-content">Kein Inhalt vorhanden</p>';
        }
        
        // Render back matter (Kommentar)
        if (result.back) {
            backEl.innerHTML = result.back;
        } else {
            backEl.innerHTML = '<p class="no-content">Kein Kommentar vorhanden</p>';
        }

        // Render summary (Regest)
        if (result.summary) {
            regestEl.innerHTML = result.summary;
        } else {
            regestEl.innerHTML = '<p class="no-content">Kein Regest vorhanden</p>';
        }
        
        // Render registers in sidebar
        if (result.registers) {
            registersEl.innerHTML = renderRegisters(result.registers, result.metadata);
        }
        
        // Render footnotes
        if (result.footnotes && result.footnotes.length > 0) {
            renderFootnotes(result.footnotes);
        }
        
        // Switch to Editionstext tab by default
        const editionTab = document.querySelector('.qzh-tab[data-tab="edition"]');
        if (editionTab) {
            editionTab.click();
        }
    }
    
    /**
     * Extract QZH ID from filename
     */
    function extractIdFromFilename(filename) {
        const match = filename.match(/QZH[_-]?(\d+)/i);
        if (match) {
            return 'QZH ' + match[1].replace(/^0+/, '');
        }
        return filename.replace('.xml', '');
    }
    
    /**
     * Render registers (places, persons, keywords)
     */
    function renderRegisters(registers, metadata) {
        let html = '';
        
        // Places
        if (registers.places && registers.places.length > 0) {
            html += `
                <div class="qzh-sidebar-section qzh-register">
                    <h3 class="qzh-sidebar-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        Ort
                    </h3>
                    <ul class="qzh-register-list">
                        ${registers.places.map(p => `<li class="qzh-register-item place">${escapeHTML(p.name)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        // Persons
        if (registers.persons && registers.persons.length > 0) {
            html += `
                <div class="qzh-sidebar-section qzh-register">
                    <h3 class="qzh-sidebar-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        Person
                    </h3>
                    <ul class="qzh-register-list">
                        ${registers.persons.map(p => `<li class="qzh-register-item person">${escapeHTML(p.name)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        // Keywords from metadata
        if (metadata && metadata.keywords && metadata.keywords.length > 0) {
            html += `
                <div class="qzh-sidebar-section qzh-register">
                    <h3 class="qzh-sidebar-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="4" y1="9" x2="20" y2="9"/>
                            <line x1="4" y1="15" x2="20" y2="15"/>
                            <line x1="10" y1="3" x2="8" y2="21"/>
                            <line x1="16" y1="3" x2="14" y2="21"/>
                        </svg>
                        Schlagwörter
                    </h3>
                    <ul class="qzh-register-list">
                        ${metadata.keywords.map(k => `<li class="qzh-register-item keyword">${escapeHTML(k.text)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        return html;
    }

    /**
     * Render metadata to HTML (Stückbeschreibung)
     */
    function renderMetadata(meta) {
        let html = '<table class="qzh-metadata-table">';
        
        // Signatur
        if (meta.idno) {
            html += `
                <tr>
                    <th>Signatur</th>
                    <td>${meta.idnoSource 
                        ? `<a href="${escapeAttr(meta.idnoSource)}" target="_blank" rel="noopener">${escapeHTML(meta.idno)}</a>`
                        : escapeHTML(meta.idno)
                    }</td>
                </tr>
            `;
        }
        
        // Datierung
        if (meta.date || meta.dateText) {
            html += `
                <tr>
                    <th>Datierung</th>
                    <td>${escapeHTML(meta.dateText || meta.date)}</td>
                </tr>
            `;
        }
        
        // Überlieferung
        if (meta.filiation) {
            html += `
                <tr>
                    <th>Überlieferung</th>
                    <td>${escapeHTML(meta.filiation)}</td>
                </tr>
            `;
        }
        
        // Material
        if (meta.material) {
            html += `
                <tr>
                    <th>Beschreibstoff</th>
                    <td>${escapeHTML(meta.material)}</td>
                </tr>
            `;
        }
        
        // Format
        if (meta.dimensions) {
            html += `
                <tr>
                    <th>Format</th>
                    <td>${escapeHTML(meta.dimensions)}</td>
                </tr>
            `;
        }
        
        // Sprache
        if (meta.textLang) {
            html += `
                <tr>
                    <th>Sprache</th>
                    <td>${escapeHTML(meta.textLang)}</td>
                </tr>
            `;
        }
        
        // Bearbeitung
        if (meta.editors && meta.editors.length > 0) {
            const roleLabels = {
                'transcript': 'Transkription',
                'tagging': 'Auszeichnung',
                'edit': 'Bearbeitung'
            };
            
            const editorsList = meta.editors.map(e => {
                const role = roleLabels[e.role] || e.role || '';
                return `${escapeHTML(e.name)}${role ? ` (${escapeHTML(role)})` : ''}`;
            }).join('<br>');
            
            html += `
                <tr>
                    <th>Bearbeitung</th>
                    <td>${editorsList}</td>
                </tr>
            `;
        }
        
        html += '</table>';
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
        dropzonePage.classList.remove('hidden');
        preview.classList.add('hidden');
    }

    /**
     * Show preview, hide dropzone
     */
    function showPreview() {
        dropzonePage.classList.add('hidden');
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
    QZHDog.init();
});

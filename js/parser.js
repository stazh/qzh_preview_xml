/**
 * QZH TEI-XML Parser
 * Transforms TEI-XML to HTML following qzh conventions
 * Based on: https://github.com/stazh/qzh
 */

const QZHParser = (function() {
    'use strict';

    // Namespace for TEI
    const TEI_NS = 'http://www.tei-c.org/ns/1.0';
    
    // Footnote counter
    let footnoteCounter = 0;
    let footnotes = [];
    
    // Registers for entities
    let persons = [];
    let places = [];
    let organizations = [];
    let terms = [];
    
    // Normalized mode flag - reset at the start of each transform() call
    // Safe for single-document processing which is the use case here
    let normalizedMode = false;

    /**
     * Parse XML string to DOM
     */
    function parseXML(xmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'application/xml');
        
        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('XML Parse Error: ' + parseError.textContent);
        }
        
        return doc;
    }

    /**
     * Main transform function
     */
    function transform(xmlDoc, normalized = false) {
        // Set normalized mode
        normalizedMode = normalized;
        
        // Reset footnotes and registers
        footnoteCounter = 0;
        footnotes = [];
        persons = [];
        places = [];
        organizations = [];
        terms = [];
        
        const result = {
            metadata: extractMetadata(xmlDoc),
            summary: extractSummary(xmlDoc),
            heading: extractHeading(xmlDoc),
            body: null,
            back: null,
            footnotes: [],
            registers: {
                persons: [],
                places: [],
                organizations: [],
                terms: []
            }
        };
        
        // Transform body
        const body = xmlDoc.querySelector('body') || xmlDoc.getElementsByTagNameNS(TEI_NS, 'body')[0];
        if (body) {
            result.body = transformNode(body);
        }
        
        // Transform back matter
        const back = xmlDoc.querySelector('back') || xmlDoc.getElementsByTagNameNS(TEI_NS, 'back')[0];
        if (back) {
            result.back = transformBackMatter(back);
        }
        
        result.footnotes = footnotes;
        
        // Deduplicate and sort registers
        result.registers.persons = deduplicateEntities(persons);
        result.registers.places = deduplicateEntities(places);
        result.registers.organizations = deduplicateEntities(organizations);
        result.registers.terms = deduplicateEntities(terms);
        
        return result;
    }
    
    /**
     * Deduplicate entities by ref or name
     */
    function deduplicateEntities(entities) {
        const seen = new Map();
        for (const entity of entities) {
            const key = entity.ref || entity.name;
            if (!seen.has(key)) {
                seen.set(key, entity);
            }
        }
        return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }

    /**
     * Extract metadata from teiHeader
     */
    function extractMetadata(xmlDoc) {
        const header = xmlDoc.querySelector('teiHeader') || xmlDoc.getElementsByTagNameNS(TEI_NS, 'teiHeader')[0];
        if (!header) return null;
        
        const metadata = {
            title: '',
            idno: '',
            date: '',
            dateText: '',
            keywords: [],
            textLang: '',
            filiation: '',
            filiationOriginal: '',
            edition: '',
            material: '',
            dimensions: '',
            condition: '',
            seals: [],
            editors: []
        };
        
        // Title from msDesc/head
        const head = header.querySelector('msDesc head') || header.getElementsByTagNameNS(TEI_NS, 'head')[0];
        if (head) {
            metadata.title = head.textContent.trim();
        }
        
        // ID number / Signatur
        const idno = header.querySelector('msIdentifier idno') || header.getElementsByTagNameNS(TEI_NS, 'idno')[0];
        if (idno) {
            metadata.idno = idno.textContent.trim();
            metadata.idnoSource = idno.getAttribute('source') || '';
        }
        
        // Date
        const origDate = header.querySelector('origDate') || header.getElementsByTagNameNS(TEI_NS, 'origDate')[0];
        if (origDate) {
            metadata.date = origDate.getAttribute('when') || origDate.getAttribute('from') || '';
            metadata.dateText = origDate.textContent.trim() || formatDate(metadata.date);
        }
        
        // Keywords/Terms
        const terms = header.querySelectorAll('keywords term') || header.getElementsByTagNameNS(TEI_NS, 'term');
        for (const term of terms) {
            metadata.keywords.push({
                text: term.textContent.trim(),
                ref: term.getAttribute('ref') || ''
            });
        }
        
        // Language
        const textLang = header.querySelector('textLang') || header.getElementsByTagNameNS(TEI_NS, 'textLang')[0];
        if (textLang) {
            metadata.textLang = textLang.textContent.trim();
        }
        
        // Filiation (Überlieferung)
        const filiation = header.querySelector('filiation[type="current"]') || header.getElementsByTagNameNS(TEI_NS, 'filiation')[0];
        if (filiation) {
            metadata.filiation = filiation.textContent.trim();
        }
        
        // Filiation original (for Edition display)
        const filiationOriginal = header.querySelector('filiation[type="original"]');
        if (filiationOriginal) {
            // Check if it contains origDate
            const origDateInFiliation = filiationOriginal.querySelector('origDate') || filiationOriginal.getElementsByTagNameNS(TEI_NS, 'origDate')[0];
            if (origDateInFiliation) {
                const dateFrom = origDateInFiliation.getAttribute('from');
                const dateTo = origDateInFiliation.getAttribute('to');
                const dateWhen = origDateInFiliation.getAttribute('when');
                const dateText = origDateInFiliation.textContent.trim();
                
                if (dateText) {
                    metadata.filiationOriginal = dateText;
                } else if (dateWhen) {
                    metadata.filiationOriginal = formatDate(dateWhen);
                } else if (dateFrom && dateTo) {
                    metadata.filiationOriginal = `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
                } else if (dateFrom) {
                    metadata.filiationOriginal = `ab ${formatDate(dateFrom)}`;
                }
            } else {
                metadata.filiationOriginal = filiationOriginal.textContent.trim();
            }
        }
        
        // Edition from additional/listBibl
        const listBibl = header.querySelector('additional listBibl');
        if (listBibl) {
            const bibl = listBibl.querySelector('bibl');
            if (bibl) {
                // Extract text content, preserving some structure
                const editionText = bibl.textContent.trim();
                if (editionText) {
                    metadata.edition = editionText;
                }
            }
        }
        
        // Material
        const material = header.querySelector('material') || header.getElementsByTagNameNS(TEI_NS, 'material')[0];
        if (material) {
            metadata.material = material.textContent.trim();
        }
        
        // Dimensions
        const dimensions = header.querySelector('dimensions') || header.getElementsByTagNameNS(TEI_NS, 'dimensions')[0];
        if (dimensions) {
            const width = dimensions.querySelector('width') || dimensions.getElementsByTagNameNS(TEI_NS, 'width')[0];
            const height = dimensions.querySelector('height') || dimensions.getElementsByTagNameNS(TEI_NS, 'height')[0];
            if (width && height) {
                // Try to get quantity attribute first, then text content
                const widthValue = width.getAttribute('quantity') || width.textContent.trim();
                const heightValue = height.getAttribute('quantity') || height.textContent.trim();
                if (widthValue && heightValue) {
                    metadata.dimensions = `${widthValue} × ${heightValue} cm`;
                }
            }
        }
        
        // Condition
        const condition = header.querySelector('condition') || header.getElementsByTagNameNS(TEI_NS, 'condition')[0];
        if (condition) {
            metadata.condition = condition.textContent.trim();
        }
        
        // Seals
        const seals = header.querySelectorAll('seal') || header.getElementsByTagNameNS(TEI_NS, 'seal');
        for (const seal of seals) {
            metadata.seals.push(seal.textContent.trim());
        }
        
        // Editors/transcribers
        const respStmts = header.querySelectorAll('respStmt') || header.getElementsByTagNameNS(TEI_NS, 'respStmt');
        for (const resp of respStmts) {
            const persName = resp.querySelector('persName');
            const role = resp.querySelector('resp');
            if (persName) {
                metadata.editors.push({
                    name: persName.textContent.trim(),
                    role: role ? role.getAttribute('key') || role.textContent.trim() : ''
                });
            }
        }
        
        return metadata;
    }

    /**
     * Extract summary (Regest) from teiHeader
     */
    function extractSummary(xmlDoc) {
        const header = xmlDoc.querySelector('teiHeader') || xmlDoc.getElementsByTagNameNS(TEI_NS, 'teiHeader')[0];
        if (!header) return '';

        const summary = header.querySelector('summary') || header.getElementsByTagNameNS(TEI_NS, 'summary')[0];
        if (!summary) return '';

        const summaryHtml = transformChildren(summary).trim();
        if (summaryHtml) {
            return summaryHtml;
        }

        const summaryText = summary.textContent.trim();
        return summaryText ? escapeHTML(summaryText) : '';
    }

    /**
     * Extract document heading
     */
    function extractHeading(xmlDoc) {
        const header = xmlDoc.querySelector('teiHeader') || xmlDoc.getElementsByTagNameNS(TEI_NS, 'teiHeader')[0];
        if (!header) return null;
        
        const heading = {
            title: '',
            date: '',
            idno: ''
        };
        
        // Title
        const head = header.querySelector('msDesc head') || header.getElementsByTagNameNS(TEI_NS, 'head')[0];
        if (head) {
            heading.title = head.textContent.trim();
        }
        
        // Date
        const origDate = header.querySelector('origDate') || header.getElementsByTagNameNS(TEI_NS, 'origDate')[0];
        if (origDate) {
            const when = origDate.getAttribute('when') || origDate.getAttribute('from') || '';
            heading.date = origDate.textContent.trim() || formatDate(when);
        }
        
        // ID
        const seriesId = header.querySelector('seriesStmt idno') || header.querySelectorAll('idno')[1];
        if (seriesId) {
            heading.idno = seriesId.textContent.trim();
        }
        
        return heading;
    }

    /**
     * Format ISO date to German format
     */
    function formatDate(isoDate) {
        if (!isoDate) return '';
        
        const parts = isoDate.split('-');
        const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                       'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        
        if (parts.length === 3) {
            const day = parseInt(parts[2], 10);
            const month = months[parseInt(parts[1], 10) - 1];
            const year = parts[0];
            return `${day}. ${month} ${year}`;
        } else if (parts.length === 2) {
            const month = months[parseInt(parts[1], 10) - 1];
            const year = parts[0];
            return `${month} ${year}`;
        }
        return isoDate;
    }

    /**
     * Transform a node and its children to HTML
     */
    function transformNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return escapeHTML(node.textContent);
        }
        
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }
        
        const localName = node.localName || node.nodeName.replace(/^.*:/, '');
        const children = transformChildren(node);
        
        switch (localName) {
            // Structure elements
            case 'body':
                return `<div class="body">${children}</div>`;
            
            case 'div':
                return `<div class="tei-div">${children}</div>`;
            
            case 'p':
                return `<p class="tei-p">${children}</p>`;
            
            case 'ab':
                const place = node.getAttribute('place');
                const abClass = place ? 'tei-ab tei-ab1' : 'tei-ab';
                return `<div class="${abClass}">${children}</div>`;
            
            case 'head':
                const headType = node.getAttribute('type') || '';
                if (headType === 'subtitle') {
                    return `<h2 class="tei-head-subtitle">${children}</h2>`;
                }
                const level = getHeadingLevel(node);
                return `<h${level} class="tei-head${level}">${children}</h${level}>`;
            
            // Line/page breaks
            case 'lb':
                if (normalizedMode) {
                    // In normalized mode, completely omit line breaks
                    return '';
                }
                // In normal mode, show line breaks
                const breakAttr = node.getAttribute('break');
                if (breakAttr === 'no') {
                    // Hyphen at word break, then line break
                    return '-<br>';
                }
                return '<br>';  // Regular line break
            
            case 'pb':
                const n = node.getAttribute('n') || '';
                const facs = node.getAttribute('facs') || '';
                const pageLabel = n ? `S. ${n}` : '';
                const tooltip = facs ? `data-tooltip="Faksimile: ${facs}" data-tooltip-type="page"` : '';
                return `<span class="pb-marker" ${tooltip}>[${pageLabel}]</span>`;
            
            case 'cb':
                return '<span class="column-break"> | </span>';
            
            // Semantic elements
            case 'persName':
                return transformSemanticElement(node, 'person', children);
            
            case 'placeName':
            case 'origPlace':
                return transformSemanticElement(node, 'place', children);
            
            case 'orgName':
                return transformSemanticElement(node, 'organization', children);
            
            case 'term':
                // Check if inside keywords (metadata) or body text
                if (isInsideHeader(node)) {
                    return children;
                }
                return transformSemanticElement(node, 'term', children);
            
            // Text-critical elements
            case 'choice':
                return transformChoice(node);
            
            case 'sic':
                return `<span class="tei-sic text-critical" data-tooltip="So im Original" data-tooltip-type="textcritical">${children}</span>`;
            
            case 'corr':
                return `<span class="tei-corr">${children}</span>`;
            
            case 'abbr':
                const expansion = findSibling(node, 'expan');
                const expanText = expansion ? expansion.textContent : '';
                const abbrTooltip = expanText ? `data-tooltip="${escapeAttr(expanText)}" data-tooltip-type="abbr"` : '';
                return `<span class="tei-abbr text-critical" ${abbrTooltip}>${children}</span>`;
            
            case 'expan':
                // Usually hidden, shown in tooltip of abbr
                return '';
            
            case 'orig':
                return `<span class="tei-orig">${children}</span>`;
            
            case 'reg':
                // Usually hidden, shown in tooltip
                return '';
            
            case 'add':
                const addPlace = node.getAttribute('place') || 'unbekannt';
                const addHand = node.getAttribute('hand') || '';
                let addInfo = `Hinzufügung (${addPlace})`;
                if (addHand) addInfo += ` von ${addHand}`;
                return `<span class="tei-add text-critical" data-tooltip="${escapeAttr(addInfo)}" data-tooltip-type="textcritical">${children}</span>`;
            
            case 'del':
                const delRend = node.getAttribute('rend') || 'durchgestrichen';
                return `<span class="tei-del text-critical" data-tooltip="Gestrichen: ${delRend}" data-tooltip-type="textcritical">${children}</span>`;
            
            case 'subst':
                return `<span class="tei-subst text-critical" data-tooltip="Ersetzung" data-tooltip-type="textcritical">${children}</span>`;
            
            case 'supplied':
                const suppliedSource = node.getAttribute('source') || node.getAttribute('resp') || '';
                const suppliedReason = node.getAttribute('reason') || '';
                let suppliedInfo = 'Ergänzung';
                if (suppliedReason) suppliedInfo += `: ${suppliedReason}`;
                if (suppliedSource) suppliedInfo += ` (${suppliedSource})`;
                return `<span class="tei-supplied text-critical" data-tooltip="${escapeAttr(suppliedInfo)}" data-tooltip-type="textcritical">${children}</span>`;
            
            case 'unclear':
                const unclearReason = node.getAttribute('reason') || 'unsichere Lesung';
                return `<span class="tei-unclear text-critical" data-tooltip="${escapeAttr(unclearReason)}" data-tooltip-type="textcritical">${children}</span>`;
            
            case 'gap':
                const gapReason = node.getAttribute('reason') || '';
                const gapUnit = node.getAttribute('unit') || '';
                const gapQuantity = node.getAttribute('quantity') || '';
                let gapInfo = 'Lücke';
                if (gapReason) gapInfo += `: ${gapReason}`;
                if (gapQuantity && gapUnit) gapInfo += ` (${gapQuantity} ${gapUnit})`;
                return `<span class="tei-gap text-critical" data-tooltip="${escapeAttr(gapInfo)}" data-tooltip-type="textcritical"></span>`;
            
            case 'damage':
                const damageAgent = node.getAttribute('agent') || 'Beschädigung';
                return `<span class="tei-damage text-critical" data-tooltip="${escapeAttr(damageAgent)}" data-tooltip-type="textcritical">${children}</span>`;
            
            case 'space':
                const spaceUnit = node.getAttribute('unit') || '';
                const spaceQuantity = node.getAttribute('quantity') || '';
                const spaceInfo = spaceQuantity && spaceUnit ? `Leerraum: ${spaceQuantity} ${spaceUnit}` : 'Leerraum';
                return `<span class="tei-space text-critical" data-tooltip="${escapeAttr(spaceInfo)}" data-tooltip-type="textcritical"></span>`;
            
            case 'app':
                return transformApp(node, children);
            
            case 'lem':
                return `<span class="tei-lem">${children}</span>`;
            
            case 'rdg':
                // Usually in tooltip
                return '';
            
            // Quotes
            case 'q':
            case 'quote':
                return `<span class="tei-q">${children}</span>`;
            
            // Highlighting
            case 'hi':
                const rend = node.getAttribute('rend') || '';
                const hiClass = getRenditionClass(rend);
                return `<span class="${hiClass}">${children}</span>`;
            
            // Foreign language
            case 'foreign':
                const lang = node.getAttribute('xml:lang') || node.getAttribute('lang') || '';
                return `<span class="tei-foreign" data-lang="${lang}">${children}</span>`;
            
            // Notes / Footnotes
            case 'note':
                return transformNote(node, children);
            
            // References / Links
            case 'ref':
                const target = node.getAttribute('target') || '';
                if (target.startsWith('http')) {
                    return `<a href="${escapeAttr(target)}" target="_blank" rel="noopener" class="ref-link">${children}</a>`;
                }
                return `<span class="tei-ref">${children}</span>`;
            
            case 'bibl':
                const biblType = node.getAttribute('type') || '';
                if (biblType === 'url') {
                    const url = node.textContent.trim();
                    return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener" class="bibl-link">${children}</a>`;
                }
                return `<span class="tei-bibl">${children}</span>`;
            
            // Figures
            case 'figure':
                const figType = node.getAttribute('type') || 'Abbildung';
                return `<span class="tei-figure" data-tooltip="Abbildung: ${escapeAttr(figType)}" data-tooltip-type="figure">[${figType}]</span>`;
            
            case 'figDesc':
                return `<span class="tei-figDesc">${children}</span>`;
            
            // Date/Time
            case 'date':
                const dateWhen = node.getAttribute('when') || '';
                const dateCalendar = node.getAttribute('calendar') || '';
                let dateInfo = dateWhen ? formatDate(dateWhen) : '';
                if (dateCalendar) dateInfo += ` (${dateCalendar})`;
                if (dateInfo) {
                    return `<span class="tei-date text-critical" data-tooltip="${escapeAttr(dateInfo)}" data-tooltip-type="date">${children}</span>`;
                }
                return `<span class="tei-date">${children}</span>`;
            
            case 'origDate':
                // In metadata context, this is handled separately
                return `<span class="tei-origDate">${children}</span>`;
            
            case 'time':
                const timeWhen = node.getAttribute('when') || '';
                if (timeWhen) {
                    return `<span class="tei-time text-critical" data-tooltip="${escapeAttr(timeWhen)}" data-tooltip-type="time">${children}</span>`;
                }
                return `<span class="tei-time">${children}</span>`;
            
            // Measurements
            case 'measure':
                const measType = node.getAttribute('type') || '';
                const measUnit = node.getAttribute('unit') || '';
                const measQuantity = node.getAttribute('quantity') || '';
                const measCommodity = node.getAttribute('commodity') || '';
                let measInfo = [];
                if (measQuantity) measInfo.push(measQuantity);
                if (measUnit) measInfo.push(measUnit);
                if (measCommodity) measInfo.push(measCommodity);
                if (measType) measInfo.push(`(${measType})`);
                const measTooltip = measInfo.length ? measInfo.join(' ') : '';
                if (measTooltip) {
                    return `<span class="tei-measure text-critical" data-tooltip="${escapeAttr(measTooltip)}" data-tooltip-type="measure">${children}</span>`;
                }
                return `<span class="tei-measure">${children}</span>`;
            
            case 'num':
                const numValue = node.getAttribute('value') || '';
                if (numValue) {
                    return `<span class="tei-num text-critical" data-tooltip="Wert: ${escapeAttr(numValue)}" data-tooltip-type="num">${children}</span>`;
                }
                return `<span class="tei-num">${children}</span>`;
            
            // Signed
            case 'signed':
                return `<div class="tei-signed">[Unterzeichnet:] ${children}</div>`;
            
            // Tables
            case 'table':
                return `<table class="tei-table">${children}</table>`;
            
            case 'row':
                const rowRole = node.getAttribute('role') || '';
                const rowClass = rowRole === 'label' ? 'tei-row tei-row1' : 'tei-row';
                return `<tr class="${rowClass}">${children}</tr>`;
            
            case 'cell':
                const cellRole = node.parentElement?.getAttribute('role') || '';
                const cellTag = cellRole === 'label' ? 'th' : 'td';
                return `<${cellTag} class="tei-cell">${children}</${cellTag}>`;
            
            // Lists
            case 'list':
                const listType = node.getAttribute('type') || '';
                const listTag = listType === 'ordered' ? 'ol' : 'ul';
                return `<${listTag} class="tei-list">${children}</${listTag}>`;
            
            case 'item':
                return `<li class="tei-item">${children}</li>`;
            
            case 'label':
                const labelType = node.getAttribute('type') || '';
                const labelClass = labelType === 'keyword' ? 'tei-label tei-label1' : 'tei-label';
                return `<span class="${labelClass}">${children}</span>`;
            
            // Segments
            case 'seg':
                return `<span class="tei-seg">${children}</span>`;
            
            // Handshift
            case 'handShift':
                const newHand = node.getAttribute('new') || '';
                addFootnote(`Handwechsel${newHand ? ': ' + newHand : ''}`);
                return `<span class="footnote-ref">${footnoteCounter}</span>`;
            
            // Default: just return children
            default:
                return children;
        }
    }

    /**
     * Transform children of a node
     */
    function transformChildren(node) {
        let result = '';
        for (const child of node.childNodes) {
            result += transformNode(child);
        }
        return result;
    }

    /**
     * Transform semantic element (persName, placeName, term, etc.)
     */
    function transformSemanticElement(node, type, children) {
        const ref = node.getAttribute('ref') || '';
        const role = node.getAttribute('role') || '';
        const name = node.textContent.trim();
        
        // Add to register
        const entity = { name, ref, role };
        switch (type) {
            case 'person':
                persons.push(entity);
                break;
            case 'place':
                places.push(entity);
                break;
            case 'organization':
                organizations.push(entity);
                break;
            case 'term':
                terms.push(entity);
                break;
        }
        
        let tooltipParts = [];
        
        // Type label
        const typeLabels = {
            person: 'Person',
            place: 'Ort',
            organization: 'Organisation',
            term: 'Begriff'
        };
        tooltipParts.push(typeLabels[type] || type);
        
        // Reference
        if (ref) {
            tooltipParts.push(`Ref: ${ref}`);
        }
        
        // Role
        if (role) {
            tooltipParts.push(`Rolle: ${role}`);
        }
        
        const tooltip = tooltipParts.join(' | ');
        
        return `<span class="semantic ${type}" data-tooltip="${escapeAttr(tooltip)}" data-tooltip-type="${type}" data-ref="${escapeAttr(ref)}">${children}</span>`;
    }

    /**
     * Transform choice element (sic/corr, abbr/expan, orig/reg)
     */
    function transformChoice(node) {
        // Check what type of choice this is
        const sic = node.querySelector('sic') || node.getElementsByTagNameNS(TEI_NS, 'sic')[0];
        const corr = node.querySelector('corr') || node.getElementsByTagNameNS(TEI_NS, 'corr')[0];
        const abbr = node.querySelector('abbr') || node.getElementsByTagNameNS(TEI_NS, 'abbr')[0];
        const expan = node.querySelector('expan') || node.getElementsByTagNameNS(TEI_NS, 'expan')[0];
        const orig = node.querySelector('orig') || node.getElementsByTagNameNS(TEI_NS, 'orig')[0];
        const reg = node.querySelector('reg') || node.getElementsByTagNameNS(TEI_NS, 'reg')[0];
        
        if (sic && corr) {
            // Show sic with correction in tooltip
            const sicText = transformChildren(sic);
            const corrText = corr.textContent.trim();
            return `<span class="text-critical" data-tooltip="Korrektur: ${escapeAttr(corrText)}" data-tooltip-type="textcritical">${sicText}</span>`;
        }
        
        if (abbr && expan) {
            // Show abbreviation with expansion in tooltip
            const abbrText = transformChildren(abbr);
            const expanText = expan.textContent.trim();
            return `<span class="tei-abbr text-critical" data-tooltip="${escapeAttr(expanText)}" data-tooltip-type="abbr">${abbrText}</span>`;
        }
        
        if (orig && reg) {
            // Show original with regularized in tooltip
            const origText = transformChildren(orig);
            const regText = reg.textContent.trim();
            return `<span class="text-critical" data-tooltip="Normalisiert: ${escapeAttr(regText)}" data-tooltip-type="textcritical">${origText}</span>`;
        }
        
        // Fallback: just render children
        return transformChildren(node);
    }

    /**
     * Transform apparatus entry
     */
    function transformApp(node, children) {
        const lem = node.querySelector('lem') || node.getElementsByTagNameNS(TEI_NS, 'lem')[0];
        const rdgs = node.querySelectorAll('rdg') || node.getElementsByTagNameNS(TEI_NS, 'rdg');
        
        let rdgTexts = [];
        for (const rdg of rdgs) {
            const wit = rdg.getAttribute('wit') || '';
            const text = rdg.textContent.trim();
            rdgTexts.push(wit ? `${wit}: ${text}` : text);
        }
        
        const tooltip = rdgTexts.length ? `Varianten: ${rdgTexts.join('; ')}` : '';
        const lemText = lem ? transformChildren(lem) : children;
        
        if (tooltip) {
            return `<span class="text-critical" data-tooltip="${escapeAttr(tooltip)}" data-tooltip-type="apparatus">${lemText}</span>`;
        }
        
        return `<span class="tei-app">${lemText}</span>`;
    }

    /**
     * Transform note element
     */
    function transformNote(node, children) {
        const noteType = node.getAttribute('type') || '';
        const notePlace = node.getAttribute('place') || '';
        
        // Inline marginal note
        if (notePlace === 'margin' || notePlace === 'left' || notePlace === 'right') {
            return `<span class="tei-note-margin text-critical" data-tooltip="${escapeAttr(children)}" data-tooltip-type="note">[*]</span>`;
        }
        
        // Footnote
        addFootnote(children);
        return `<span class="footnote-ref" data-footnote="${footnoteCounter}">${footnoteCounter}</span>`;
    }

    /**
     * Add a footnote
     */
    function addFootnote(content) {
        footnoteCounter++;
        footnotes.push({
            number: footnoteCounter,
            content: content
        });
    }

    /**
     * Transform back matter
     */
    function transformBackMatter(backNode) {
        const divs = backNode.querySelectorAll('div') || backNode.getElementsByTagNameNS(TEI_NS, 'div');
        let html = '<h3>Kommentar</h3>';
        
        let items = [];
        for (const div of divs) {
            const ps = div.querySelectorAll('p') || div.getElementsByTagNameNS(TEI_NS, 'p');
            for (const p of ps) {
                items.push(transformChildren(p));
            }
        }
        
        // If there are multiple items, render each as a paragraph
        if (items.length > 1) {
            for (const item of items) {
                html += `<p>${item}</p>`;
            }
        } else if (items.length === 1) {
            html += `<p>${items[0]}</p>`;
        } else {
            // Fallback: transform all children
            html += transformChildren(backNode);
        }
        
        return html;
    }

    /**
     * Get heading level based on context
     */
    function getHeadingLevel(node) {
        // Count ancestor divs to determine level
        let level = 2;
        let parent = node.parentElement;
        while (parent) {
            const parentName = parent.localName || parent.nodeName.replace(/^.*:/, '');
            if (parentName === 'div') {
                level++;
            }
            parent = parent.parentElement;
        }
        return Math.min(level, 6);
    }

    /**
     * Get CSS class for @rend attribute
     */
    function getRenditionClass(rend) {
        const rendMap = {
            'sup': 'simple_superscript',
            'super': 'simple_superscript',
            'superscript': 'simple_superscript',
            'sub': 'simple_subscript',
            'subscript': 'simple_subscript',
            'italic': 'simple_italic',
            'italics': 'simple_italic',
            'bold': 'simple_bold',
            'underline': 'simple_underline',
            'strikethrough': 'simple_strikethrough',
            'smallcaps': 'simple_smallcaps',
            'small-caps': 'simple_smallcaps',
            'uppercase': 'simple_allcaps',
            'larger': 'simple_larger',
            'smaller': 'simple_smaller',
            'center': 'simple_centre',
            'centre': 'simple_centre',
            'right': 'simple_right',
            'left': 'simple_left'
        };
        
        return rendMap[rend.toLowerCase()] || 'tei-hi';
    }

    /**
     * Find sibling element by name
     */
    function findSibling(node, name) {
        const parent = node.parentElement;
        if (!parent) return null;
        
        for (const child of parent.children) {
            const childName = child.localName || child.nodeName.replace(/^.*:/, '');
            if (childName === name && child !== node) {
                return child;
            }
        }
        return null;
    }

    /**
     * Check if node is inside teiHeader
     */
    function isInsideHeader(node) {
        let parent = node.parentElement;
        while (parent) {
            const parentName = parent.localName || parent.nodeName.replace(/^.*:/, '');
            if (parentName === 'teiHeader') {
                return true;
            }
            parent = parent.parentElement;
        }
        return false;
    }

    /**
     * Escape HTML special characters
     */
    function escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape for use in attributes
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
        parse: parseXML,
        transform: transform
    };
})();

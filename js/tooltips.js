/**
 * QZH Tooltip System
 * Provides hover tooltips for semantic and text-critical elements
 */

const QZHTooltips = (function() {
    'use strict';

    let tooltipEl = null;
    let hideTimeout = null;
    let currentTarget = null;

    /**
     * Initialize tooltip system
     */
    function init() {
        tooltipEl = document.getElementById('tooltip');
        
        if (!tooltipEl) {
            console.error('Tooltip element #tooltip not found');
            return;
        }

        // Event delegation for tooltip triggers
        document.addEventListener('mouseenter', handleMouseEnter, true);
        document.addEventListener('mouseleave', handleMouseLeave, true);
        document.addEventListener('scroll', hideTooltip, true);
        
        // Hide on click elsewhere
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.tooltip') && !e.target.hasAttribute('data-tooltip')) {
                hideTooltip();
            }
        });
    }

    /**
     * Handle mouse enter on potential tooltip trigger
     */
    function handleMouseEnter(e) {
        const target = e.target;
        
        if (!target.hasAttribute || !target.hasAttribute('data-tooltip')) {
            return;
        }

        clearTimeout(hideTimeout);
        currentTarget = target;
        
        const tooltipText = target.getAttribute('data-tooltip');
        const tooltipType = target.getAttribute('data-tooltip-type') || '';
        
        if (!tooltipText) {
            return;
        }

        showTooltip(target, tooltipText, tooltipType);
    }

    /**
     * Handle mouse leave from tooltip trigger
     */
    function handleMouseLeave(e) {
        const target = e.target;
        
        if (!target.hasAttribute || !target.hasAttribute('data-tooltip')) {
            return;
        }

        // Small delay before hiding to allow moving to tooltip
        hideTimeout = setTimeout(hideTooltip, 100);
    }

    /**
     * Show tooltip
     */
    function showTooltip(target, text, type) {
        const content = formatTooltipContent(text, type);
        tooltipEl.innerHTML = content;
        
        // Remove all type classes and add current
        tooltipEl.className = 'tooltip';
        if (type) {
            tooltipEl.classList.add(type);
        }

        // Position tooltip
        positionTooltip(target);
        
        // Show with animation
        requestAnimationFrame(() => {
            tooltipEl.classList.add('visible');
        });
    }

    /**
     * Hide tooltip
     */
    function hideTooltip() {
        if (tooltipEl) {
            tooltipEl.classList.remove('visible');
        }
        currentTarget = null;
    }

    /**
     * Format tooltip content based on type
     */
    function formatTooltipContent(text, type) {
        const typeLabels = {
            'person': 'Person',
            'place': 'Ort',
            'organization': 'Organisation',
            'term': 'Begriff',
            'textcritical': 'Textkritisch',
            'abbr': 'Abkürzung',
            'date': 'Datum',
            'time': 'Zeit',
            'duration': 'Dauer',
            'highlight': 'Hervorgehoben',
            'measure': 'Maßangabe',
            'num': 'Zahl',
            'note': 'Anmerkung',
            'apparatus': 'Lesarten',
            'figure': 'Abbildung',
            'page': 'Seite'
        };

        const label = typeLabels[type] || '';
        
        // Split text if it contains '|' separator (from semantic elements)
        const parts = text.split(' | ');
        
        let html = '';
        
        if (label) {
            html += `<div class="tooltip-type">${escapeHTML(label)}</div>`;
        }
        
        if (parts.length > 1) {
            // First part is usually the type/name
            html += `<div class="tooltip-title">${escapeHTML(parts[0])}</div>`;
            html += '<div class="tooltip-content">';
            for (let i = 1; i < parts.length; i++) {
                html += `<div>${escapeHTML(parts[i])}</div>`;
            }
            html += '</div>';
        } else {
            html += `<div class="tooltip-content">${escapeHTML(text)}</div>`;
        }
        
        return html;
    }

    /**
     * Position tooltip relative to target element
     */
    function positionTooltip(target) {
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltipEl.getBoundingClientRect();
        
        // Default: position above the element
        let top = rect.top - 10;
        let left = rect.left + (rect.width / 2);
        
        // Make tooltip visible to calculate dimensions
        tooltipEl.style.visibility = 'hidden';
        tooltipEl.style.display = 'block';
        tooltipEl.style.left = '0';
        tooltipEl.style.top = '0';
        
        const tooltipWidth = tooltipEl.offsetWidth;
        const tooltipHeight = tooltipEl.offsetHeight;
        
        // Adjust horizontal position
        left = left - (tooltipWidth / 2);
        
        // Keep within viewport horizontally
        const padding = 10;
        if (left < padding) {
            left = padding;
        } else if (left + tooltipWidth > window.innerWidth - padding) {
            left = window.innerWidth - tooltipWidth - padding;
        }
        
        // Position above or below depending on space
        if (rect.top - tooltipHeight - 10 < padding) {
            // Not enough space above, position below
            top = rect.bottom + 10;
        } else {
            // Position above
            top = rect.top - tooltipHeight - 10;
        }
        
        // Keep within viewport vertically
        if (top < padding) {
            top = padding;
        } else if (top + tooltipHeight > window.innerHeight - padding) {
            top = window.innerHeight - tooltipHeight - padding;
        }
        
        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;
        tooltipEl.style.visibility = 'visible';
    }

    /**
     * Escape HTML
     */
    function escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public API
    return {
        init: init,
        show: showTooltip,
        hide: hideTooltip
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    QZHTooltips.init();
});

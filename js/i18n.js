// TRANSLATION ENGINE & RTL LAYOUT HANDLER
import { translations } from './translations.js';

export let currentLanguage = localStorage.getItem('app_language') || 'en';

/**
 * Get translated text for a specific key.
 */
export function t(key) {
    const langDict = translations[currentLanguage] || translations['en'];
    return langDict[key] || translations['en'][key] || key;
}

/**
 * Apply translations to all DOM elements with data-i18n or data-i18n-placeholder attributes.
 */
export function translatePage() {
    // Translate text content
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key) {
            element.textContent = t(key);
        }
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (key) {
            element.setAttribute('placeholder', t(key));
        }
    });

    // Handle RTL (Right-to-Left) direction dynamically for Arabic
    if (currentLanguage === 'ar') {
        document.body.setAttribute('dir', 'rtl');
        document.body.classList.add('rtl-active');
        // Simple CSS override mapping for RTL support
        adjustSidebarLayoutForRTL(true);
    } else {
        document.body.setAttribute('dir', 'ltr');
        document.body.classList.remove('rtl-active');
        adjustSidebarLayoutForRTL(false);
    }
}

/**
 * Shift layout alignments dynamically when changing direction.
 */
function adjustSidebarLayoutForRTL(isRTL) {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    
    if (sidebar && mainContent && window.innerWidth > 768) {
        if (isRTL) {
            sidebar.style.left = 'auto';
            sidebar.style.right = '0';
            sidebar.style.borderRight = 'none';
            sidebar.style.borderLeft = '1px solid var(--border)';
            mainContent.style.marginLeft = '0';
            mainContent.style.marginRight = 'var(--sidebar-width)';
        } else {
            sidebar.style.left = '0';
            sidebar.style.right = 'auto';
            sidebar.style.borderRight = '1px solid var(--border)';
            sidebar.style.borderLeft = 'none';
            mainContent.style.marginLeft = 'var(--sidebar-width)';
            mainContent.style.marginRight = '0';
        }
    }
}

/**
 * Switch language and refresh the UI translations.
 */
export function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        localStorage.setItem('app_language', lang);
        translatePage();
        
        // Dispatch custom event for dynamic components (like charts) to update
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
        return true;
    }
    return false;
}

// Translate page on first script load
window.addEventListener('DOMContentLoaded', () => {
    translatePage();
});

// Re-adjust layouts on window resizing
window.addEventListener('resize', () => {
    adjustSidebarLayoutForRTL(currentLanguage === 'ar');
});

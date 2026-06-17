// --- State Management ---
let state = {
    allReleases: [], // Raw list of releases from API
    filteredReleases: [], // Releases after search and filtering
    filters: {
        search: '',
        categories: new Set(['Feature', 'Change', 'Issue', 'Breaking', 'Announcement']),
        stage: 'all', // 'all', 'ga', 'preview'
        sort: 'desc' // 'desc', 'asc'
    },
    cache: {
        source: 'live',
        expiresInSec: 0,
        cachedAt: null
    }
};

// --- DOM Elements ---
const DOM = {
    releasesList: document.getElementById('releasesList'),
    skeletonLoader: document.getElementById('skeletonLoader'),
    errorContainer: document.getElementById('errorContainer'),
    emptyContainer: document.getElementById('emptyContainer'),
    errorMessage: document.getElementById('errorMessage'),
    resultsCount: document.getElementById('resultsCount'),
    
    // Search
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    
    // Category Checkboxes
    categoryCheckboxes: document.getElementById('categoryCheckboxes'),
    
    // Radio Stage
    stageRadioGroup: document.getElementById('stageRadioGroup'),
    
    // Sort
    sortSelect: document.getElementById('sortSelect'),
    
    // Sync Action
    refreshBtn: document.getElementById('refreshBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    cacheText: document.getElementById('cacheText'),
    cacheStatus: document.getElementById('cacheStatus'),
    
    // Stats
    statAll: document.getElementById('statAll'),
    statFeature: document.getElementById('statFeature'),
    statChange: document.getElementById('statChange'),
    statIssue: document.getElementById('statIssue'),
    statBreaking: document.getElementById('statBreaking'),
    statsContainer: document.getElementById('statsContainer'),
    
    // General Buttons
    retryBtn: document.getElementById('retryBtn'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    activeChips: document.getElementById('activeChips')
};

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    initTheme();
    bindEvents();
    fetchReleases();
}

// --- Fetch Data ---
async function fetchReleases(forceRefresh = false) {
    showLoading();
    try {
        // Simple trick to bypass cache if forceRefresh is true: append timestamp (we also handle it on backend by returning latest if cache expired, but server cache is 5min. 
        // We can just query Flask API. Since Flask API handles caching, a standard fetch is good.
        const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
        
        // Note: Flask API implements a 5min cache, but if they want true force refresh we just fetch.
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to parse releases feed.');
        }
        
        state.allReleases = data.releases || [];
        state.cache.source = data.source;
        state.cache.expiresInSec = data.expires_in_sec || 0;
        state.cache.cachedAt = data.cached_at ? new Date(data.cached_at * 1000) : new Date();
        
        updateCacheUI();
        calculateGlobalStats();
        applyFiltersAndRender();
        
    } catch (err) {
        console.error("Error fetching release notes:", err);
        showError(err.message);
    }
}

// --- Helper UI States ---
function showLoading() {
    DOM.skeletonLoader.style.display = 'block';
    DOM.releasesList.style.display = 'none';
    DOM.errorContainer.style.display = 'none';
    DOM.emptyContainer.style.display = 'none';
    DOM.resultsCount.textContent = 'Updating feed...';
}

function showError(msg) {
    DOM.skeletonLoader.style.display = 'none';
    DOM.releasesList.style.display = 'none';
    DOM.errorContainer.style.display = 'flex';
    DOM.emptyContainer.style.display = 'none';
    DOM.errorMessage.textContent = msg || 'There was an issue loading the release notes feed.';
    DOM.resultsCount.textContent = 'Error loading feed';
}

function showEmpty() {
    DOM.releasesList.style.display = 'none';
    DOM.emptyContainer.style.display = 'flex';
    DOM.resultsCount.textContent = '0 Matches';
}

function hideOverlayStates() {
    DOM.skeletonLoader.style.display = 'none';
    DOM.errorContainer.style.display = 'none';
    DOM.emptyContainer.style.display = 'none';
    DOM.releasesList.style.display = 'flex';
}

// --- Cache UI Update ---
function updateCacheUI() {
    const isCache = state.cache.source === 'cache' || state.cache.source === 'stale_cache_fallback';
    if (isCache) {
        DOM.cacheStatus.style.background = 'rgba(30, 41, 59, 0.5)';
        DOM.cacheStatus.style.borderColor = 'var(--border-color)';
        DOM.cacheStatus.querySelector('i').className = 'fa-solid fa-circle-check';
        DOM.cacheStatus.querySelector('i').style.color = 'var(--color-feature)';
        
        let min = Math.floor(state.cache.expiresInSec / 60);
        let sec = state.cache.expiresInSec % 60;
        let timeStr = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
        
        DOM.cacheText.textContent = `Cached (refresh in ${timeStr})`;
    } else {
        DOM.cacheStatus.style.background = 'rgba(16, 185, 129, 0.1)';
        DOM.cacheStatus.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        DOM.cacheStatus.querySelector('i').className = 'fa-solid fa-bolt animate-pulse';
        DOM.cacheStatus.querySelector('i').style.color = 'var(--color-feature)';
        DOM.cacheText.textContent = 'Live Feed Synced';
    }
}

// Start a timer to countdown cache expiry in UI if cached
setInterval(() => {
    if (state.cache.source === 'cache' && state.cache.expiresInSec > 0) {
        state.cache.expiresInSec--;
        updateCacheUI();
        if (state.cache.expiresInSec <= 0) {
            state.cache.source = 'live';
            updateCacheUI();
        }
    }
}, 1000);

// --- Stats & Badge Calculations ---
function calculateGlobalStats() {
    let totals = {
        all: 0,
        Feature: 0,
        Change: 0,
        Issue: 0,
        Breaking: 0,
        Announcement: 0
    };
    
    state.allReleases.forEach(rel => {
        rel.items.forEach(item => {
            totals.all++;
            const category = item.category;
            if (totals.hasOwnProperty(category)) {
                totals[category]++;
            } else {
                // Unexpected category fallback
                totals['Announcement']++;
            }
        });
    });
    
    // Update Stats Bar values
    DOM.statAll.textContent = totals.all;
    DOM.statFeature.textContent = totals.Feature;
    DOM.statChange.textContent = totals.Change;
    DOM.statIssue.textContent = totals.Issue;
    DOM.statBreaking.textContent = totals.Breaking;
    
    // Update Sidebar badge counts
    Object.keys(totals).forEach(cat => {
        if (cat === 'all') return;
        const badge = DOM.categoryCheckboxes.querySelector(`.checkbox-item[data-category="${cat}"] .count-badge`);
        if (badge) {
            badge.textContent = totals[cat];
        }
    });
}

// --- Filtering & Sorting ---
function applyFiltersAndRender() {
    hideOverlayStates();
    
    // 1. Deep clone/filter structures
    let filteredList = [];
    
    state.allReleases.forEach(rel => {
        // Filter the individual items in this release
        const matchingItems = rel.items.filter(item => {
            // Check Category filter
            if (!state.filters.categories.has(item.category)) {
                return false;
            }
            
            // Check Launch Stage filter
            if (state.filters.stage === 'ga' && !item.is_ga) {
                return false;
            }
            if (state.filters.stage === 'preview' && !item.is_preview) {
                return false;
            }
            
            // Check Search keyword (matches in description or category)
            if (state.filters.search) {
                const searchLower = state.filters.search.toLowerCase();
                const descLower = item.description.toLowerCase();
                const catLower = item.category.toLowerCase();
                if (!descLower.includes(searchLower) && !catLower.includes(searchLower)) {
                    return false;
                }
            }
            
            return true;
        });
        
        // If this release has matching items, keep it
        if (matchingItems.length > 0) {
            filteredList.push({
                ...rel,
                items: matchingItems
            });
        }
    });
    
    // 2. Sort the releases by date
    filteredList.sort((a, b) => {
        const dateA = new Date(a.date || a.title);
        const dateB = new Date(b.date || b.title);
        
        if (state.filters.sort === 'asc') {
            return dateA - dateB;
        } else {
            return dateB - dateA;
        }
    });
    
    state.filteredReleases = filteredList;
    
    // 3. Render
    renderList();
    renderActiveFilterChips();
}

function renderList() {
    DOM.releasesList.innerHTML = '';
    
    // Count total matches (individual note items)
    let totalItems = 0;
    state.filteredReleases.forEach(rel => {
        totalItems += rel.items.length;
    });
    
    if (totalItems === 0) {
        showEmpty();
        return;
    }
    
    DOM.resultsCount.textContent = `Showing ${totalItems} note${totalItems === 1 ? '' : 's'} across ${state.filteredReleases.length} day${state.filteredReleases.length === 1 ? '' : 's'}`;
    
    state.filteredReleases.forEach(rel => {
        const card = document.createElement('article');
        card.className = 'release-group-card';
        
        // Date formatting: June 15, 2026
        const dateHeader = rel.title;
        
        let itemsHtml = '';
        rel.items.forEach(item => {
            // Determine badges
            let categoryBadgeClass = `badge-${item.category.toLowerCase()}`;
            let stageBadgesHtml = '';
            
            if (item.is_ga) {
                stageBadgesHtml += `<span class="stage-badge ga">GA</span>`;
            }
            if (item.is_preview) {
                stageBadgesHtml += `<span class="stage-badge preview">Preview</span>`;
            }
            
            itemsHtml += `
                <div class="release-item" data-category="${item.category}">
                    <div class="release-item-header">
                        <span class="category-badge ${categoryBadgeClass}">${item.category}</span>
                        ${stageBadgesHtml}
                        <div class="release-item-actions">
                            <button class="copy-btn" title="Copy note plain-text to clipboard">
                                <i class="fa-regular fa-copy"></i> Copy
                            </button>
                            <button class="tweet-btn" title="Share this update on Twitter / X">
                                <i class="fa-brands fa-x-twitter"></i> Tweet
                            </button>
                        </div>
                    </div>
                    <div class="release-item-content">
                        ${item.description}
                    </div>
                </div>
            `;
        });
        
        card.innerHTML = `
            <div class="release-card-header">
                <h3 class="release-date-title"><i class="fa-regular fa-calendar-check" style="margin-right: 0.5rem; color: var(--primary);"></i>${dateHeader}</h3>
                <div class="release-meta">
                    <a href="${rel.link}" target="_blank" class="release-orig-link" title="View official release notes anchor">
                        Source Anchor <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.75rem; margin-left: 0.25rem;"></i>
                    </a>
                </div>
            </div>
            <div class="release-items-list">
                ${itemsHtml}
            </div>
        `;
        
        DOM.releasesList.appendChild(card);
    });
}

// --- Active Filter Chips UI ---
function renderActiveFilterChips() {
    DOM.activeChips.innerHTML = '';
    let hasActiveFilters = false;
    
    // Search Chip
    if (state.filters.search) {
        hasActiveFilters = true;
        createChip(`Search: "${state.filters.search}"`, () => {
            state.filters.search = '';
            DOM.searchInput.value = '';
            DOM.clearSearchBtn.style.display = 'none';
            applyFiltersAndRender();
        });
    }
    
    // Stage Chip
    if (state.filters.stage !== 'all') {
        hasActiveFilters = true;
        const text = state.filters.stage === 'ga' ? 'GA Only' : 'Preview Only';
        createChip(text, () => {
            state.filters.stage = 'all';
            updateRadioUI('all');
            applyFiltersAndRender();
        });
    }
    
    // Categories Chip (if not all checked)
    const allCategories = ['Feature', 'Change', 'Issue', 'Breaking', 'Announcement'];
    if (state.filters.categories.size < allCategories.length) {
        hasActiveFilters = true;
        state.filters.categories.forEach(cat => {
            createChip(`Cat: ${cat}`, () => {
                state.filters.categories.delete(cat);
                updateCheckboxUI(cat, false);
                applyFiltersAndRender();
            });
        });
    }
    
    DOM.activeChips.style.display = hasActiveFilters ? 'flex' : 'none';
}

function createChip(text, onRemove) {
    const chip = document.createElement('div');
    chip.className = 'filter-chip';
    chip.innerHTML = `
        <span>${text}</span>
        <button><i class="fa-solid fa-xmark"></i></button>
    `;
    chip.querySelector('button').addEventListener('click', onRemove);
    DOM.activeChips.appendChild(chip);
}

// Helper to update checkbox DOM states when state modifies programmatically
function updateCheckboxUI(category, isChecked) {
    const item = DOM.categoryCheckboxes.querySelector(`.checkbox-item[data-category="${category}"]`);
    if (item) {
        if (isChecked) {
            item.classList.add('checked');
        } else {
            item.classList.remove('checked');
        }
    }
}

// Helper to update radio DOM states
function updateRadioUI(stage) {
    DOM.stageRadioGroup.querySelectorAll('.radio-item').forEach(item => {
        if (item.getAttribute('data-stage') === stage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// --- Bind Events ---
function bindEvents() {
    // Copy to Clipboard Button Handler (Event Delegation)
    DOM.releasesList.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.copy-btn');
        if (copyBtn) {
            const releaseItem = copyBtn.closest('.release-item');
            const releaseCard = copyBtn.closest('.release-group-card');
            
            const category = releaseItem.getAttribute('data-category');
            const date = releaseCard.querySelector('.release-date-title').textContent.trim();
            const rawHtml = releaseItem.querySelector('.release-item-content').innerHTML;
            
            // Extract plain text from description HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = rawHtml;
            let text = tempDiv.textContent || tempDiv.innerText || '';
            text = text.replace(/\s+/g, ' ').trim();
            
            const copyText = `BigQuery Release Note - ${date} [${category}]\n\n${text}`;
            
            navigator.clipboard.writeText(copyText).then(() => {
                // UI feedback
                const origHtml = copyBtn.innerHTML;
                copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied`;
                copyBtn.classList.add('success');
                
                setTimeout(() => {
                    copyBtn.innerHTML = origHtml;
                    copyBtn.classList.remove('success');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        }
    });

    // Tweet Share Button Handler (Event Delegation)
    DOM.releasesList.addEventListener('click', (e) => {
        const tweetBtn = e.target.closest('.tweet-btn');
        if (tweetBtn) {
            const releaseItem = tweetBtn.closest('.release-item');
            const releaseCard = tweetBtn.closest('.release-group-card');
            
            const category = releaseItem.getAttribute('data-category');
            const date = releaseCard.querySelector('.release-date-title').textContent.trim();
            const rawHtml = releaseItem.querySelector('.release-item-content').innerHTML;
            
            // Extract plain text from description HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = rawHtml;
            let text = tempDiv.textContent || tempDiv.innerText || '';
            
            // Normalize whitespaces
            text = text.replace(/\s+/g, ' ').trim();
            
            // Grab link
            const link = releaseCard.querySelector('.release-orig-link').getAttribute('href');
            
            // Format the Tweet text
            const prefix = `BigQuery ${category} (${date}): `;
            const hashtags = ` #BigQuery #GoogleCloud`;
            const linkSpacer = `\n\n`;
            
            // Calculate max allowed length for description
            // Twitter has 280-char limit. A link counts as 23 characters regardless of length.
            const fixedLength = prefix.length + linkSpacer.length + 23 + hashtags.length;
            const maxTextLen = 280 - fixedLength;
            
            let truncatedText = text;
            if (text.length > maxTextLen) {
                truncatedText = text.substring(0, maxTextLen - 3) + '...';
            }
            
            const tweetText = `${prefix}${truncatedText}${linkSpacer}${link}${hashtags}`;
            const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
            
            window.open(tweetUrl, '_blank', 'noopener,noreferrer');
        }
    });

    // Search Input Event
    let searchDebounce;
    DOM.searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        state.filters.search = val;
        
        DOM.clearSearchBtn.style.display = val ? 'block' : 'none';
        
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            applyFiltersAndRender();
        }, 300);
    });
    
    // Clear Search Input Button
    DOM.clearSearchBtn.addEventListener('click', () => {
        DOM.searchInput.value = '';
        state.filters.search = '';
        DOM.clearSearchBtn.style.display = 'none';
        applyFiltersAndRender();
    });
    
    // Category Checkbox click handlers
    DOM.categoryCheckboxes.querySelectorAll('.checkbox-item').forEach(item => {
        item.addEventListener('click', () => {
            const category = item.getAttribute('data-category');
            if (state.filters.categories.has(category)) {
                // If only 1 checked, don't allow checking off everything
                if (state.filters.categories.size > 1) {
                    state.filters.categories.delete(category);
                    item.classList.remove('checked');
                }
            } else {
                state.filters.categories.add(category);
                item.classList.add('checked');
            }
            applyFiltersAndRender();
        });
    });
    
    // Stage Radio Group handlers
    DOM.stageRadioGroup.querySelectorAll('.radio-item').forEach(item => {
        item.addEventListener('click', () => {
            const stage = item.getAttribute('data-stage');
            state.filters.stage = stage;
            updateRadioUI(stage);
            applyFiltersAndRender();
        });
    });
    
    // Sort Select
    DOM.sortSelect.addEventListener('change', (e) => {
        state.filters.sort = e.target.value;
        applyFiltersAndRender();
    });
    
    // Manual Sync Button
    DOM.refreshBtn.addEventListener('click', () => {
        const icon = DOM.refreshBtn.querySelector('i');
        icon.classList.add('spin');
        DOM.refreshBtn.disabled = true;
        
        fetchReleases(true).finally(() => {
            setTimeout(() => {
                icon.classList.remove('spin');
                DOM.refreshBtn.disabled = false;
            }, 800);
        });
    });
    
    // Retry buttons
    DOM.retryBtn.addEventListener('click', () => fetchReleases());
    
    // Reset Filters button
    DOM.resetFiltersBtn.addEventListener('click', resetAllFilters);

    // Export to CSV button
    DOM.exportCsvBtn.addEventListener('click', exportToCSV);
    
    // Interactive Metric Cards: clicking a stat card isolates that category!
    DOM.statsContainer.querySelectorAll('.stat-card').forEach(card => {
        card.addEventListener('click', () => {
            const cat = card.getAttribute('data-category');
            if (cat === 'All') {
                resetAllFilters();
            } else {
                // Isolate category: set only this category as active
                state.filters.categories.clear();
                state.filters.categories.add(cat);
                
                // Update Checkboxes
                DOM.categoryCheckboxes.querySelectorAll('.checkbox-item').forEach(cb => {
                    const cbCat = cb.getAttribute('data-category');
                    updateCheckboxUI(cbCat, cbCat === cat);
                });
                
                applyFiltersAndRender();
            }
        });
    });
}

function resetAllFilters() {
    state.filters.search = '';
    DOM.searchInput.value = '';
    DOM.clearSearchBtn.style.display = 'none';
    
    state.filters.stage = 'all';
    updateRadioUI('all');
    
    state.filters.categories = new Set(['Feature', 'Change', 'Issue', 'Breaking', 'Announcement']);
    DOM.categoryCheckboxes.querySelectorAll('.checkbox-item').forEach(cb => {
        updateCheckboxUI(cb.getAttribute('data-category'), true);
    });
    
    state.filters.sort = 'desc';
    DOM.sortSelect.value = 'desc';
    
    applyFiltersAndRender();
}

// --- Export to CSV Function ---
function exportToCSV() {
    if (!state.filteredReleases || state.filteredReleases.length === 0) {
        alert("No release notes found to export.");
        return;
    }
    
    // Headers for CSV
    const headers = ["Date", "Category", "Launch Stage", "Description", "Source Link"];
    
    // Format rows with quoting and escaping
    const csvRows = [headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",")];
    
    state.filteredReleases.forEach(rel => {
        const date = rel.date || "";
        const link = rel.link || "";
        
        rel.items.forEach(item => {
            const category = item.category || "";
            
            let stage = "GA";
            if (item.is_preview) {
                stage = "Preview";
            } else if (!item.is_ga && !item.is_preview) {
                stage = "Announcement";
            }
            
            // Extract plain text from description HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = item.description || "";
            let description = tempDiv.textContent || tempDiv.innerText || '';
            description = description.replace(/\s+/g, ' ').trim();
            
            const row = [date, category, stage, description, link];
            csvRows.push(row.map(val => `"${val.replace(/"/g, '""')}"`).join(","));
        });
    });
    
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `bigquery_releases_export_${dateStr}.csv`);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- Theme Management ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    
    DOM.themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    });
}

function setTheme(theme) {
    const themeIcon = document.getElementById('themeIcon');
    if (theme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        DOM.themeToggleBtn.title = "Switch to Dark Mode";
        if (themeIcon) {
            themeIcon.className = 'fa-regular fa-moon';
        }
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        DOM.themeToggleBtn.title = "Switch to Light Mode";
        if (themeIcon) {
            themeIcon.className = 'fa-regular fa-sun';
        }
        localStorage.setItem('theme', 'dark');
    }
}

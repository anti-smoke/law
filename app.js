// Global state
let mainData = [];
let otherData = [];
let regions = {};

// Province-City-County hierarchy mapping
const hierarchy = {};

// National level regulations to show separately
const nationalKeyRegulations = ['公共场所卫生管理条例', '公共场所卫生管理条例实施细则'];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    renderRegions('省级');
});

// Load data from JSON files
async function loadData() {
    try {
        const [mainRes, otherRes, regionsRes] = await Promise.all([
            fetch('data/main.json'),
            fetch('data/other.json'),
            fetch('data/regions.json')
        ]);
        
        mainData = await mainRes.json();
        otherData = await otherRes.json();
        regions = await regionsRes.json();
        
        buildHierarchy();
    } catch (error) {
        console.error('Failed to load data:', error);
        alert('数据加载失败，请刷新页面重试');
    }
}

// Build province-city-county hierarchy
function buildHierarchy() {
    // First, organize all data by region
    mainData.forEach(reg => {
        const level = reg['级别'];
        const region = reg['地区'];
        
        if (!hierarchy[region]) {
            hierarchy[region] = {
                level: level,
                regulations: [],
                parents: [],
                children: []
            };
        }
        hierarchy[region].regulations.push(reg);
    });
    
    // Build parent-child relationships based on Excel order
    buildParentRelations();
    buildChildrenRelations();
}

function buildParentRelations() {
    // For each row, look upward in the Excel data to find the first higher-level region
    const levelOrder = { '国家级': 0, '省级': 1, '地级': 2, '县级': 3 };
    
    mainData.forEach((reg, index) => {
        const currentLevel = reg['级别'];
        const currentRegion = reg['地区'];
        
        if (currentLevel === '国家级') {
            hierarchy[currentRegion].parents = [];
            return;
        }
        
        // Look upward for parent
        for (let i = index - 1; i >= 0; i--) {
            const upperReg = mainData[i];
            const upperLevel = upperReg['级别'];
            const upperRegion = upperReg['地区'];
            
            // Check if this is a higher level
            if (levelOrder[upperLevel] < levelOrder[currentLevel]) {
                if (!hierarchy[currentRegion].parents.includes(upperRegion)) {
                    hierarchy[currentRegion].parents.push(upperRegion);
                }
                break;
            }
        }
        
        // Add national level as ultimate parent for non-national
        if (!hierarchy[currentRegion].parents.includes('全国')) {
            hierarchy[currentRegion].parents.push('全国');
        }
    });
    
    // Ensure '全国' exists in hierarchy
    if (!hierarchy['全国']) {
        hierarchy['全国'] = {
            level: '国家级',
            regulations: mainData.filter(r => r['级别'] === '国家级'),
            parents: [],
            children: []
        };
    }
}

function buildChildrenRelations() {
    // For each region, find its children
    Object.keys(hierarchy).forEach(region => {
        const data = hierarchy[region];
        
        // Find children: regions that have this region as parent
        Object.keys(hierarchy).forEach(otherRegion => {
            if (otherRegion !== region && hierarchy[otherRegion].parents.includes(region)) {
                if (!data.children.includes(otherRegion)) {
                    data.children.push(otherRegion);
                }
            }
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    // Search
    document.getElementById('search-btn').addEventListener('click', performSearch);
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderRegions(btn.dataset.level);
        });
    });
    
    // Back buttons
    document.getElementById('back-btn').addEventListener('click', () => showPage('home-page'));
    document.getElementById('back-other-btn').addEventListener('click', () => showPage('detail-page'));
    
    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', async () => {
        if (confirm('确定要重新转换Excel数据吗？这需要运行Python脚本。')) {
            await refreshData();
        }
    });
}

// Perform search
function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;
    
    const results = document.getElementById('search-results');
    const allRegions = [...regions['省级'], ...regions['地级'], ...regions['县级']];
    
    const matches = allRegions.filter(r => r.includes(query));
    
    if (matches.length === 0) {
        results.innerHTML = '<p style="color: #718096;">未找到匹配的行政区</p>';
    } else {
        results.innerHTML = matches.slice(0, 20).map(region => {
            const level = getRegionLevel(region);
            return `<div class="result-item" onclick="showRegionDetail('${region}')">
                <span>${region}</span>
                <span class="result-level">${level}</span>
            </div>`;
        }).join('');
    }
    results.classList.add('show');
}

function getRegionLevel(region) {
    if (regions['省级'].includes(region)) return '省级';
    if (regions['地级'].includes(region)) return '地级';
    if (regions['县级'].includes(region)) return '县级';
    return '';
}

// Render regions list
function renderRegions(level) {
    const list = document.getElementById('regions-list');
    const regionList = regions[level] || [];
    
    list.innerHTML = regionList.map(region => 
        `<div class="region-item" onclick="showRegionDetail('${region}')">${region}</div>`
    ).join('');
}

// Show page
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    if (pageId === 'home-page') {
        document.getElementById('search-results').classList.remove('show');
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
}

// Show region detail
function showRegionDetail(region) {
    const data = hierarchy[region];
    if (!data) {
        alert('未找到该行政区的数据');
        return;
    }
    
    // Header
    const header = document.getElementById('region-header');
    const breadcrumb = data.parents.length > 0 
        ? `上级：${data.parents.join(' → ')}` 
        : '';
    header.innerHTML = `
        <h2>${region}</h2>
        <div class="breadcrumb">${breadcrumb}</div>
    `;
    
    // Content
    const content = document.getElementById('region-content');
    let html = '';
    
    // Self regulations
    if (data.regulations.length > 0) {
        html += `<div class="level-section">
            <h3>${region}级 <span>（本级法规）</span></h3>
            ${data.regulations.map(r => renderRegulation(r)).join('')}
        </div>`;
    }
    
    // Parent regulations
    data.parents.forEach(parent => {
        const parentData = hierarchy[parent];
        if (parentData && parentData.regulations.length > 0) {
            const isNational = parent === '全国';
            html += `<div class="level-section">
                <h3>${parent}级 <span>（上级法规）</span></h3>
                ${parentData.regulations
                    .filter(r => !isNational || nationalKeyRegulations.includes(r['名称']))
                    .map(r => renderRegulation(r)).join('')}
                ${isNational ? `<a href="#" class="other-link" onclick="showOtherRegulations(event)">其他全国性控烟相关法律法规 →</a>` : ''}
            </div>`;
        }
    });
    
    // Children links (for non-lowest level regions)
    if (data.children.length > 0) {
        html += `<div class="level-section">
            <h3>下级行政区</h3>
            <div class="children-links">
                ${data.children.map(child => 
                    `<div class="region-item" onclick="showRegionDetail('${child}')">${child}</div>`
                ).join('')}
            </div>
        </div>`;
    }
    
    content.innerHTML = html;
    showPage('detail-page');
}

// Render a single regulation
function renderRegulation(reg, isOtherSheet = false) {
    const name = reg['名称'] || '数据整理中';
    
    const fields = [
        { key: '级别', label: '级别' },
        { key: '效力位阶', label: '效力位阶' },
        { key: '类别', label: '类别' },
        { key: '室内全面禁烟（公共场所、工作场所、公共交通工具）', label: '室内全面禁烟', isBool: true },
        { key: '个人劝阻权', label: '个人劝阻权' },
        { key: '处罚个人(元)', label: '处罚个人', appendUnit: '元' },
        { key: '处罚场所(元)', label: '处罚场所', appendUnit: '元' },
        { key: '电子烟', label: '电子烟', isBool: true },
        { key: '生效时间', label: '生效时间' },
        { key: '备注', label: '备注' }
    ];
    
    let metaHtml = '';
    let contentHtml = '';
    let linksHtml = '';
    
    fields.forEach(field => {
        const value = reg[field.key];
        if (!value) return;
        
        let displayValue = value;
        if (field.appendUnit && value !== '无' && value !== '0' && !isNaN(parseInt(value))) {
            displayValue = value + field.appendUnit;
        }
        
        if (field.isBool) {
            const isYes = value === '是' || value === '是（部分）';
            metaHtml += `<span class="meta-item ${isYes ? 'yes' : 'no'}">${field.label}：${displayValue}</span>`;
        } else {
            metaHtml += `<span class="meta-item">${field.label}：${displayValue}</span>`;
        }
    });
    
    // Content sections
    if (reg['禁烟场所条文']) {
        contentHtml += `<div class="content"><strong>禁烟场所条文：</strong><br>${reg['禁烟场所条文']}</div>`;
    }
    if (reg['相关条文']) {
        contentHtml += `<div class="content"><strong>相关条文：</strong><br>${reg['相关条文']}</div>`;
    }
    
    // Links
    if (reg['国法库链接'] && reg['国法库链接'] !== '无') {
        linksHtml += `<a href="${reg['国法库链接']}" target="_blank" rel="noopener">国家法律法规数据库链接</a>`;
    }
    if (reg['其他链接'] && reg['其他链接'] !== '无') {
        linksHtml += `<a href="${reg['其他链接']}" target="_blank" rel="noopener">其他链接</a>`;
    }
    
    return `
        <div class="regulation-card">
            <h4>${name}</h4>
            <div class="meta">${metaHtml}</div>
            ${contentHtml}
            ${linksHtml ? `<div class="links">${linksHtml}</div>` : ''}
        </div>
    `;
}

// Show other regulations page
function showOtherRegulations(event) {
    if (event) event.preventDefault();
    
    const container = document.getElementById('other-regulations');
    
    // Filter national regulations that are not key ones (from 控烟相关法规 sheet)
    const nationalRegs = mainData.filter(r => 
        r['级别'] === '国家级' && !nationalKeyRegulations.includes(r['名称'])
    );
    
    let html = '';
    
    // Section 1: 控烟相关法规 sheet 中的其他国家级法规
    if (nationalRegs.length > 0) {
        html += `<div class="level-section">
            <h3>📋 控烟相关法规（其他国家级法规）</h3>
            ${nationalRegs.map(r => renderRegulation(r)).join('')}
        </div>`;
    }
    
    // Section 2: 其他法规 sheet
    if (otherData.length > 0) {
        html += `<div class="level-section">
            <h3>📋 其他法规</h3>
            ${otherData.map(r => renderRegulation(r, true)).join('')}
        </div>`;
    }
    
    container.innerHTML = html;
    
    showPage('other-page');
}

// Refresh data
async function refreshData() {
    try {
        location.reload();
    } catch (error) {
        console.error('Failed to refresh:', error);
        alert('刷新失败，请手动运行 convert_data.py 脚本');
    }
}

// Make functions globally available
window.showRegionDetail = showRegionDetail;
window.showOtherRegulations = showOtherRegulations;
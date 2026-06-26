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
    // Province mapping for city references
    const provinceCities = {};
    const cityCounties = {};
    
    mainData.forEach(reg => {
        const level = reg['级别'];
        const region = reg['地区'];
        
        if (level === '省级') {
            if (!provinceCities[region]) provinceCities[region] = [];
        } else if (level === '地级') {
            // Try to find parent province
            for (const prov of Object.keys(provinceCities)) {
                if (region.startsWith(prov.replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔|新疆|西藏/g, '').slice(0, 2))) {
                    provinceCities[prov].push(region);
                    break;
                }
            }
            if (!cityCounties[region]) cityCounties[region] = [];
        } else if (level === '县级') {
            // Find parent city
            for (const city of Object.keys(cityCounties)) {
                if (region.includes(city.slice(0, 2)) || city.includes(region.slice(0, 2))) {
                    cityCounties[city].push(region);
                    break;
                }
            }
        }
    });
    
    // Simplified: just use region names directly
    mainData.forEach(reg => {
        const level = reg['级别'];
        const region = reg['地区'];
        
        if (!hierarchy[region]) {
            hierarchy[region] = {
                level: level,
                regulations: [],
                parents: []
            };
        }
        hierarchy[region].regulations.push(reg);
    });
    
    // Build parent relationships
    buildParentRelations();
}

function buildParentRelations() {
    // Province to national
    Object.keys(hierarchy).forEach(region => {
        if (hierarchy[region].level === '省级') {
            hierarchy[region].parents = ['全国'];
        }
    });
    
    // City to province
    mainData.forEach(reg => {
        if (reg['级别'] === '地级') {
            const city = reg['地区'];
            const province = findProvinceForCity(city);
            if (province && hierarchy[province]) {
                if (!hierarchy[city]) hierarchy[city] = { level: '地级', regulations: [], parents: [] };
                if (!hierarchy[city].parents.includes(province)) {
                    hierarchy[city].parents.push(province);
                }
                if (!hierarchy[city].parents.includes('全国')) {
                    hierarchy[city].parents.push('全国');
                }
            }
        }
    });
    
    // County to city to province
    mainData.forEach(reg => {
        if (reg['级别'] === '县级') {
            const county = reg['地区'];
            const city = findCityForCounty(county);
            if (!hierarchy[county]) hierarchy[county] = { level: '县级', regulations: [], parents: [] };
            
            if (city && hierarchy[city]) {
                if (!hierarchy[county].parents.includes(city)) {
                    hierarchy[county].parents.push(city);
                }
                hierarchy[city].parents.forEach(p => {
                    if (!hierarchy[county].parents.includes(p)) {
                        hierarchy[county].parents.push(p);
                    }
                });
            }
        }
    });
}

function findProvinceForCity(city) {
    // Simple matching based on common prefixes
    const prefixes = {
        '石家庄': '河北省', '唐山': '河北省', '秦皇岛': '河北省', '邯郸': '河北省', '邢台': '河北省',
        '保定': '河北省', '张家口': '河北省', '承德': '河北省', '沧州': '河北省', '廊坊': '河北省', '衡水': '河北省',
        '太原': '山西省', '大同': '山西省', '阳泉': '山西省', '长治': '山西省', '晋城': '山西省', '朔州': '山西省', '晋中': '山西省', '运城': '山西省', '忻州': '山西省', '临汾': '山西省', '吕梁': '山西省',
        '呼和浩特': '内蒙古自治区', '包头': '内蒙古自治区', '乌海': '内蒙古自治区', '赤峰': '内蒙古自治区', '通辽': '内蒙古自治区', '鄂尔多斯': '内蒙古自治区', '呼伦贝尔': '内蒙古自治区', '巴彦淖尔': '内蒙古自治区', '乌兰察布': '内蒙古自治区',
        '沈阳': '辽宁省', '大连': '辽宁省', '鞍山': '辽宁省', '抚顺': '辽宁省', '本溪': '辽宁省', '丹东': '辽宁省', '锦州': '辽宁省', '营口': '辽宁省', '阜新': '辽宁省', '辽阳': '辽宁省', '盘锦': '辽宁省', '铁岭': '辽宁省', '朝阳': '辽宁省', '葫芦岛': '辽宁省',
        '长春': '吉林省', '吉林': '吉林省', '四平': '吉林省', '辽源': '吉林省', '通化': '吉林省', '白山': '吉林省', '松原': '吉林省', '白城': '吉林省', '延边': '吉林省',
        '哈尔滨': '黑龙江省', '齐齐哈尔': '黑龙江省', '鸡西': '黑龙江省', '鹤岗': '黑龙江省', '双鸭山': '黑龙江省', '大庆': '黑龙江省', '伊春': '黑龙江省', '佳木斯': '黑龙江省', '七台河': '黑龙江省', '牡丹江': '黑龙江省', '黑河': '黑龙江省', '绥化': '黑龙江省',
        '上海': '上海市',
        '南京': '江苏省', '无锡': '江苏省', '徐州': '江苏省', '常州': '江苏省', '苏州': '江苏省', '南通': '江苏省', '连云港': '江苏省', '淮安': '江苏省', '盐城': '江苏省', '扬州': '江苏省', '镇江': '江苏省', '泰州': '江苏省', '宿迁': '江苏省',
        '杭州': '浙江省', '宁波': '浙江省', '温州': '浙江省', '嘉兴': '浙江省', '湖州': '浙江省', '绍兴': '浙江省', '金华': '浙江省', '衢州': '浙江省', '舟山': '浙江省', '台州': '浙江省', '丽水': '浙江省',
        '合肥': '安徽省', '芜湖': '安徽省', '蚌埠': '安徽省', '淮南': '安徽省', '马鞍山': '安徽省', '淮北': '安徽省', '铜陵': '安徽省', '安庆': '安徽省', '黄山': '安徽省', '滁州': '安徽省', '阜阳': '安徽省', '宿州': '安徽省', '六安': '安徽省', '亳州': '安徽省', '池州': '安徽省', '宣城': '安徽省',
        '福州': '福建省', '厦门': '福建省', '莆田': '福建省', '三明': '福建省', '泉州': '福建省', '漳州': '福建省', '南平': '福建省', '龙岩': '福建省', '宁德': '福建省',
        '南昌': '江西省', '景德镇': '江西省', '萍乡': '江西省', '九江': '江西省', '新余': '江西省', '鹰潭': '江西省', '赣州': '江西省', '吉安': '江西省', '宜春': '江西省', '抚州': '江西省', '上饶': '江西省',
        '济南': '山东省', '青岛': '山东省', '淄博': '山东省', '枣庄': '山东省', '东营': '山东省', '烟台': '山东省', '潍坊': '山东省', '济宁': '山东省', '泰安': '山东省', '威海': '山东省', '日照': '山东省', '临沂': '山东省', '德州': '山东省', '聊城': '山东省', '滨州': '山东省', '菏泽': '山东省',
        '郑州': '河南省', '开封': '河南省', '洛阳': '河南省', '平顶山': '河南省', '安阳': '河南省', '鹤壁': '河南省', '新乡': '河南省', '焦作': '河南省', '濮阳': '河南省', '许昌': '河南省', '漯河': '河南省', '三门峡': '河南省', '南阳': '河南省', '商丘': '河南省', '信阳': '河南省', '周口': '河南省', '驻马店': '河南省',
        '武汉': '湖北省', '黄石': '湖北省', '十堰': '湖北省', '宜昌': '湖北省', '襄阳': '湖北省', '鄂州': '湖北省', '荆门': '湖北省', '孝感': '湖北省', '荆州': '湖北省', '黄冈': '湖北省', '咸宁': '湖北省', '随州': '湖北省', '恩施': '湖北省', '仙桃': '湖北省', '潜江': '湖北省', '天门': '湖北省', '神农架': '湖北省',
        '长沙': '湖南省', '株洲': '湖南省', '湘潭': '湖南省', '衡阳': '湖南省', '邵阳': '湖南省', '岳阳': '湖南省', '常德': '湖南省', '张家界': '湖南省', '益阳': '湖南省', '郴州': '湖南省', '永州': '湖南省', '怀化': '湖南省', '娄底': '湖南省', '湘西': '湖南省',
        '广州': '广东省', '韶关': '广东省', '深圳': '广东省', '珠海': '广东省', '汕头': '广东省', '佛山': '广东省', '江门': '广东省', '湛江': '广东省', '茂名': '广东省', '肇庆': '广东省', '惠州': '广东省', '梅州': '广东省', '汕尾': '广东省', '河源': '广东省', '阳江': '广东省', '清远': '广东省', '东莞': '广东省', '中山': '广东省', '潮州': '广东省', '揭州': '广东省', '云浮': '广东省',
        '南宁': '广西壮族自治区', '柳州': '广西壮族自治区', '桂林': '广西壮族自治区', '梧州': '广西壮族自治区', '北海': '广西壮族自治区', '防城港': '广西壮族自治区', '钦州': '广西壮族自治区', '贵港': '广西壮族自治区', '玉林': '广西壮族自治区', '百色': '广西壮族自治区', '贺州': '广西壮族自治区', '河池': '广西壮族自治区', '来宾': '广西壮族自治区', '崇左': '广西壮族自治区',
        '海口': '海南省', '三亚': '海南省', '三沙': '海南省', '儋州': '海南省',
        '重庆': '重庆市',
        '成都': '四川省', '自贡': '四川省', '攀枝花': '四川省', '泸州': '四川省', '德阳': '四川省', '绵阳': '四川省', '广元': '四川省', '遂宁': '四川省', '内江': '四川省', '乐山': '四川省', '南充': '四川省', '眉山': '四川省', '宜宾': '四川省', '广安': '四川省', '达州': '四川省', '雅安': '四川省', '巴中': '四川省', '资阳': '四川省', '阿坝': '四川省', '甘孜': '四川省', '凉山': '四川省',
        '贵阳': '贵州省', '六盘水': '贵州省', '遵义': '贵州省', '安顺': '贵州省', '毕节': '贵州省', '铜仁': '贵州省', '黔西南': '贵州省', '黔东南': '贵州省', '黔南': '贵州省',
        '昆明': '云南省', '曲靖': '云南省', '玉溪': '云南省', '保山': '云南省', '昭通': '云南省', '丽江': '云南省', '普洱': '云南省', '临沧': '云南省', '楚雄': '云南省', '红河': '云南省', '文山': '云南省', '西双版纳': '云南省', '大理': '云南省', '德宏': '云南省', '怒江': '云南省', '迪庆': '云南省',
        '拉萨': '西藏自治区', '日喀则': '西藏自治区', '昌都': '西藏自治区', '林芝': '西藏自治区', '山南': '西藏自治区', '那曲': '西藏自治区', '阿里': '西藏自治区',
        '西安': '陕西省', '铜川': '陕西省', '宝鸡': '陕西省', '咸阳': '陕西省', '渭南': '陕西省', '延安': '陕西省', '汉中': '陕西省', '榆林': '陕西省', '安康': '陕西省', '商洛': '陕西省',
        '兰州': '甘肃省', '嘉峪关': '甘肃省', '金昌': '甘肃省', '白银': '甘肃省', '天水': '甘肃省', '武威': '甘肃省', '张掖': '甘肃省', '平凉': '甘肃省', '酒泉': '甘肃省', '庆阳': '甘肃省', '定西': '甘肃省', '陇南': '甘肃省', '临夏': '甘肃省', '甘南': '甘肃省',
        '西宁': '青海省', '海东': '青海省', '海北': '青海省', '黄南': '青海省', '海南': '青海省', '果洛': '青海省', '玉树': '青海省', '海西': '青海省',
        '银川': '宁夏回族自治区', '石嘴山': '宁夏回族自治区', '吴忠': '宁夏回族自治区', '固原': '宁夏回族自治区', '中卫': '宁夏回族自治区',
        '乌鲁木齐': '新疆维吾尔自治区', '克拉玛依': '新疆维吾尔自治区', '吐鲁番': '新疆维吾尔自治区', '哈密': '新疆维吾尔自治区', '昌吉': '新疆维吾尔自治区', '博尔塔拉': '新疆维吾尔自治区', '巴音郭楞': '新疆维吾尔自治区', '阿克苏': '新疆维吾尔自治区', '克孜勒苏': '新疆维吾尔自治区', '喀什': '新疆维吾尔自治区', '和田': '新疆维吾尔自治区', '伊犁': '新疆维吾尔自治区', '塔城': '新疆维吾尔自治区', '阿勒泰': '新疆维吾尔自治区',
        '北京': '北京市', '天津': '天津市',
        '香港': '香港特别行政区', '澳门': '澳门特别行政区', '台北': '台湾省'
    };
    
    for (const [cityPrefix, province] of Object.entries(prefixes)) {
        if (city.startsWith(cityPrefix) || city === cityPrefix) {
            return province;
        }
    }
    return null;
}

function findCityForCounty(county) {
    const mappings = {
        '磐安县': '金华市', '青田县': '丽水市', '济源市': '焦作市',
        '仙桃市': '仙桃市', '潜江市': '潜江市', '天门市': '天门市',
        '神农架林区': '神农架林区'
    };
    return mappings[county] || null;
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
    
    content.innerHTML = html;
    showPage('detail-page');
}

// Render a single regulation
function renderRegulation(reg) {
    const fields = [
        { key: '级别', label: '级别' },
        { key: '效力位阶', label: '效力位阶' },
        { key: '类别', label: '类别' },
        { key: '室内全面禁烟（公共场所、工作场所、公共交通工具）', label: '室内全面禁烟', isBool: true },
        { key: '禁烟场所条文', label: '禁烟场所条文', isContent: true },
        { key: '个人劝阻权', label: '个人劝阻权' },
        { key: '处罚个人(元)', label: '处罚个人' },
        { key: '处罚场所(元)', label: '处罚场所' },
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
        
        if (field.isContent) {
            contentHtml += `<div class="content">${value}</div>`;
        } else if (field.isBool) {
            const isYes = value === '是' || value === '是（部分）';
            metaHtml += `<span class="meta-item ${isYes ? 'yes' : 'no'}">${field.label}：${value}</span>`;
        } else {
            metaHtml += `<span class="meta-item">${field.label}：${value}</span>`;
        }
    });
    
    // Links
    if (reg['国法库链接'] && reg['国法库链接'] !== '无') {
        linksHtml += `<a href="${reg['国法库链接']}" target="_blank" rel="noopener">国法库链接</a>`;
    }
    if (reg['其他链接'] && reg['其他链接'] !== '无') {
        linksHtml += `<a href="${reg['其他链接']}" target="_blank" rel="noopener">其他链接</a>`;
    }
    
    return `
        <div class="regulation-card">
            <h4>${reg['名称']}</h4>
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
    
    // Filter national regulations that are not key ones
    const nationalRegs = mainData.filter(r => 
        r['级别'] === '国家级' && !nationalKeyRegulations.includes(r['名称'])
    );
    
    // Add other regulations sheet data
    const allOtherRegs = [...nationalRegs, ...otherData];
    
    container.innerHTML = allOtherRegs.map(r => renderRegulation(r)).join('');
    
    showPage('other-page');
}

// Refresh data
async function refreshData() {
    try {
        // Create a simple fetch to trigger server-side conversion
        // In a real scenario, this would call a server endpoint
        // For static site, user needs to run convert_data.py manually
        
        // For now, reload the page to re-fetch data
        location.reload();
    } catch (error) {
        console.error('Failed to refresh:', error);
        alert('刷新失败，请手动运行 convert_data.py 脚本');
    }
}

// Make functions globally available
window.showRegionDetail = showRegionDetail;
window.showOtherRegulations = showOtherRegulations;
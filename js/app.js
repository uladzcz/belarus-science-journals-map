/**
 * Асноўная логіка інтэрактыўнай карты і каталога навуковых часопісаў
 */

let map;
let markersLayer;
let currentFilteredData = [];
let activeJournalId = null;

// Пачатковыя налады фільтраў
const filters = {
  searchQuery: "",
  country: "all",
  discipline: "all",
  indexing: "all",
  apc: "all",
  language: "all"
};

// Ініцыялізацыя пры загрузцы старонкі
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  initFilters();
  initEventListeners();
  applyFilters();
  updateStats();
});

/**
 * Ініцыялізацыя карты Leaflet
 */
function initMap() {
  // Цэнтр карты: Беларусь і Цэнтральна-Усходняя Еўропа
  map = L.map("map", {
    center: [53.7, 26.5],
    zoom: 6,
    minZoom: 4,
    maxZoom: 18,
    zoomControl: true
  });

  // 1. Esri World Street Map — надзейная, выразна паказвае гарады і межы краін, не блакуецца
  const esriStreet = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    attribution: 'Tiles &copy; Esri, HERE, Garmin, USGS, Intermap, METI, NRCAN',
    maxZoom: 19
  });

  // 2. Esri World Topo Map — тапаграфічны рэльефны стыль
  const esriTopo = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
    attribution: 'Tiles &copy; Esri, DeLorme, NAVTEQ, TomTom, Intermap, USGS, FAO',
    maxZoom: 18
  });

  // 3. OpenStreetMap стандартная падложка
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  });

  // 4. CartoDB Voyager
  const cartoVoyager = L.tileLayer("https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
    attribution: '&copy; CartoDB &copy; OpenStreetMap',
    maxZoom: 19
  });

  // Па змаўчанні ўключаем надзейную Esri Street Map
  esriStreet.addTo(map);

  // Пераключальнік слаёў у правым верхнім куце карты
  const baseMaps = {
    "🗺️ Вуліцы і межы (Esri Street)": esriStreet,
    "🏔️ Рэльеф і тапаграфія (Esri Topo)": esriTopo,
    "🌍 Стандартная OpenStreetMap": osm,
    "🎨 Светлая Carto Voyager": cartoVoyager
  };
  L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Прымусовае абнаўленне памераў карты пасля рэндэрынгу кантэйнера
  setTimeout(() => {
    map.invalidateSize();
  }, 200);
  setTimeout(() => {
    map.invalidateSize();
  }, 800);
  window.addEventListener("resize", () => {
    map.invalidateSize();
  });
}

/**
 * Атрыманне колеру/класа маркера паводле краіны
 */
function getMarkerClass(countryCode) {
  switch (countryCode) {
    case "BY": return "marker-by";
    case "PL": return "marker-pl";
    case "LT": return "marker-lt";
    case "LV": return "marker-lv";
    case "UA": return "marker-ua";
    case "RU": return "marker-ru";
    default: return "marker-other";
  }
}

/**
 * Атрыманне іконкі паводле краіны
 */
function getMarkerIcon(countryCode) {
  const flags = {
    "BY": "⚪",
    "PL": "🇵🇱",
    "LT": "🇱🇹",
    "LV": "🇱🇻",
    "UA": "🇺🇦",
    "RU": "🇷🇺",
    "GB": "🇬🇧",
    "CZ": "🇨🇿",
    "DE": "🇩🇪"
  };
  return flags[countryCode] || "📖";
}

/**
 * Адмалёўка выразных бэйджаў моў публікацыі
 */
function renderLanguageBadges(languages) {
  if (!languages || languages.length === 0) return '';
  return languages.map(lang => {
    const l = lang.toLowerCase().trim();
    if (l === "беларуская") {
      return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs" title="Прымае да публікацыі артыкулы на беларускай мове">
        <span class="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
        <span>Беларуская</span>
      </span>`;
    }
    if (l === "англійская") {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
        <span>🇬🇧</span>
        <span>Англійская</span>
      </span>`;
    }
    if (l === "польская") {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200">
        <span>🇵🇱</span>
        <span>Польская</span>
      </span>`;
    }
    if (l === "ўкраінская") {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300">
        <span>🇺🇦</span>
        <span>Украінская</span>
      </span>`;
    }
    if (l === "руская") {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-normal bg-slate-100 text-slate-700 border border-slate-200">
        <span>Руская</span>
      </span>`;
    }
    if (l === "літоўская") {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
        <span>🇱🇹</span>
        <span>Літоўская</span>
      </span>`;
    }
    if (l === "нямецкая") {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-300">
        <span>🇩🇪</span>
        <span>Нямецкая</span>
      </span>`;
    }
    if (l === "чэшская") {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">
        <span>🇨🇿</span>
        <span>Чэшская</span>
      </span>`;
    }
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-700">${escapeHtml(lang)}</span>`;
  }).join(' ');
}

/**
 * Адмалёўка маркераў на карце
 */
function renderMarkers(journals) {
  markersLayer.clearLayers();

  if (!journals || journals.length === 0) return;

  const latLngs = [];

  // Каб маркеры ў адным горадзе не перакрываліся цалкам, дадаем невялікі дрыфт (jitter) калі каардынаты супадаюць
  const coordMap = new Map();

  journals.forEach(journal => {
    let [lat, lng] = journal.coordinates;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

    if (coordMap.has(key)) {
      const count = coordMap.get(key);
      coordMap.set(key, count + 1);
      // Зрух па спіралі для бачнасці розных часопісаў адной установы
      const angle = count * (2 * Math.PI / 6);
      const radius = 0.005 * Math.sqrt(count);
      lat += radius * Math.cos(angle);
      lng += radius * Math.sin(angle);
    } else {
      coordMap.set(key, 1);
    }

    latLngs.push([lat, lng]);

    const markerHtml = `
      <div class="custom-marker ${getMarkerClass(journal.countryCode)}" title="${escapeHtml(journal.name)}">
        <span style="font-size: 13px;">${getMarkerIcon(journal.countryCode)}</span>
      </div>
    `;

    const customIcon = L.divIcon({
      className: "leaflet-div-marker-wrapper",
      html: markerHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });

    const marker = L.marker([lat, lng], { icon: customIcon });

    // HTML усплывальнага вакна (popup)
    const popupContent = `
      <div class="max-w-xs">
        <div class="flex items-center gap-1.5 mb-1.5">
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            ${journal.country} • ${journal.city}
          </span>
          ${journal.indexing.includes("Scopus") ? '<span class="badge badge-scopus">Scopus</span>' : ''}
          ${journal.indexing.includes("ВАК Беларусі") ? '<span class="badge badge-vak">ВАК</span>' : ''}
        </div>
        <h4 class="font-bold text-slate-900 text-sm mb-1 leading-snug">${escapeHtml(journal.name)}</h4>
        <p class="text-xs text-slate-500 mb-2">${escapeHtml(journal.publisher)}</p>
        <div class="flex flex-wrap gap-1 mb-3">
          ${journal.disciplines.slice(0, 2).map(d => `<span class="text-[10px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded">${d}</span>`).join('')}
        </div>
        <button 
          onclick="openJournalModal('${journal.id}')"
          class="w-full text-center bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-1">
          <span>Падрабязныя ўмовы і спасылкі</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    `;

    marker.bindPopup(popupContent);
    marker.on("click", () => {
      highlightJournalCard(journal.id);
    });

    markersLayer.addLayer(marker);
  });

  // Аўтаматычнае маштабаванне карты пад бачныя кропкі
  if (latLngs.length > 0) {
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
  }
}

/**
 * Адмалёўка картак часопісаў у бакавой панэлі
 */
function renderJournalCards(journals) {
  const container = document.getElementById("journals-list");
  const countBadge = document.getElementById("results-count");

  countBadge.textContent = `${journals.length} выданняў`;

  if (!journals || journals.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 px-4 bg-white rounded-xl border border-slate-200">
        <div class="w-12 h-12 mx-auto mb-3 text-slate-400">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h4 class="text-base font-semibold text-slate-700 mb-1">Нічога не знойдзена</h4>
        <p class="text-xs text-slate-500 mb-4">Паспрабуйце змяніць параметры пошуку альбо скінуць фільтры.</p>
        <button onclick="resetFilters()" class="text-xs text-sky-600 hover:text-sky-700 font-semibold underline">
          Скінуць усе фільтры
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = journals.map(journal => {
    const isFree = journal.apc.toLowerCase().includes("бясплатна") || journal.apc.toLowerCase().includes("адсутнічае");
    const hasVak = journal.indexing.includes("ВАК Беларусі");
    const hasScopus = journal.indexing.includes("Scopus");
    const hasWos = journal.indexing.includes("Web of Science");
    const hasDoaj = journal.indexing.includes("DOAJ");

    return `
      <div 
        id="card-${journal.id}"
        onclick="selectJournal('${journal.id}')"
        class="journal-card bg-white p-4 rounded-xl border border-slate-200 hover:border-sky-300 cursor-pointer shadow-sm mb-3">
        
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 flex items-center gap-1">
              <span>${getMarkerIcon(journal.countryCode)}</span>
              <span>${journal.city}, ${journal.country}</span>
            </span>
            ${hasVak ? '<span class="badge badge-vak">ВАК Беларусі</span>' : ''}
            ${hasScopus ? '<span class="badge badge-scopus">Scopus</span>' : ''}
            ${hasWos ? '<span class="badge badge-wos">Web of Science</span>' : ''}
            ${hasDoaj ? '<span class="badge badge-doaj">DOAJ Open Access</span>' : ''}
          </div>
          <span class="text-[11px] font-mono text-slate-400 shrink-0">${journal.frequency}</span>
        </div>

        <h3 class="font-bold text-slate-900 text-sm leading-snug mb-1 hover:text-sky-600 transition-colors">
          ${escapeHtml(journal.name)}
        </h3>
        
        ${journal.originalName && journal.originalName !== journal.name ? `
          <p class="text-xs text-slate-500 italic mb-2">${escapeHtml(journal.originalName)}</p>
        ` : ''}

        <p class="text-xs text-slate-600 mb-2 line-clamp-1">
          <span class="font-medium text-slate-700">Выдавец:</span> ${escapeHtml(journal.publisher)}
        </p>

        <div class="flex flex-wrap gap-1 mb-2">
          ${journal.disciplines.map(d => `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${d}</span>`).join('')}
        </div>

        <!-- Выразнае вылучэнне моў публікацыі -->
        <div class="flex items-center gap-1.5 flex-wrap mb-2.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-0.5 flex items-center gap-1 shrink-0">
            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>
            <span>Мовы:</span>
          </span>
          ${renderLanguageBadges(journal.languages)}
        </div>

        <div class="text-xs text-slate-600 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
          <span class="font-semibold text-slate-800">Тэматыка:</span>
          <span class="line-clamp-2 mt-0.5 text-slate-600">${escapeHtml(journal.primaryTopics.join(' • '))}</span>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <div class="flex items-center gap-1 text-slate-600">
            <span class="${isFree ? 'text-emerald-700 font-semibold' : 'text-slate-600'}">
              ${isFree ? '✓ Бясплатная публікацыя' : 'Аплатныя ўмовы / гібрыд'}
            </span>
          </div>

          <button 
            onclick="event.stopPropagation(); openJournalModal('${journal.id}')"
            class="text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 hover:underline">
            <span>Дэталі і спасылкі</span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>
        </div>

      </div>
    `;
  }).join('');
}

/**
 * Выбар часопіса са спісу: сфакусаваць на карце і падсвяціць
 */
function selectJournal(id) {
  const journal = JOURNALS_DATA.find(j => j.id === id);
  if (!journal) return;

  activeJournalId = id;
  highlightJournalCard(id);

  // Центруем карту на часопісе
  map.setView(journal.coordinates, 12, { animate: true });

  // Адкрываем popup адпаведнага маркера
  markersLayer.eachLayer(layer => {
    if (layer.getLatLng) {
      const pos = layer.getLatLng();
      const dist = Math.hypot(pos.lat - journal.coordinates[0], pos.lng - journal.coordinates[1]);
      if (dist < 0.01) {
        layer.openPopup();
      }
    }
  });
}

/**
 * Падсветка актыўнай карткі ў спісе
 */
function highlightJournalCard(id) {
  document.querySelectorAll(".journal-card").forEach(c => c.classList.remove("active"));
  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.classList.add("active");
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

/**
 * Адкрыццё падрабязнага мадальнага акна
 */
function openJournalModal(id) {
  const journal = JOURNALS_DATA.find(j => j.id === id);
  if (!journal) return;

  const modal = document.getElementById("journal-modal");
  const modalContent = document.getElementById("modal-body");

  const hasVak = journal.indexing.includes("ВАК Беларусі");
  const hasScopus = journal.indexing.includes("Scopus");
  const hasWos = journal.indexing.includes("Web of Science");
  const hasDoaj = journal.indexing.includes("DOAJ");

  modalContent.innerHTML = `
    <!-- Загаловак -->
    <div class="border-b border-slate-200 pb-4 mb-4">
      <div class="flex items-center gap-2 mb-2 flex-wrap">
        <span class="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 flex items-center gap-1">
          <span>${getMarkerIcon(journal.countryCode)}</span>
          <span>${journal.city}, ${journal.country}</span>
        </span>
        ${hasVak ? '<span class="badge badge-vak text-xs px-2.5 py-1">Пералік ВАК Беларусі</span>' : ''}
        ${hasScopus ? '<span class="badge badge-scopus text-xs px-2.5 py-1">Scopus (' + (journal.quartile || '') + ')</span>' : ''}
        ${hasWos ? '<span class="badge badge-wos text-xs px-2.5 py-1">Web of Science</span>' : ''}
        ${hasDoaj ? '<span class="badge badge-doaj text-xs px-2.5 py-1">DOAJ Open Access</span>' : ''}
      </div>

      <h2 class="text-xl font-bold text-slate-900 leading-tight mb-1">
        ${escapeHtml(journal.name)}
      </h2>

      ${journal.originalName ? `
        <p class="text-sm text-slate-500 italic mb-2">${escapeHtml(journal.originalName)}</p>
      ` : ''}

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <div><strong class="text-slate-800">Выдавец:</strong> ${escapeHtml(journal.publisher)}</div>
        ${journal.issn ? `<div><strong class="text-slate-800">ISSN:</strong> <span class="font-mono">${escapeHtml(journal.issn)}</span></div>` : ''}
        <div><strong class="text-slate-800">Перыядычнасць:</strong> ${escapeHtml(journal.frequency)}</div>
      </div>
    </div>

    <!-- Выразнае вылучэнне моў публікацыі -->
    <div class="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border-2 border-emerald-300 rounded-xl p-3.5 mb-5 shadow-xs">
      <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <span class="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
          <svg class="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>
          <span>Мовы публікацыі артыкула</span>
        </span>
        ${journal.languages.includes("беларуская") ? '<span class="text-[11px] font-bold text-emerald-900 bg-white px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">✓ Можна падаваць па-беларуску</span>' : '<span class="text-[11px] text-slate-500">Артыкулы прымаюцца толькі на названых мовах</span>'}
      </div>
      <div class="flex flex-wrap gap-2">
        ${renderLanguageBadges(journal.languages)}
      </div>
    </div>

    <!-- Тэматычны профіль -->
    <div class="mb-5">
      <h3 class="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5 text-sky-700">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
        На якія тэмы друкуюцца даследчыкі
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        ${journal.primaryTopics.map(topic => `
          <div class="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 flex items-start gap-2">
            <span class="text-sky-500 font-bold">•</span>
            <span>${escapeHtml(topic)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Умовы і патрабаванні -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      <div class="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5">
        <h4 class="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1.5">Патрабаванні да аўтараў і артыкулаў</h4>
        <p class="text-xs text-blue-950 leading-relaxed mb-3">${escapeHtml(journal.guidelines)}</p>
        <div class="text-[11px] text-blue-900 space-y-1">
          <div><strong>Мовы публікацыі:</strong> ${journal.languages.join(', ')}</div>
          <div><strong>Мадэль доступу:</strong> ${escapeHtml(journal.accessType)}</div>
        </div>
      </div>

      <div class="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
        <h4 class="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-1.5">Фінансавыя ўмовы (APC)</h4>
        <p class="text-xs text-emerald-950 leading-relaxed font-medium mb-3">${escapeHtml(journal.apc)}</p>
        
        <h4 class="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-1">Парады для беларускіх навукоўцаў</h4>
        <p class="text-xs text-emerald-900 leading-relaxed">${escapeHtml(journal.notes)}</p>
      </div>
    </div>

    <!-- Кантакты і адрас -->
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 text-xs text-slate-700 space-y-2">
      <div class="flex items-start gap-2">
        <svg class="w-4 h-4 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <div><strong>Рэдакцыйны адрас:</strong> ${escapeHtml(journal.address)}</div>
      </div>
      ${journal.coordinates ? `
        <div class="text-[11px] text-slate-500 pl-6">
          Дакладныя каардынаты: <span class="font-mono">${journal.coordinates[0]}, ${journal.coordinates[1]}</span>
        </div>
      ` : ''}
    </div>

    <!-- Кнопкі пераходу -->
    <div class="flex flex-wrap items-center gap-3 pt-2">
      <a 
        href="${journal.website}" 
        target="_blank" 
        rel="noopener noreferrer"
        class="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs py-2.5 px-5 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
        <span>Афіцыйны сайт часопіса</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
      </a>

      ${journal.submissionUrl ? `
        <a 
          href="${journal.submissionUrl}" 
          target="_blank" 
          rel="noopener noreferrer"
          class="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-2.5 px-5 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
          <span>Партал падачы артыкулаў (Submit)</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        </a>
      ` : ''}

      <button 
        onclick="closeJournalModal()"
        class="ml-auto bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2.5 px-4 rounded-lg font-medium transition-colors">
        Закрыць
      </button>
    </div>
  `;

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

/**
 * Закрыццё мадальнага акна
 */
function closeJournalModal() {
  const modal = document.getElementById("journal-modal");
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

/**
 * Ініцыялізацыя слухачоў падзей
 */
function initEventListeners() {
  // Пошук з debounce
  const searchInput = document.getElementById("search-input");
  let timeout = null;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      filters.searchQuery = e.target.value.trim().toLowerCase();
      applyFilters();
    }, 200);
  });

  // Закрыццё мадалкі па кліку на фон альбо Esc
  const modal = document.getElementById("journal-modal");
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeJournalModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeJournalModal();
  });

  // Кнопкі экспарту
  document.getElementById("btn-export-json")?.addEventListener("click", exportToJson);
  document.getElementById("btn-export-csv")?.addEventListener("click", exportToCsv);
}

/**
 * Ініцыялізацыя селектаў і кнопак фільтрацыі
 */
function initFilters() {
  // Фільтр па краінах
  document.querySelectorAll("[data-filter-country]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll("[data-filter-country]").forEach(b => {
        b.classList.remove("bg-sky-600", "text-white");
        b.classList.add("bg-white", "text-slate-700");
      });
      btn.classList.add("bg-sky-600", "text-white");
      btn.classList.remove("bg-white", "text-slate-700");
      filters.country = btn.getAttribute("data-filter-country");
      applyFilters();
    });
  });

  // Селекты дысцыплін і індэксацыі
  const disciplineSelect = document.getElementById("select-discipline");
  disciplineSelect?.addEventListener("change", (e) => {
    filters.discipline = e.target.value;
    applyFilters();
  });

  const indexingSelect = document.getElementById("select-indexing");
  indexingSelect?.addEventListener("change", (e) => {
    filters.indexing = e.target.value;
    applyFilters();
  });

  const apcSelect = document.getElementById("select-apc");
  apcSelect?.addEventListener("change", (e) => {
    filters.apc = e.target.value;
    applyFilters();
  });

  // Селект мовы
  const languageSelect = document.getElementById("select-language");
  languageSelect?.addEventListener("change", (e) => {
    filters.language = e.target.value;
    updateQuickBelBtn();
    applyFilters();
  });

  // Хуткая кнопка «Толькі з беларускай мовай»
  const quickBelBtn = document.getElementById("btn-quick-belarusian");
  quickBelBtn?.addEventListener("click", () => {
    if (filters.language === "беларуская") {
      filters.language = "all";
      if (languageSelect) languageSelect.value = "all";
    } else {
      filters.language = "беларуская";
      if (languageSelect) languageSelect.value = "беларуская";
    }
    updateQuickBelBtn();
    applyFilters();
  });
}

function updateQuickBelBtn() {
  const btn = document.getElementById("btn-quick-belarusian");
  if (!btn) return;
  if (filters.language === "беларуская") {
    btn.classList.add("bg-emerald-600", "text-white", "border-emerald-600");
    btn.classList.remove("bg-emerald-50", "text-emerald-800", "border-emerald-300");
  } else {
    btn.classList.remove("bg-emerald-600", "text-white", "border-emerald-600");
    btn.classList.add("bg-emerald-50", "text-emerald-800", "border-emerald-300");
  }
}

/**
 * Ужыванне ўсіх фільтраў
 */
function applyFilters() {
  currentFilteredData = JOURNALS_DATA.filter(journal => {
    // 1. Пошук па тэксце
    if (filters.searchQuery) {
      const q = filters.searchQuery;
      const matchText = (
        journal.name.toLowerCase().includes(q) ||
        (journal.originalName && journal.originalName.toLowerCase().includes(q)) ||
        journal.publisher.toLowerCase().includes(q) ||
        journal.city.toLowerCase().includes(q) ||
        journal.country.toLowerCase().includes(q) ||
        journal.primaryTopics.some(t => t.toLowerCase().includes(q)) ||
        journal.disciplines.some(d => d.toLowerCase().includes(q)) ||
        journal.indexing.some(i => i.toLowerCase().includes(q)) ||
        (journal.issn && journal.issn.toLowerCase().includes(q))
      );
      if (!matchText) return false;
    }

    // 2. Краіна
    if (filters.country !== "all") {
      if (journal.countryCode !== filters.country) return false;
    }

    // 3. Галіна навукі
    if (filters.discipline !== "all") {
      if (!journal.disciplines.includes(filters.discipline)) return false;
    }

    // 4. Індэксацыя
    if (filters.indexing !== "all") {
      if (!journal.indexing.includes(filters.indexing)) return false;
    }

    // 5. Кошт публікацыі (APC)
    if (filters.apc === "free") {
      const isFree = journal.apc.toLowerCase().includes("бясплатна") || journal.apc.toLowerCase().includes("адсутнічае");
      if (!isFree) return false;
    }

    // 6. Мова публікацыі
    if (filters.language !== "all") {
      const targetLang = filters.language.toLowerCase().trim();
      const hasLang = journal.languages.some(l => l.toLowerCase().trim() === targetLang);
      if (!hasLang) return false;
    }

    return true;
  });

  renderMarkers(currentFilteredData);
  renderJournalCards(currentFilteredData);
  updateStats();
}

/**
 * Скінуць усе фільтры
 */
function resetFilters() {
  filters.searchQuery = "";
  filters.country = "all";
  filters.discipline = "all";
  filters.indexing = "all";
  filters.apc = "all";
  filters.language = "all";

  document.getElementById("search-input").value = "";
  document.getElementById("select-discipline").value = "all";
  document.getElementById("select-indexing").value = "all";
  document.getElementById("select-apc").value = "all";
  const langSelect = document.getElementById("select-language");
  if (langSelect) langSelect.value = "all";
  updateQuickBelBtn();

  document.querySelectorAll("[data-filter-country]").forEach(b => {
    b.classList.remove("bg-sky-600", "text-white");
    b.classList.add("bg-white", "text-slate-700");
  });
  const allBtn = document.querySelector('[data-filter-country="all"]');
  if (allBtn) {
    allBtn.classList.add("bg-sky-600", "text-white");
    allBtn.classList.remove("bg-white", "text-slate-700");
  }

  applyFilters();
}

/**
 * Абнаўленне лічбаў статыстыкі
 */
function updateStats() {
  const total = JOURNALS_DATA.length;
  const vakCount = JOURNALS_DATA.filter(j => j.indexing.includes("ВАК Беларусі")).length;
  const scopusCount = JOURNALS_DATA.filter(j => j.indexing.includes("Scopus") || j.indexing.includes("Web of Science")).length;
  const freeCount = JOURNALS_DATA.filter(j => j.apc.toLowerCase().includes("бясплатна")).length;

  const statTotal = document.getElementById("stat-total");
  const statVak = document.getElementById("stat-vak");
  const statScopus = document.getElementById("stat-scopus");
  const statFree = document.getElementById("stat-free");

  if (statTotal) statTotal.textContent = total;
  if (statVak) statVak.textContent = vakCount;
  if (statScopus) statScopus.textContent = scopusCount;
  if (statFree) statFree.textContent = freeCount;
}

/**
 * Экспарт даных у фармаце JSON
 */
function exportToJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentFilteredData, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `belarus_journals_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Экспарт даных у фармаце CSV
 */
function exportToCsv() {
  if (currentFilteredData.length === 0) return;

  const headers = ["ID", "Назва", "Арыгінальная назва", "Краіна", "Горад", "Выдавец", "Дысцыпліны", "Індэксацыя", "APC", "Сайт"];
  const rows = currentFilteredData.map(j => [
    j.id,
    `"${j.name.replace(/"/g, '""')}"`,
    `"${(j.originalName || '').replace(/"/g, '""')}"`,
    j.country,
    j.city,
    `"${j.publisher.replace(/"/g, '""')}"`,
    `"${j.disciplines.join(', ')}"`,
    `"${j.indexing.join(', ')}"`,
    `"${j.apc.replace(/"/g, '""')}"`,
    j.website
  ]);

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `belarus_journals_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Дапаможная функцыя для экранізацыі HTML
 */
function escapeHtml(string) {
  if (!string) return "";
  return String(string)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

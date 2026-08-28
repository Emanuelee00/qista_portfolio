import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Circle, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import AlertsPanel from './components/AlertsPanel'
import ComparePanel from './components/ComparePanel'
import INatObservations from './components/INatObservations'
import TrendChart from './components/TrendChart'
import TourismImpact from './components/TourismImpact'
import ExportPDF from './components/ExportPDF'

const RISK_COLORS = { E: '#FF4D4D', D: '#FF8C42', C: '#FFD93D', B: '#6BCB77', A: '#3DA35D' }
const RISK_GLOW = { E: 'rgba(255,77,77,0.6)', D: 'rgba(255,140,66,0.35)', C: 'rgba(255,217,61,0.2)', B: 'rgba(107,203,119,0.1)', A: 'rgba(61,163,93,0.05)' }
const RISK_LABELS = { E: 'Critique', D: 'Eleve', C: 'Modere', B: 'Faible', A: 'Tres faible' }
const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const LANGS = [
  { code: 'fr', label: '🇫🇷 FR' },
  { code: 'en', label: '🇬🇧 EN' },
  { code: 'it', label: '🇮🇹 IT' },
  { code: 'es', label: '🇪🇸 ES' },
  { code: 'ar', label: '🇸🇦 AR' },
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'ru', label: '🇷🇺 RU' },
]

const UI_TEXT = {
  fr: {
    compare: 'Comparer',
    bornes: 'Piege Qista',
    mosquitoesOnly: 'Moustiques seuls',
    gbifOnly: 'GBIF seuls',
    liveMode: 'Mode Live',
    loading: 'Chargement...',
    zoomHint: 'Observations visibles - active "Moustiques seuls" pour voir seulement les points, clic pour photo/details',
    mosqLegendTitle: 'Especes de moustiques',
    gbifLegendTitle: 'Especes GBIF',
    spAlbopictus: 'Aedes albopictus',
    spAegypti: 'Aedes aegypti',
    spCulex: 'Culex pipiens',
    spAnopheles: 'Anopheles spp.',
    spOtherAedes: 'Autres Aedes',
    spOther: 'Autres moustiques',
    timeTitle: 'Filtre temporel',
    from: 'De',
    to: 'A',
    showing: 'Affichage',
    inPeriod: 'dans la periode',
    lockWindow: 'Fenetre fixe',
    showTrail: 'Afficher le parcours',
    weekMode: 'Mode hebdomadaire (2 ans)',
    weekFrom: 'Semaine debut',
    weekTo: 'Semaine fin',
    forecastOnly: 'Previsions',
    forecastLegendTitle: 'Projection future',
    forecastSpeciesTitle: 'Especes projetees (GBIF)',
    forecastWeek: 'Horizon',
    forecastChartTitle: 'Projection hebdomadaire (52 semaines)',
    forecastTrajTitle: 'Trajectoires probables',
    forecastProb: 'Probabilite',
    climateOnly: 'Climat',
    climateLegendTitle: 'Couche climat',
    climateTemp: 'Temperature',
    climateHumidity: 'Humidite',
    climatePrecip: 'Precipitations',
    climateLoading: 'Chargement climat...',
    minutePanelTitle: 'Estimation percue par minute',
    minutePanelSelectHint: 'Selectionne un point sur la carte ou une trajectoire probable pour voir l estimation locale.',
    minuteTrajectory: 'Trajectoire',
    minuteWeek: 'Semaine',
    minuteWeeklyPoint: 'Total hebdomadaire point',
    minuteWeeklyRange: 'Intervalle hebdomadaire',
    minuteAvg24h: 'Moyenne/minute (24h)',
    minutePerceivedActive: 'Percues/min (periode active)',
    minuteLevel: 'Niveau',
    minuteLevelLow: 'Presence basse',
    minuteLevelMedium: 'Presence moyenne',
    minuteLevelHigh: 'Presence elevee',
    minuteNote: 'Estimation basee sur le point/la trajectoire selectionnee, pas une mesure capteur temps reel.',
    forecastOrderLabel: 'Ordre',
    forecastSortProbability: 'Probabilite',
    forecastSortMosquitoes: 'N. moustiques estimes' 
  },
  en: {
    compare: 'Compare',
    bornes: 'Trap Stations',
    mosquitoesOnly: 'Mosquitoes only',
    gbifOnly: 'GBIF only',
    liveMode: 'Live Mode',
    loading: 'Loading...',
    zoomHint: 'Observations visible - enable "Mosquitoes only" to see points only, click for photo/details',
    mosqLegendTitle: 'Mosquito species',
    gbifLegendTitle: 'GBIF species',
    spAlbopictus: 'Aedes albopictus',
    spAegypti: 'Aedes aegypti',
    spCulex: 'Culex pipiens',
    spAnopheles: 'Anopheles spp.',
    spOtherAedes: 'Other Aedes',
    spOther: 'Other mosquitoes',
    timeTitle: 'Time filter',
    from: 'From',
    to: 'To',
    showing: 'Showing',
    inPeriod: 'in period',
    lockWindow: 'Fixed window',
    showTrail: 'Show trail',
    weekMode: 'Weekly mode (2 years)',
    weekFrom: 'Week start',
    weekTo: 'Week end',
    forecastOnly: 'Forecast',
    forecastLegendTitle: 'Future projection',
    forecastSpeciesTitle: 'Projected species (GBIF)',
    forecastWeek: 'Horizon',
    forecastChartTitle: 'Weekly projection (52 weeks)',
    forecastTrajTitle: 'Most likely paths',
    forecastProb: 'Probability',
    climateOnly: 'Climate',
    climateLegendTitle: 'Climate layer',
    climateTemp: 'Temperature',
    climateHumidity: 'Humidity',
    climatePrecip: 'Precipitation',
    climateLoading: 'Loading climate...',
    minutePanelTitle: 'Per-minute perceived estimate',
    minutePanelSelectHint: 'Select a map point or a likely trajectory to view local estimate.',
    minuteTrajectory: 'Trajectory',
    minuteWeek: 'Week',
    minuteWeeklyPoint: 'Weekly total at point',
    minuteWeeklyRange: 'Weekly range',
    minuteAvg24h: 'Average/minute (24h)',
    minutePerceivedActive: 'Perceived/min (active period)',
    minuteLevel: 'Level',
    minuteLevelLow: 'Low presence',
    minuteLevelMedium: 'Medium presence',
    minuteLevelHigh: 'High presence',
    minuteNote: 'Estimate based on selected point/trajectory, not a real-time sensor count.',
    forecastOrderLabel: 'Order',
    forecastSortProbability: 'Probability',
    forecastSortMosquitoes: 'Est. mosquitoes',
  },
  it: {
    compare: 'Confronta',
    bornes: 'Stazioni Qista',
    mosquitoesOnly: 'Solo zanzare',
    gbifOnly: 'Solo GBIF',
    liveMode: 'Modalita Live',
    loading: 'Caricamento...',
    zoomHint: 'Osservazioni visibili - attiva "Solo zanzare" per vedere solo i punti, clic per foto/dettagli',
    mosqLegendTitle: 'Specie di zanzare',
    gbifLegendTitle: 'Specie GBIF',
    spAlbopictus: 'Aedes albopictus',
    spAegypti: 'Aedes aegypti',
    spCulex: 'Culex pipiens',
    spAnopheles: 'Anopheles spp.',
    spOtherAedes: 'Altri Aedes',
    spOther: 'Altre zanzare',
    timeTitle: 'Filtro temporale',
    from: 'Da',
    to: 'A',
    showing: 'Visualizzo',
    inPeriod: 'nel periodo',
    lockWindow: 'Finestra fissa',
    showTrail: 'Mostra percorso',
    weekMode: 'Modalita settimanale (2 anni)',
    weekFrom: 'Settimana inizio',
    weekTo: 'Settimana fine',
    forecastOnly: 'Previsioni',
    forecastLegendTitle: 'Proiezione futura',
    forecastSpeciesTitle: 'Specie previste (GBIF)',
    forecastWeek: 'Orizzonte',
    forecastChartTitle: 'Proiezione settimanale (52 settimane)',
    forecastTrajTitle: 'Traiettorie probabili',
    forecastProb: 'Probabilita',
    climateOnly: 'Clima',
    climateLegendTitle: 'Layer climatico',
    climateTemp: 'Temperatura',
    climateHumidity: 'Umidita',
    climatePrecip: 'Precipitazioni',
    climateLoading: 'Caricamento clima...',
    minutePanelTitle: 'Stima percepite al minuto',
    minutePanelSelectHint: 'Seleziona un puntino in mappa o una traiettoria probabile per vedere la stima locale.',
    minuteTrajectory: 'Traiettoria',
    minuteWeek: 'Settimana',
    minuteWeeklyPoint: 'Totale settimanale punto',
    minuteWeeklyRange: 'Intervallo settimanale',
    minuteAvg24h: 'Media minuto (24h)',
    minutePerceivedActive: 'Percepite/min fascia attiva',
    minuteLevel: 'Livello',
    minuteLevelLow: 'Bassa presenza',
    minuteLevelMedium: 'Media presenza',
    minuteLevelHigh: 'Alta presenza',
    minuteNote: 'Stima calcolata sul puntino/traiettoria selezionata, non valore fisico da sensore.',
    forecastOrderLabel: 'Ordine',
    forecastSortProbability: 'Probabilita',
    forecastSortMosquitoes: 'N. zanzare stimate',
  },
  es: {
    compare: 'Comparar',
    bornes: 'Estaciones Qista',
    mosquitoesOnly: 'Solo mosquitos',
    gbifOnly: 'Solo GBIF',
    liveMode: 'Modo Live',
    loading: 'Cargando...',
    zoomHint: 'Observaciones visibles - activa "Solo mosquitos" para ver solo puntos, clic para foto/detalles',
    mosqLegendTitle: 'Especies de mosquitos',
    gbifLegendTitle: 'Especies GBIF',
    spAlbopictus: 'Aedes albopictus',
    spAegypti: 'Aedes aegypti',
    spCulex: 'Culex pipiens',
    spAnopheles: 'Anopheles spp.',
    spOtherAedes: 'Otros Aedes',
    spOther: 'Otros mosquitos',
    timeTitle: 'Filtro temporal',
    from: 'De',
    to: 'A',
    showing: 'Mostrando',
    inPeriod: 'en el periodo',
    lockWindow: 'Ventana fija',
    showTrail: 'Mostrar recorrido',
    weekMode: 'Modo semanal (2 anos)',
    weekFrom: 'Semana inicio',
    weekTo: 'Semana fin',
    forecastOnly: 'Prevision',
    forecastLegendTitle: 'Proyeccion futura',
    forecastSpeciesTitle: 'Especies proyectadas (GBIF)',
    forecastWeek: 'Horizonte',
    forecastChartTitle: 'Proyeccion semanal (52 semanas)',
    forecastTrajTitle: 'Trayectorias probables',
    forecastProb: 'Probabilidad',
    climateOnly: 'Clima',
    climateLegendTitle: 'Capa climatica',
    climateTemp: 'Temperatura',
    climateHumidity: 'Humedad',
    climatePrecip: 'Precipitacion',
    climateLoading: 'Cargando clima...',
    minutePanelTitle: 'Estimacion percibida por minuto',
    minutePanelSelectHint: 'Selecciona un punto del mapa o una trayectoria probable para ver la estimacion local.',
    minuteTrajectory: 'Trayectoria',
    minuteWeek: 'Semana',
    minuteWeeklyPoint: 'Total semanal del punto',
    minuteWeeklyRange: 'Rango semanal',
    minuteAvg24h: 'Promedio/minuto (24h)',
    minutePerceivedActive: 'Percibidas/min (periodo activo)',
    minuteLevel: 'Nivel',
    minuteLevelLow: 'Presencia baja',
    minuteLevelMedium: 'Presencia media',
    minuteLevelHigh: 'Presencia alta',
    minuteNote: 'Estimacion basada en punto/trayectoria seleccionada, no conteo de sensor en tiempo real.',
    forecastOrderLabel: 'Orden',
    forecastSortProbability: 'Probabilidad',
    forecastSortMosquitoes: 'N. mosquitos estimados',
  },
  ar: {
    compare: 'مقارنة',
    bornes: 'محطات Qista',
    mosquitoesOnly: 'البعوض فقط',
    gbifOnly: 'GBIF فقط',
    liveMode: 'الوضع المباشر',
    loading: 'جاري التحميل...',
    zoomHint: 'المشاهدات ظاهرة - فعّل "البعوض فقط" لرؤية النقاط فقط، انقر للصورة/التفاصيل',
    mosqLegendTitle: 'أنواع البعوض',
    gbifLegendTitle: 'أنواع GBIF',
    spAlbopictus: 'Aedes albopictus',
    spAegypti: 'Aedes aegypti',
    spCulex: 'Culex pipiens',
    spAnopheles: 'Anopheles spp.',
    spOtherAedes: 'أنواع Aedes أخرى',
    spOther: 'بعوض آخر',
    timeTitle: 'مرشح زمني',
    from: 'من',
    to: 'إلى',
    showing: 'عرض',
    inPeriod: 'ضمن الفترة',
    lockWindow: 'نافذة ثابتة',
    showTrail: 'إظهار المسار',
    weekMode: 'وضع أسبوعي (سنتان)',
    weekFrom: 'بداية الأسبوع',
    weekTo: 'نهاية الأسبوع',
    forecastOnly: 'توقعات',
    forecastLegendTitle: 'توقع مستقبلي',
    forecastSpeciesTitle: 'الأنواع المتوقعة (GBIF)',
    forecastWeek: 'الأفق',
    forecastChartTitle: 'توقع أسبوعي (52 أسبوعا)',
    forecastTrajTitle: 'المسارات الأكثر احتمالا',
    forecastProb: 'الاحتمال',
    climateOnly: 'المناخ',
    climateLegendTitle: 'طبقة المناخ',
    climateTemp: 'الحرارة',
    climateHumidity: 'الرطوبة',
    climatePrecip: 'الهطول',
    climateLoading: 'جار تحميل المناخ...',
    minutePanelTitle: 'تقدير محسوس لكل دقيقة',
    minutePanelSelectHint: 'اختر نقطة على الخريطة او مسارا مرجحا لعرض التقدير المحلي.',
    minuteTrajectory: 'المسار',
    minuteWeek: 'الاسبوع',
    minuteWeeklyPoint: 'الاجمالي الاسبوعي للنقطة',
    minuteWeeklyRange: 'النطاق الاسبوعي',
    minuteAvg24h: 'المتوسط/دقيقة (24 ساعة)',
    minutePerceivedActive: 'محسوس/دقيقة (الفترة النشطة)',
    minuteLevel: 'المستوى',
    minuteLevelLow: 'حضور منخفض',
    minuteLevelMedium: 'حضور متوسط',
    minuteLevelHigh: 'حضور مرتفع',
    minuteNote: 'تقدير مبني على النقطة/المسار المختار وليس قياس مستشعر لحظي.',
    forecastOrderLabel: 'الترتيب',
    forecastSortProbability: 'الاحتمال',
    forecastSortMosquitoes: 'عدد البعوض المقدر',
  },
  zh: {
    compare: '对比',
    bornes: 'Qista 设备',
    mosquitoesOnly: '仅蚊子',
    gbifOnly: '仅 GBIF',
    liveMode: '实时模式',
    loading: '加载中...',
    zoomHint: '可见观测点 - 开启“仅蚊子”只看点位，点击查看照片/详情',
    mosqLegendTitle: '蚊子种类',
    gbifLegendTitle: 'GBIF 物种',
    spAlbopictus: 'Aedes albopictus',
    spAegypti: 'Aedes aegypti',
    spCulex: 'Culex pipiens',
    spAnopheles: 'Anopheles spp.',
    spOtherAedes: '其他 Aedes',
    spOther: '其他蚊子',
    timeTitle: '时间筛选',
    from: '从',
    to: '到',
    showing: '显示',
    inPeriod: '在时间段内',
    lockWindow: '固定窗口',
    showTrail: '显示轨迹',
    weekMode: '按周模式（2年）',
    weekFrom: '开始周',
    weekTo: '结束周',
    forecastOnly: '预测',
    forecastLegendTitle: '未来预测',
    forecastSpeciesTitle: '预测物种（GBIF）',
    forecastWeek: '时间范围',
    forecastChartTitle: '每周预测（52周）',
    forecastTrajTitle: '高概率轨迹',
    forecastProb: '概率',
    climateOnly: '气候',
    climateLegendTitle: '气候图层',
    climateTemp: '温度',
    climateHumidity: '湿度',
    climatePrecip: '降水',
    climateLoading: '气候加载中...',
    minutePanelTitle: '每分钟体感估计',
    minutePanelSelectHint: '选择地图点或可能轨迹以查看本地估计。',
    minuteTrajectory: '轨迹',
    minuteWeek: '周',
    minuteWeeklyPoint: '该点每周总量',
    minuteWeeklyRange: '每周区间',
    minuteAvg24h: '平均/分钟(24小时)',
    minutePerceivedActive: '体感/分钟(活跃时段)',
    minuteLevel: '等级',
    minuteLevelLow: '低',
    minuteLevelMedium: '中',
    minuteLevelHigh: '高',
    minuteNote: '该估计基于所选点/轨迹，不是实时传感器计数。',
    forecastOrderLabel: '排序',
    forecastSortProbability: '概率',
    forecastSortMosquitoes: '估计蚊子数',
  },
  ru: {
    compare: 'Сравнить',
    bornes: 'Станции Qista',
    mosquitoesOnly: 'Только комары',
    gbifOnly: 'Только GBIF',
    liveMode: 'Live режим',
    loading: 'Загрузка...',
    zoomHint: 'Наблюдения видны - включите "Только комары", чтобы видеть только точки, клик для фото/деталей',
    mosqLegendTitle: 'Виды комаров',
    gbifLegendTitle: 'Виды GBIF',
    spAlbopictus: 'Aedes albopictus',
    spAegypti: 'Aedes aegypti',
    spCulex: 'Culex pipiens',
    spAnopheles: 'Anopheles spp.',
    spOtherAedes: 'Другие Aedes',
    spOther: 'Другие комары',
    timeTitle: 'Фильтр по времени',
    from: 'С',
    to: 'По',
    showing: 'Показано',
    inPeriod: 'за период',
    lockWindow: 'Фиксированное окно',
    showTrail: 'Показать траекторию',
    weekMode: 'Недельный режим (2 года)',
    weekFrom: 'Начальная неделя',
    weekTo: 'Конечная неделя',
    forecastOnly: 'Прогноз',
    forecastLegendTitle: 'Будущая проекция',
    forecastSpeciesTitle: 'Прогнозируемые виды (GBIF)',
    forecastWeek: 'Горизонт',
    forecastChartTitle: 'Недельный прогноз (52 недели)',
    forecastTrajTitle: 'Наиболее вероятные траектории',
    forecastProb: 'Вероятность',
    climateOnly: 'Климат',
    climateLegendTitle: 'Климатический слой',
    climateTemp: 'Температура',
    climateHumidity: 'Влажность',
    climatePrecip: 'Осадки',
    climateLoading: 'Загрузка климата...',
    minutePanelTitle: 'Оценка воспринимаемых в минуту',
    minutePanelSelectHint: 'Выберите точку на карте или вероятную траекторию для локальной оценки.',
    minuteTrajectory: 'Траектория',
    minuteWeek: 'Неделя',
    minuteWeeklyPoint: 'Недельный итог точки',
    minuteWeeklyRange: 'Недельный диапазон',
    minuteAvg24h: 'Среднее/минута (24ч)',
    minutePerceivedActive: 'Воспринимается/мин (активный период)',
    minuteLevel: 'Уровень',
    minuteLevelLow: 'Низкий',
    minuteLevelMedium: 'Средний',
    minuteLevelHigh: 'Высокий',
    minuteNote: 'Оценка по выбранной точке/траектории, не показание датчика в реальном времени.',
    forecastOrderLabel: 'Сортировка',
    forecastSortProbability: 'Вероятность',
    forecastSortMosquitoes: 'Оценка комаров',
  },
}

const MOSQ_SPECIES_COLORS = {
  albopictus: '#FF4D4D',
  aegypti: '#FF8C42',
  culex: '#FFD93D',
  anopheles: '#6BCB77',
  otherAedes: '#B084F5',
  other: '#4DA6FF',
}
const DEFAULT_SELECTED_SPECIES = new Set()

function detectMosquitoSpeciesKey(point) {
  const txt = `${point?.scientific || ''} ${point?.species || ''}`.toLowerCase()
  if (txt.includes('aedes albopictus') || txt.includes('tiger')) return 'albopictus'
  if (txt.includes('aedes aegypti')) return 'aegypti'
  if (txt.includes('culex pipiens') || txt.includes('culex')) return 'culex'
  if (txt.includes('anopheles')) return 'anopheles'
  if (txt.includes('aedes')) return 'otherAedes'
  return 'other'
}

function dateFromWeekIndex(baseDate, weekIndex) {
  const d = new Date(baseDate)
  d.setDate(d.getDate() + weekIndex * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseObsDate(point, mode = 'inat') {
  const raw = mode === 'gbif' ? (point?.event_date || point?.observed_on) : point?.observed_on
  const d = raw ? new Date(raw) : null
  if (!d || Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d
}

function isoWeekLabel(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr || ''
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7)
  const yy = String(dt.getUTCFullYear()).slice(-2)
  return `${yy}-W${String(weekNo).padStart(2, '0')}`
}

function nearestClimatePoint(lat, lon, climateData) {
  if (!climateData?.length) return null
  let best = null
  let bestD = Infinity
  for (const p of climateData) {
    const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

// Borne stats are generated per-borne (demo data)
function borneStats(b) {
  // Deterministic pseudo-random from id
  const seed = b.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const r = (min, max) => min + (seed * 9301 + 49297) % 233 / 233 * (max - min)
  return {
    ...b,
    installed: b.city === 'Hyeres' ? '2019-2024' : '2024',
    captures_month: Math.round(r(3000, 6500)),
    reduction: Math.round(r(82, 94)),
    radius: 60,
  }
}

const borneIcon = L.divIcon({
  className: 'borne-icon',
  html: '<div class="borne-dot"><div class="borne-ring"></div></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const WEATHER_GRID = [
  {lat:36.7,lon:-4.4},{lat:37.4,lon:-6},{lat:38.7,lon:-9.1},{lat:39.5,lon:2.7},{lat:40.4,lon:-3.7},
  {lat:41.4,lon:2.2},{lat:41.9,lon:12.5},{lat:37.5,lon:15.1},{lat:40.8,lon:14.3},{lat:43.3,lon:5.4},
  {lat:43.6,lon:1.4},{lat:44.5,lon:11.3},{lat:45.5,lon:9.2},{lat:45.8,lon:16},{lat:46.1,lon:14.5},
  {lat:47.5,lon:19},{lat:48.2,lon:16.4},{lat:48.9,lon:2.3},{lat:50.1,lon:14.4},{lat:50.8,lon:4.4},
  {lat:51.5,lon:-0.1},{lat:52.2,lon:21},{lat:52.5,lon:13.4},{lat:52.4,lon:4.9},{lat:53.3,lon:-6.3},
  {lat:55.7,lon:12.6},{lat:59.3,lon:18.1},{lat:60.2,lon:25},{lat:38,lon:23.7},{lat:39.9,lon:32.9},
  {lat:42.7,lon:23.3},{lat:44.4,lon:26.1},{lat:44.8,lon:20.5},{lat:41.3,lon:19.8},{lat:43.9,lon:17.7},
  {lat:35.9,lon:14.5},{lat:35.2,lon:33.4},{lat:46.8,lon:8.2},{lat:47.4,lon:8.5},{lat:48.1,lon:11.6},
  {lat:51,lon:7},{lat:53.6,lon:10},{lat:54.3,lon:18.6},{lat:48.7,lon:17.1},{lat:45.3,lon:18},
  {lat:42.4,lon:18.8},{lat:41,lon:21.4},{lat:43.8,lon:7.6},{lat:37,lon:-8},{lat:42.9,lon:-8.5},
]

function mosquitoFav(t, h, p) {
  let ts = 0; if (t>=20&&t<=35) ts=40-Math.abs(t-27)*(40/8); else if(t>=15&&t<20) ts=(t-15)*(20/5); else if(t>35&&t<=40) ts=(40-t)*(20/5); ts=Math.max(0,ts)
  let hs = 0; if(h>=80) hs=30; else if(h>=60) hs=15+(h-60)*(15/20); else if(h>=40) hs=(h-40)*(15/20)
  let ps = 0; if(p>=20) ps=30; else if(p>=5) ps=15+(p-5); else if(p>=1) ps=(p-1)*(15/4)
  return Math.round(Math.max(0,Math.min(100,ts+hs+ps)))
}
function favToC(fav) { return Math.round(fav*22/100) }
function liveC(w,sc) { const l=favToC(w.fav),sw=Math.min(1,w.fav/50); return Math.min(22,Math.round(sc*0.3+l*0.3+sc*(1-sw)*0.4)) }
function rc(t) { return t>=75?'E':t>=55?'D':t>=40?'C':t>=25?'B':'A' }
function nearest(lat,lon,gw) { let b=null,d=Infinity; for(const p of gw){const dd=(p.lat-lat)**2+(p.lon-lon)**2; if(dd<d){d=dd;b=p}} return b }

// ─── Animated counter ───
function AnimNum({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const start = ref.current || 0
    const diff = value - start
    if (diff === 0) return
    const startTime = performance.now()
    function tick(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      const current = Math.round(start + diff * eased)
      setDisplay(current)
      if (progress < 1) requestAnimationFrame(tick)
      else ref.current = value
    }
    requestAnimationFrame(tick)
  }, [value, duration])
  return <>{display}</>
}

// ─── Circular gauge ───
function CircularGauge({ value, max = 100, color, size = 90 }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(value / max, 1)
  const offset = circ * (1 - pct)
  return (
    <svg width={size} height={size} className="gauge">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out', filter: `drop-shadow(0 0 6px ${color}66)` }} />
      <text x={size/2} y={size/2-6} textAnchor="middle" fill={color} fontSize="22" fontWeight="700"
        fontFamily="Rubik" className="gauge-num">{value}</text>
      <text x={size/2} y={size/2+12} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10"
        fontFamily="Rubik">/100</text>
    </svg>
  )
}

// ─── Search bar ───
function SearchBar({ nutsData, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!nutsData || query.length < 2) { setResults([]); return }
    const q = query.toLowerCase()
    const matches = Object.entries(nutsData)
      .filter(([id, d]) => d.name.toLowerCase().includes(q) || id.toLowerCase().includes(q))
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)
    setResults(matches)
  }, [query, nutsData])

  return (
    <div className="search-container">
      <input className="search-input" type="text" placeholder="Rechercher une region..."
        value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map(([id, d]) => (
            <div key={id} className="search-item" onMouseDown={() => { onSelect(id); setQuery(d.name); setOpen(false) }}>
              <span className="search-name">{d.name}</span>
              <span className="search-score" style={{ color: RISK_COLORS[d.risk_class] }}>{d.total}</span>
              <span className="search-class" style={{ background: RISK_COLORS[d.risk_class] + '33', color: RISK_COLORS[d.risk_class] }}>{d.risk_class}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Top 10 ranking ───
function TopRanking({ nutsData, onSelect }) {
  const top10 = useMemo(() => {
    if (!nutsData) return []
    return Object.entries(nutsData).sort((a, b) => b[1].total - a[1].total).slice(0, 10)
  }, [nutsData])

  return (
    <div className="detail-panel">
      <div className="ranking-header">
        <h2>Top 10 zones a risque</h2>
        <div className="section-label">Classement par score total</div>
      </div>
      <div className="ranking-list">
        {top10.map(([id, d], i) => (
          <div key={id} className="ranking-item" onClick={() => onSelect(id)}>
            <span className="ranking-rank" style={{ color: i < 3 ? RISK_COLORS.E : 'rgba(255,255,255,0.3)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="ranking-info">
              <span className="ranking-name">{d.name}</span>
              <span className="ranking-country">{d.country}</span>
            </div>
            <div className="ranking-score-wrap">
              <span className="ranking-score" style={{ color: RISK_COLORS[d.risk_class] }}>{d.total}</span>
              <span className="ranking-class" style={{ background: RISK_COLORS[d.risk_class] + '22', color: RISK_COLORS[d.risk_class] }}>{d.risk_class}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Score badge ───
function ScoreBadge({ label, value, max = 25 }) {
  const pct = (value / max) * 100
  const color = pct >= 80 ? '#FF4D4D' : pct >= 60 ? '#FF8C42' : pct >= 40 ? '#FFD93D' : pct >= 20 ? '#6BCB77' : '#3DA35D'
  return (
    <div className="score-row">
      <span className="score-label">{label}</span>
      <div className="score-bar-bg">
        <div className="score-bar-fill" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}44` }} />
      </div>
      <span className="score-value">{value}/{max}</span>
    </div>
  )
}

function RiskBadge({ riskClass: cls }) {
  return (
    <div className="risk-badge-container">
      {['A','B','C','D','E'].map(c => (
        <div key={c} className={`risk-badge ${c===cls?'active':''}`} style={{
          background: c===cls ? RISK_COLORS[c] : 'rgba(255,255,255,0.06)',
          color: c===cls ? '#fff' : 'rgba(255,255,255,0.25)',
          boxShadow: c===cls ? `0 0 12px ${RISK_GLOW[c]}` : 'none',
        }}>{c}</div>
      ))}
    </div>
  )
}

function ForecastChart({ forecast }) {
  if (!forecast || !forecast.length) return null
  const maxFav = Math.max(...forecast.map(d => d.fav), 1)
  return (
    <div className="forecast-section">
      <div className="forecast-title">Previsions 7 jours</div>
      <div className="forecast-chart">
        {forecast.map((day, i) => {
          const h = Math.max(3, (day.fav / Math.max(maxFav, 50)) * 50)
          const color = day.fav >= 60 ? '#FF4D4D' : day.fav >= 40 ? '#FF8C42' : day.fav >= 25 ? '#FFD93D' : day.fav >= 10 ? '#6BCB77' : '#3DA35D'
          return (
            <div key={i} className="forecast-day" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="forecast-fav">{day.fav}</div>
              <div className="forecast-bar" style={{ height: `${h}px`, background: color, boxShadow: `0 0 8px ${color}66` }} />
              <div className="forecast-temp">{day.tempMax}°</div>
              <div className="forecast-temp-min">{day.tempMin}°</div>
              <div className="forecast-label">{DAYS_FR[new Date(day.date).getDay()]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Free dark basemaps, no API key. Falls through the list if a provider errors.
const DARK_BASEMAPS = [
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    subdomains: 'abc',
  },
  {
    url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
  },
  {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc',
  },
]

function DarkBaseLayer() {
  const [idx, setIdx] = useState(0)
  const errorCount = useRef(0)
  const bm = DARK_BASEMAPS[idx]
  return (
    <TileLayer
      key={idx}
      url={bm.url}
      attribution={bm.attribution}
      subdomains={bm.subdomains}
      eventHandlers={{
        tileerror: () => {
          errorCount.current += 1
          if (errorCount.current > 4 && idx < DARK_BASEMAPS.length - 1) {
            errorCount.current = 0
            setIdx((i) => i + 1)
          }
        },
      }}
    />
  )
}

function HotspotPulses({ nutsData, zoom }) {
  const hotspots = useMemo(() => {
    if (!nutsData || zoom > 8) return [] // hide when zoomed in, points take over
    return Object.entries(nutsData).filter(([,d]) => d.risk_class === 'E')
      .map(([id,d]) => ({ id, lat: d.lat, lon: d.lon }))
  }, [nutsData, zoom])
  return hotspots.map(h => (
    <CircleMarker key={h.id} center={[h.lat, h.lon]} radius={5}
      pathOptions={{ color: '#FF4D4D', fillColor: '#FF4D4D', fillOpacity: 0.8, weight: 1, className: 'pulse-marker' }} />
  ))
}

function FlyToRegion({ selectedNuts, nutsData }) {
  const map = useMap()
  useEffect(() => {
    if (selectedNuts && nutsData?.[selectedNuts]) {
      const { lat, lon } = nutsData[selectedNuts]
      map.flyTo([lat, lon], 7, { duration: 0.8 })
    }
  }, [selectedNuts, nutsData, map])
  return null
}

// Track zoom level
const COUNTRY_LABELS = [
  { name: 'France', lat: 46.6, lon: 2.5 },
  { name: 'Espagne', lat: 40.0, lon: -3.5 },
  { name: 'Italie', lat: 42.5, lon: 12.5 },
  { name: 'Allemagne', lat: 51.0, lon: 10.5 },
  { name: 'Portugal', lat: 39.6, lon: -8.0 },
  { name: 'Royaume-Uni', lat: 53.5, lon: -1.5 },
  { name: 'Pologne', lat: 52.0, lon: 19.5 },
  { name: 'Roumanie', lat: 45.8, lon: 25.0 },
  { name: 'Grece', lat: 38.5, lon: 23.0 },
  { name: 'Croatie', lat: 45.0, lon: 16.0 },
  { name: 'Autriche', lat: 47.5, lon: 14.5 },
  { name: 'Hongrie', lat: 47.2, lon: 19.5 },
  { name: 'Bulgarie', lat: 42.7, lon: 25.5 },
  { name: 'Belgique', lat: 50.8, lon: 4.5 },
  { name: 'Pays-Bas', lat: 52.3, lon: 5.3 },
  { name: 'Suisse', lat: 46.8, lon: 8.2 },
  { name: 'Tchequia', lat: 49.8, lon: 15.5 },
  { name: 'Slovaquie', lat: 48.7, lon: 19.7 },
  { name: 'Serbie', lat: 44.0, lon: 21.0 },
  { name: 'Slovenie', lat: 46.1, lon: 14.8 },
  { name: 'Turquie', lat: 39.0, lon: 35.0 },
  { name: 'Albanie', lat: 41.0, lon: 20.0 },
  { name: 'Norvege', lat: 62.0, lon: 10.0 },
  { name: 'Suede', lat: 62.0, lon: 16.0 },
  { name: 'Danemark', lat: 56.0, lon: 10.0 },
  { name: 'Irlande', lat: 53.5, lon: -7.5 },
]

function CountryLabels({ zoom }) {
  if (zoom > 6) return null
  return COUNTRY_LABELS.map(c => (
    <Marker key={c.name} position={[c.lat, c.lon]} icon={L.divIcon({
      className: 'country-label',
      html: c.name,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    })} interactive={false} />
  ))
}

function ZoomTracker({ onZoomChange }) {
  const map = useMap()
  useEffect(() => {
    const handler = () => onZoomChange(map.getZoom())
    map.on('zoomend', handler)
    onZoomChange(map.getZoom())
    return () => map.off('zoomend', handler)
  }, [map, onZoomChange])
  return null
}

// Observation points visible at high zoom
function ObservationPoints({ points, zoom, yearRange, activeSpeciesKeys, weeklyMode, weekRange, weekBaseDate }) {
  const visible = zoom >= 4
  const normalized = useMemo(() => {
    if (!points || !points.length) return []

    const inEurope = (lat, lon) => lat >= 34 && lat <= 72 && lon >= -12 && lon <= 42

    return points
      .map((p, i) => {
        if (Array.isArray(p) && p.length >= 2) {
          const lat = Number(p[0])
          const lon = Number(p[1])
          if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inEurope(lat, lon)) return null
          return {
            id: `obs-${i}`,
            lat,
            lon,
            species: 'Moustique',
            source: 'Observation',
            observation_url: null,
            photo_url: null,
            observed_on: null,
            place_guess: null,
          }
        }

        const lat = Number(p?.lat)
        const lon = Number(p?.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inEurope(lat, lon)) return null
        const observedDate = parseObsDate(p, 'inat')
        if (!observedDate) return null
        const observedYear = observedDate.getFullYear()
        if (weeklyMode) {
          const startDate = dateFromWeekIndex(weekBaseDate, weekRange.start)
          const endDate = dateFromWeekIndex(weekBaseDate, weekRange.end + 1)
          if (observedDate < startDate || observedDate >= endDate) return null
        } else {
          if (observedYear < yearRange.start || observedYear > yearRange.end) return null
        }
        const speciesKey = detectMosquitoSpeciesKey(p)
        if (activeSpeciesKeys?.size && !activeSpeciesKeys.has(speciesKey)) return null
        return {
          id: p?.id ?? `obs-${i}`,
          lat,
          lon,
          species: p?.species || p?.scientific || 'Moustique',
          source: p?.source || 'iNaturalist',
          observation_url: p?.observation_url || null,
          photo_url: p?.photo_url || null,
          observed_on: p?.observed_on || null,
          place_guess: p?.place_guess || null,
          speciesKey,
        }
      })
      .filter(Boolean)
  }, [points, yearRange.start, yearRange.end, activeSpeciesKeys, weeklyMode, weekBaseDate, weekRange.end, weekRange.start])

  if (!visible) return null

  return normalized.map((p, i) => (
    <CircleMarker key={p.id || i} center={[p.lat, p.lon]} radius={zoom >= 12 ? 1.8 : zoom >= 8 ? 1.5 : 1.2}
      pathOptions={{
        color: 'rgba(255,255,255,0)',
        fillColor: MOSQ_SPECIES_COLORS[p.speciesKey || detectMosquitoSpeciesKey(p)],
        fillOpacity: 0.95,
        weight: zoom >= 12 ? 8 : zoom >= 8 ? 7 : 6,
      }}
    >
      <Popup className="obs-popup">
        <div className="obs-popup-body">
          <div className="obs-popup-title">{p.species}</div>
          <div className="obs-popup-meta">
            {p.source}
            {p.observed_on ? ` - ${p.observed_on}` : ''}
          </div>
          {p.place_guess && <div className="obs-popup-place">{p.place_guess}</div>}
          {p.photo_url && (
            <img src={p.photo_url} alt={p.species} className="obs-popup-photo" loading="lazy" />
          )}
          {(p.observation_url || p.photo_url || p.id) && (
            <a href={p.observation_url || `https://www.inaturalist.org/observations/${p.id}`} target="_blank" rel="noopener noreferrer" className="obs-popup-link">
              Foto e dettagli
            </a>
          )}
        </div>
      </Popup>
    </CircleMarker>
  ))
}

function GBIFPoints({ points, zoom, yearRange, activeSpeciesKeys, weeklyMode, weekRange, weekBaseDate }) {
  const visible = zoom >= 4
  const normalized = useMemo(() => {
    if (!points?.length) return []
    const inEurope = (lat, lon) => lat >= 34 && lat <= 72 && lon >= -12 && lon <= 42
    return points.map((p, i) => {
      const lat = Number(p?.lat)
      const lon = Number(p?.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inEurope(lat, lon)) return null
      const obsDate = parseObsDate(p, 'gbif')
      if (!obsDate) return null
      const y = obsDate.getFullYear()
      if (weeklyMode) {
        const startDate = dateFromWeekIndex(weekBaseDate, weekRange.start)
        const endDate = dateFromWeekIndex(weekBaseDate, weekRange.end + 1)
        if (obsDate < startDate || obsDate >= endDate) return null
      } else if (y < yearRange.start || y > yearRange.end) {
        return null
      }
      const speciesKey = detectMosquitoSpeciesKey({ species: p?.species, scientific: p?.scientific })
      if (activeSpeciesKeys?.size && !activeSpeciesKeys.has(speciesKey)) return null
      return {
        id: p?.id ?? `gbif-${i}`,
        lat, lon, y, speciesKey,
        species: p?.species || p?.scientific || 'Mosquito',
        scientific: p?.scientific || '',
        event_date: p?.event_date || '',
        country: p?.country || '',
        basis: p?.basis_of_record || '',
        dataset: p?.dataset_name || '',
        occurrence_url: p?.occurrence_url || '',
      }
    }).filter(Boolean)
  }, [points, yearRange.start, yearRange.end, activeSpeciesKeys, weeklyMode, weekBaseDate, weekRange.end, weekRange.start])

  if (!visible) return null

  return normalized.map((p) => (
    <CircleMarker
      key={p.id}
      center={[p.lat, p.lon]}
      radius={zoom >= 12 ? 1.8 : zoom >= 8 ? 1.5 : 1.2}
      pathOptions={{
        color: 'rgba(255,255,255,0)',
        fillColor: MOSQ_SPECIES_COLORS[p.speciesKey],
        fillOpacity: 0.95,
        weight: zoom >= 12 ? 8 : zoom >= 8 ? 7 : 6,
      }}
    >
      <Popup className="obs-popup">
        <div className="obs-popup-body">
          <div className="obs-popup-title">{p.species}</div>
          <div className="obs-popup-meta">GBIF - {p.event_date || p.y}</div>
          {p.scientific && <div className="obs-popup-place">{p.scientific}</div>}
          <div className="obs-popup-place">{[p.country, p.basis].filter(Boolean).join(' - ')}</div>
          {p.dataset && <div className="obs-popup-place">{p.dataset}</div>}
          {(p.occurrence_url || p.id) && (
            <a href={p.occurrence_url || `https://www.gbif.org/occurrence/${p.id}`} target="_blank" rel="noopener noreferrer" className="obs-popup-link">
              Foto e dettagli
            </a>
          )}
        </div>
      </Popup>
    </CircleMarker>
  ))
}

function MosquitoLegend({ t, title, activeSpeciesKeys, onToggle }) {
  const items = [
    { key: 'albopictus', color: MOSQ_SPECIES_COLORS.albopictus, label: t.spAlbopictus },
    { key: 'aegypti', color: MOSQ_SPECIES_COLORS.aegypti, label: t.spAegypti },
    { key: 'culex', color: MOSQ_SPECIES_COLORS.culex, label: t.spCulex },
    { key: 'anopheles', color: MOSQ_SPECIES_COLORS.anopheles, label: t.spAnopheles },
    { key: 'otherAedes', color: MOSQ_SPECIES_COLORS.otherAedes, label: t.spOtherAedes },
    { key: 'other', color: MOSQ_SPECIES_COLORS.other, label: t.spOther },
  ]
  return (
    <div className="mosq-legend">
      <div className="legend-title">{title}</div>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`legend-item legend-btn ${activeSpeciesKeys.has(item.key) ? 'active' : ''}`}
          onClick={() => onToggle(item.key)}
          title={item.label}
        >
          <span className="legend-color" style={{ background: item.color }} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

function MosquitoTimePanel({
  t, minYear, maxYear, yearRange, onChange, visibleCount, lockWindow, onToggleLock,
  showTrail, onToggleTrail, weeklyMode, onToggleWeekly, weekRange, onWeekChange, weekMax,
}) {
  return (
    <div className="mosq-time-panel">
      <div className="legend-title">{t.timeTitle}</div>
      <label className="mosq-lock-row">
        <input type="checkbox" checked={lockWindow} onChange={onToggleLock} />
        <span>{t.lockWindow}</span>
      </label>
      <label className="mosq-lock-row">
        <input type="checkbox" checked={showTrail} onChange={onToggleTrail} />
        <span>{t.showTrail}</span>
      </label>
      <label className="mosq-lock-row">
        <input type="checkbox" checked={weeklyMode} onChange={onToggleWeekly} />
        <span>{t.weekMode}</span>
      </label>
      <div className="mosq-time-labels">
        <span>{weeklyMode ? t.weekFrom : t.from}: <strong>{weeklyMode ? weekRange.start : yearRange.start}</strong></span>
        <span>{weeklyMode ? t.weekTo : t.to}: <strong>{weeklyMode ? weekRange.end : yearRange.end}</strong></span>
      </div>
      {!weeklyMode ? (
        <>
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={yearRange.start}
            className="mosq-slider"
            onChange={(e) => {
              const next = Number(e.target.value)
              onChange({ start: Math.min(next, yearRange.end), end: yearRange.end }, 'start')
            }}
          />
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={yearRange.end}
            className="mosq-slider"
            onChange={(e) => {
              const next = Number(e.target.value)
              onChange({ start: yearRange.start, end: Math.max(next, yearRange.start) }, 'end')
            }}
          />
        </>
      ) : (
        <>
          <input
            type="range"
            min={0}
            max={weekMax}
            value={weekRange.start}
            className="mosq-slider"
            onChange={(e) => {
              const next = Number(e.target.value)
              onWeekChange({ start: Math.min(next, weekRange.end), end: weekRange.end }, 'start')
            }}
          />
          <input
            type="range"
            min={0}
            max={weekMax}
            value={weekRange.end}
            className="mosq-slider"
            onChange={(e) => {
              const next = Number(e.target.value)
              onWeekChange({ start: weekRange.start, end: Math.max(next, weekRange.start) }, 'end')
            }}
          />
        </>
      )}
      <div className="mosq-time-count">{t.showing}: <strong>{visibleCount}</strong> {t.inPeriod}</div>
    </div>
  )
}

function TimeTrailLines({ points, yearRange, activeSpeciesKeys, mode, weeklyMode, weekRange, weekBaseDate }) {
  const positions = useMemo(() => {
    if (!points?.length) return []
    const inEurope = (lat, lon) => lat >= 34 && lat <= 72 && lon >= -12 && lon <= 42

    const rows = points
      .map((p) => {
        const lat = Number(p?.lat)
        const lon = Number(p?.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inEurope(lat, lon)) return null
        const rawDate = mode === 'gbif' ? (p?.event_date || p?.observed_on) : p?.observed_on
        const obsDate = parseObsDate(p, mode)
        if (!obsDate) return null
        const year = obsDate.getFullYear()
        if (weeklyMode) {
          const startDate = dateFromWeekIndex(weekBaseDate, weekRange.start)
          const endDate = dateFromWeekIndex(weekBaseDate, weekRange.end + 1)
          if (obsDate < startDate || obsDate >= endDate) return null
        } else if (year < yearRange.start || year > yearRange.end) {
          return null
        }
        const speciesKey = detectMosquitoSpeciesKey({ species: p?.species, scientific: p?.scientific })
        if (activeSpeciesKeys?.size && !activeSpeciesKeys.has(speciesKey)) return null
        const ts = Date.parse(rawDate || '')
        return { lat, lon, ts: Number.isFinite(ts) ? ts : year * 365 * 24 * 3600 * 1000 }
      })
      .filter(Boolean)
      .sort((a, b) => a.ts - b.ts)

    if (rows.length < 2) return []
    const maxPoints = 1200
    const step = rows.length > maxPoints ? Math.ceil(rows.length / maxPoints) : 1
    return rows.filter((_, i) => i % step === 0).map((r) => [r.lat, r.lon])
  }, [points, yearRange.start, yearRange.end, activeSpeciesKeys, mode, weeklyMode, weekRange.start, weekRange.end, weekBaseDate])

  if (positions.length < 2) return null
  return <Polyline positions={positions} pathOptions={{ color: '#FF4D4D', weight: 1, opacity: 0.65, dashArray: '4 6' }} interactive={false} />
}

function ForecastMapLayer({ forecastData, horizonWeek, activeSpeciesKeys, selectedTrajectoryId, onSelectTrajectory }) {
  const points = useMemo(() => {
    if (!forecastData?.trajectories?.length) return []
    const raw = forecastData.trajectories
      .filter((tr) => activeSpeciesKeys?.has(tr.species_key))
      .map((tr) => {
        const pt = (tr.path || []).find((x) => x.week_index === horizonWeek) || (tr.path || []).slice(-1)[0]
        if (!pt) return null
        return {
          key: tr.id,
          trajectoryId: tr.id,
          lat: pt.lat,
          lon: pt.lon,
          intensity: pt.intensity,
          mosquitoEquivalent: pt.mosquito_equivalent ?? Math.max(1, Math.round((pt.intensity || 0) * 2)),
          mosquitoEquivalentLow: pt.mosquito_equivalent_low ?? null,
          mosquitoEquivalentHigh: pt.mosquito_equivalent_high ?? null,
          speciesKey: tr.species_key,
          speciesLabel: tr.species_label,
          probability: tr.probability,
          validityScore: tr.validity_score,
          rank: tr.rank,
        }
      })
      .filter(Boolean)
      .sort((a, b) => (b.probability || 0) - (a.probability || 0))

    // avoid duplicate markers by coordinate + species, keep highest probability
    const dedup = new Map()
    raw.forEach((p) => {
      const k = `${p.speciesKey}|${Number(p.lat).toFixed(5)}|${Number(p.lon).toFixed(5)}`
      if (!dedup.has(k)) dedup.set(k, p)
    })
    return Array.from(dedup.values())
  }, [forecastData, horizonWeek, activeSpeciesKeys])
  const weekLabel = useMemo(() => {
    if (!forecastData?.weeks?.length) return `+${horizonWeek}`
    const row = forecastData.weeks.find((w) => w.week_index === horizonWeek) || forecastData.weeks[Math.max(0, horizonWeek - 1)]
    return row?.week_start || `+${horizonWeek}`
  }, [forecastData, horizonWeek])

  return points.map((p) => {
    const isSel = !selectedTrajectoryId || selectedTrajectoryId === p.trajectoryId
    return (
      <CircleMarker
        key={p.key}
        center={[p.lat, p.lon]}
        radius={2.2}
        eventHandlers={{ click: () => onSelectTrajectory?.(p.trajectoryId) }}
        pathOptions={{
          color: isSel ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.25)',
          fillColor: MOSQ_SPECIES_COLORS[p.speciesKey] || '#FF4D4D',
          fillOpacity: isSel ? 0.98 : 0.2,
          weight: isSel ? 1.5 : 0.7,
        }}
      >
        <Popup className="obs-popup">
          <div className="obs-popup-body">
            <div className="obs-popup-title">{p.speciesLabel || 'Mosquito forecast'}</div>
            <div className="obs-popup-meta">Pred #{p.rank || '-'} - week +{horizonWeek}</div>
            <div className="obs-popup-meta">Periodo: settimana {weekLabel}</div>
            <div className="obs-popup-meta">Prob: {Math.round(p.probability || 0)}%</div>
            <div className="obs-popup-meta">Validite: {Math.round(p.validityScore || 0)}%</div>
            <div className="obs-popup-meta">Score: {Math.round(p.intensity || 0)}</div>
            <div className="obs-popup-meta">Stima attesa: ~{Math.round(p.mosquitoEquivalent || 0)} zanzare</div>
            {(Number.isFinite(p.mosquitoEquivalentLow) && Number.isFinite(p.mosquitoEquivalentHigh)) && (
              <div className="obs-popup-meta">Intervallo: {Math.round(p.mosquitoEquivalentLow)}-{Math.round(p.mosquitoEquivalentHigh)}</div>
            )}
          </div>
        </Popup>
      </CircleMarker>
    )
  })
}

function ForecastTrajectoryLayer({ forecastData, horizonWeek, activeSpeciesKeys, selectedTrajectoryId, onSelectTrajectory }) {
  const trajectories = useMemo(() => {
    if (!forecastData?.trajectories?.length) return []
    return forecastData.trajectories
      .filter((tr) => activeSpeciesKeys?.has(tr.species_key))
      .map((tr) => ({
        ...tr,
        points: (tr.path || []).filter((p) => p.week_index <= horizonWeek).map((p) => [p.lat, p.lon]),
      }))
      .filter((tr) => tr.points.length >= 2)
      .sort((a, b) => (b.probability || 0) - (a.probability || 0))
  }, [forecastData, activeSpeciesKeys, horizonWeek])

  return trajectories.map((tr, i) => {
    const color = MOSQ_SPECIES_COLORS[tr.species_key] || '#FF4D4D'
    const isSel = !selectedTrajectoryId || selectedTrajectoryId === tr.id
    const rankWeight = Math.max(1, 4 - i * 0.12)
    return (
      <Polyline
        key={tr.id || `${tr.species_key}-${i}`}
        positions={tr.points}
        pathOptions={{
          color,
          opacity: isSel ? 0.22 + Math.min(0.76, (tr.probability || 0) / 100) : 0.08,
          weight: isSel ? rankWeight + 0.8 : 0.8,
          dashArray: '5 6',
        }}
        eventHandlers={{ click: () => onSelectTrajectory?.(tr.id) }}
      >
        <Popup className="obs-popup">
          <div className="obs-popup-body">
            <div className="obs-popup-title">{tr.species_label}</div>
            <div className="obs-popup-meta">Trajectory #{i + 1}</div>
            <div className="obs-popup-meta">Prob: {Math.round(tr.probability || 0)}%</div>
            <div className="obs-popup-meta">Validite: {Math.round(tr.validity_score || 0)}%</div>
            <div className="obs-popup-meta">Backtest: {Math.round(tr.backtest_score || 0)}%</div>
          </div>
        </Popup>
      </Polyline>
    )
  })
}

function ForecastChartPanel({ t, forecastData, horizonWeek, activeSpeciesKeys }) {
  const series = useMemo(() => {
    if (!forecastData?.weeks?.length) return []
    return forecastData.weeks.slice(0, horizonWeek).map((w) => ({
      label: isoWeekLabel(w.week_start),
      date: w.week_start,
      total: (w.hotspots || []).reduce((acc, h) => {
        const speciesKey = detectMosquitoSpeciesKey({ species: h?.species_label, scientific: h?.species_key })
        if (!activeSpeciesKeys?.has(speciesKey)) return acc
        return acc + (Number(h?.mosquito_equivalent) || 0)
      }, 0),
    }))
  }, [forecastData, horizonWeek, activeSpeciesKeys])
  if (!series.length) return null
  const values = series.map((s) => Number(s.total || 0))
  const maxVal = Math.max(...values, 1)
  const minVal = Math.min(...values, 0)
  const w = Math.max(340, series.length * 10)
  const h = 160
  const padX = 16
  const padY = 12
  const innerW = w - padX * 2
  const innerH = h - padY * 2
  const x = (i) => padX + (i / Math.max(1, series.length - 1)) * innerW
  const y = (v) => {
    const tVal = (v - minVal) / Math.max(1e-6, (maxVal - minVal))
    return padY + (1 - tVal) * innerH
  }
  const linePath = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(s.total).toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L ${x(series.length - 1).toFixed(2)} ${(h - padY).toFixed(2)} L ${x(0).toFixed(2)} ${(h - padY).toFixed(2)} Z`
  const tickIndexes = Array.from({ length: 6 }, (_, k) => Math.round((k / 5) * Math.max(0, series.length - 1)))
  const selectedWeek = series[Math.max(0, Math.min(series.length - 1, horizonWeek - 1))]
  return (
    <div className="forecast-side-panel">
      <div className="legend-title">{t.forecastChartTitle}</div>
      <div className="forecast-chart-note">Unita: zanzare stimate per settimana</div>
      <div className="forecast-chart-note">Settimana selezionata: {selectedWeek?.date || '-'}</div>
      <div className="forecast-line-wrap">
        <svg className="forecast-line-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Proiezione settimanale zanzare stimate">
          <path d={areaPath} className="forecast-area" />
          <path d={linePath} className="forecast-line" />
          {series.map((s, i) => (
            <circle key={`pt-${i}`} cx={x(i)} cy={y(s.total)} r={i === series.length - 1 ? 2.8 : 1.8} className="forecast-dot" />
          ))}
        </svg>
      </div>
      <div className="forecast-line-axis">
        {tickIndexes.map((idx, i) => (
          <span key={`tk-${i}`}>{series[idx]?.label || ''}</span>
        ))}
      </div>
      <div className="forecast-line-stats">
        <span>Min {Math.round(minVal)}</span>
        <span>Max {Math.round(maxVal)}</span>
      </div>
    </div>
  )
}

function ForecastMinutePanel({ t, forecastData, horizonWeek, activeSpeciesKeys, selectedTrajectoryId }) {
  const data = useMemo(() => {
    if (!forecastData?.trajectories?.length) return null
    const filtered = forecastData.trajectories.filter((tr) => activeSpeciesKeys?.has(tr.species_key))
    if (!filtered.length) return null

    let tr = null
    if (selectedTrajectoryId) tr = filtered.find((x) => x.id === selectedTrajectoryId) || null
    if (!tr) return null

    const pt = (tr.path || []).find((x) => x.week_index === horizonWeek) || (tr.path || []).slice(-1)[0]
    if (!pt) return null
    const weeklyTotal = Number(pt.mosquito_equivalent || 0)
    const low = Number(pt.mosquito_equivalent_low || weeklyTotal)
    const high = Number(pt.mosquito_equivalent_high || weeklyTotal)
    const perMin24h = weeklyTotal / (7 * 24 * 60)
    // Perceived pressure during active evening window: includes clustering near host and peak-hour concentration.
    const baseActive = weeklyTotal / (7 * 3 * 60) // 3h/day active window
    const clusteringBoost = clamp(3.5 + (weeklyTotal / 24.0), 3.5, 14.0)
    const perMinPerceived = baseActive * clusteringBoost
    let level = 'low'
    if (perMinPerceived >= 1.0) level = 'high'
    else if (perMinPerceived >= 0.25) level = 'medium'
    return {
      selectedLabel: tr.species_label || tr.id,
      weekDate: (forecastData.weeks?.find((w) => w.week_index === (pt.week_index || horizonWeek))?.week_start) || '-',
      trajectoryId: tr.id,
      weeklyTotal,
      weeklyLow: low,
      weeklyHigh: high,
      perMin24h,
      perMinPerceived,
      level,
    }
  }, [forecastData, horizonWeek, activeSpeciesKeys, selectedTrajectoryId])

  if (!selectedTrajectoryId) {
    return (
      <div className="forecast-minute-card">
        <div className="legend-title">{t.minutePanelTitle || 'Stima percepite al minuto'}</div>
        <div className="forecast-minute-note">{t.minutePanelSelectHint || 'Seleziona un puntino in mappa o una traiettoria probabile per vedere la stima locale.'}</div>
      </div>
    )
  }
  if (!data) return null
  const levelText = data.level === 'high'
    ? (t.minuteLevelHigh || 'Alta presenza')
    : data.level === 'medium'
      ? (t.minuteLevelMedium || 'Media presenza')
      : (t.minuteLevelLow || 'Bassa presenza')
  return (
    <div className="forecast-minute-card">
      <div className="legend-title">{t.minutePanelTitle || 'Stima percepite al minuto'}</div>
      <div className="forecast-minute-row">
        <span>{t.minuteTrajectory || 'Traiettoria'}</span>
        <strong>{data.selectedLabel}</strong>
      </div>
      <div className="forecast-minute-row">
        <span>{t.minuteWeek || 'Settimana'}</span>
        <strong>{data.weekDate}</strong>
      </div>
      <div className="forecast-minute-row">
        <span>{t.minuteWeeklyPoint || 'Totale settimanale punto'}</span>
        <strong>{Math.round(data.weeklyTotal)}</strong>
      </div>
      <div className="forecast-minute-row">
        <span>{t.minuteWeeklyRange || 'Intervallo settimanale'}</span>
        <strong>{Math.round(data.weeklyLow)}-{Math.round(data.weeklyHigh)}</strong>
      </div>
      <div className="forecast-minute-row">
        <span>{t.minuteAvg24h || 'Media minuto (24h)'}</span>
        <strong>{data.perMin24h.toFixed(3)}</strong>
      </div>
      <div className="forecast-minute-row">
        <span>{t.minutePerceivedActive || 'Percepite/min fascia attiva'}</span>
        <strong>{data.perMinPerceived.toFixed(2)}</strong>
      </div>
      <div className="forecast-minute-row">
        <span>{t.minuteLevel || 'Livello'}</span>
        <strong>{levelText}</strong>
      </div>
      <div className="forecast-minute-note">{t.minuteNote || 'Stima calcolata sul puntino/traiettoria selezionata, non valore fisico da sensore.'}</div>
    </div>
  )
}

function ForecastTrajectoryLegend({ t, forecastData, activeSpeciesKeys, selectedTrajectoryId, onSelectTrajectory, horizonWeek }) {
  const [sortBy, setSortBy] = useState('probability')
  const rows = useMemo(() => {
    if (!forecastData?.trajectories?.length) return []
    const out = forecastData.trajectories
      .filter((tr) => activeSpeciesKeys?.has(tr.species_key))
      .map((tr) => {
        const pt = (tr.path || []).find((x) => x.week_index === horizonWeek) || (tr.path || []).slice(-1)[0] || {}
        return {
          ...tr,
          mosquitoes: Number(pt?.mosquito_equivalent || 0),
        }
      })
    out.sort((a, b) => {
      if (sortBy === 'mosquitoes') return (b.mosquitoes || 0) - (a.mosquitoes || 0)
      return (b.probability || 0) - (a.probability || 0)
    })
    return out.slice(0, 36)
  }, [forecastData, activeSpeciesKeys, horizonWeek, sortBy])
  const forecastDate = useMemo(() => {
    if (!forecastData?.weeks?.length) return '-'
    const row = forecastData.weeks.find((w) => w.week_index === horizonWeek) || forecastData.weeks[Math.max(0, horizonWeek - 1)]
    return row?.week_start || '-'
  }, [forecastData, horizonWeek])
  if (!rows.length) return null
  return (
    <div className="mosq-legend forecast-traj-legend">
      <div className="legend-title">{t.forecastTrajTitle}</div>
      <div className="legend-item">Date prevision: <strong>{forecastDate}</strong></div>
      <div className="legend-item">Prob = poids relatif du modele</div>
      <div className="legend-item">Val = validite historique (backtest)</div>
      <div className="legend-item forecast-sort-row">
        <span>{t.forecastOrderLabel || 'Ordine'}</span>
        <select className="forecast-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="probability">{t.forecastSortProbability || 'Probabilita'}</option>
          <option value="mosquitoes">{t.forecastSortMosquitoes || 'N. zanzare stimate'}</option>
        </select>
      </div>
      {rows.map((tr, idx) => (
        <button
          key={tr.id || `${tr.species_key}-${idx}`}
          type="button"
          className={`legend-item legend-btn ${selectedTrajectoryId === tr.id ? 'active' : ''}`}
          onClick={() => onSelectTrajectory?.(selectedTrajectoryId === tr.id ? null : tr.id)}
        >
          <span className="legend-color" style={{ background: MOSQ_SPECIES_COLORS[tr.species_key] || '#FF4D4D' }} />
          <span>{idx + 1}. {tr.species_label}</span>
          <span className="traj-prob">{t.forecastProb}: {Math.round(tr.probability || 0)}% | Val: {Math.round(tr.validity_score || 0)}% | ~{Math.round(tr.mosquitoes || 0)} zanz.</span>
        </button>
      ))}
    </div>
  )
}

function ClimateRasterLayer({ data, metric, weekIndex }) {
  if (!data?.length) return null
  const valueOf = (p) => {
    const idx = Math.max(0, weekIndex || 0)
    if (metric === 'temperature_2m') return p?.weekly_temperature_2m_max?.[idx] ?? p?.temperature_2m ?? 0
    if (metric === 'relative_humidity_2m') return p?.weekly_relative_humidity_2m_mean?.[idx] ?? p?.relative_humidity_2m ?? 0
    return p?.weekly_precipitation_sum?.[idx] ?? p?.precipitation ?? 0
  }
  const values = data.map((p) => Number(valueOf(p) || 0))
  const sorted = [...values].sort((a, b) => a - b)
  const p = (q) => sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q)))] ?? 0
  const q25 = p(0.25)
  const q50 = p(0.5)
  const q75 = p(0.75)
  const vMin = sorted[0] ?? 0
  const vMax = sorted[sorted.length - 1] ?? 1
  const getOpacity = (v) => {
    const t = vMax === vMin ? 0.5 : (v - vMin) / (vMax - vMin)
    return 0.36 + t * 0.54
  }
  const getColor = (v) => {
    if (v >= q75) return metric === 'precipitation' ? '#5D00A6' : '#CC1D1D'
    if (v >= q50) return metric === 'precipitation' ? '#005EFF' : '#FF7A1A'
    if (v >= q25) return metric === 'precipitation' ? '#3FA7FF' : '#FFD000'
    return metric === 'precipitation' ? '#BFDFFF' : '#31B86B'
  }
  return data.map((p, i) => (
    <Circle
      key={`climate-${i}`}
      center={[p.lat, p.lon]}
      radius={170000}
      pathOptions={{
        color: 'rgba(255,255,255,0.12)',
        weight: 1,
        fillColor: getColor(valueOf(p)),
        fillOpacity: getOpacity(valueOf(p)),
      }}
    >
      <Popup className="obs-popup">
        <div className="obs-popup-body">
          <div className="obs-popup-title">Climate area</div>
          <div className="obs-popup-meta">Week: {(p.weekly_time && p.weekly_time[Math.max(0, weekIndex || 0)]) || p.climate_time || '-'}</div>
          <div className="obs-popup-meta">Type: {(p.weekly_is_forecast && p.weekly_is_forecast[Math.max(0, weekIndex || 0)]) ? 'Forecast' : 'Historical'}</div>
          <div className="obs-popup-meta">Classe: {valueOf(p) >= q75 ? 'tres elevee' : valueOf(p) >= q50 ? 'elevee' : valueOf(p) >= q25 ? 'moderee' : 'faible'}</div>
          <div className="obs-popup-meta">T: {Math.round(p.weekly_temperature_2m_max?.[Math.max(0, weekIndex || 0)] ?? p.temperature_2m ?? 0)}°C</div>
          <div className="obs-popup-meta">H: {Math.round(p.weekly_relative_humidity_2m_mean?.[Math.max(0, weekIndex || 0)] ?? p.relative_humidity_2m ?? 0)}%</div>
          <div className="obs-popup-meta">P: {((p.weekly_precipitation_sum?.[Math.max(0, weekIndex || 0)] ?? p.precipitation) || 0).toFixed(1)} mm</div>
        </div>
      </Popup>
    </Circle>
  ))
}

function ClimateLegend({ t, metric, onMetricChange, loading, topOffset = 60, weeks = [], weekIndex = 0, onWeekChange, climateData = [], historyWeeks = 156 }) {
  const valueOf = (p) => {
    const idx = Math.max(0, weekIndex || 0)
    if (metric === 'temperature_2m') return p?.weekly_temperature_2m_max?.[idx] ?? p?.temperature_2m ?? 0
    if (metric === 'relative_humidity_2m') return p?.weekly_relative_humidity_2m_mean?.[idx] ?? p?.relative_humidity_2m ?? 0
    return p?.weekly_precipitation_sum?.[idx] ?? p?.precipitation ?? 0
  }
  const vals = (climateData || []).map((p) => Number(valueOf(p) || 0)).sort((a, b) => a - b)
  const pick = (q) => vals[Math.max(0, Math.min(vals.length - 1, Math.floor((vals.length - 1) * q)))] ?? 0
  const unit = metric === 'temperature_2m' ? '°C' : metric === 'relative_humidity_2m' ? '%' : ' mm'
  const ranges = [
    { c: metric === 'precipitation' ? '#BFDFFF' : '#31B86B', t: `Q1 <= ${pick(0.25).toFixed(1)}${unit}` },
    { c: metric === 'precipitation' ? '#3FA7FF' : '#FFD000', t: `Q2 <= ${pick(0.5).toFixed(1)}${unit}` },
    { c: metric === 'precipitation' ? '#005EFF' : '#FF7A1A', t: `Q3 <= ${pick(0.75).toFixed(1)}${unit}` },
    { c: metric === 'precipitation' ? '#5D00A6' : '#CC1D1D', t: `Q4 > ${pick(0.75).toFixed(1)}${unit}` },
  ]
  return (
    <div className="mosq-legend climate-legend" style={{ top: `${topOffset}px` }}>
      <div className="legend-title">{t.climateLegendTitle}</div>
      <button type="button" className={`legend-item legend-btn ${metric === 'temperature_2m' ? 'active' : ''}`} onClick={() => onMetricChange('temperature_2m')}>{t.climateTemp}</button>
      <button type="button" className={`legend-item legend-btn ${metric === 'relative_humidity_2m' ? 'active' : ''}`} onClick={() => onMetricChange('relative_humidity_2m')}>{t.climateHumidity}</button>
      <button type="button" className={`legend-item legend-btn ${metric === 'precipitation' ? 'active' : ''}`} onClick={() => onMetricChange('precipitation')}>{t.climatePrecip}</button>
      {ranges.map((r, i) => (
        <div key={i} className="legend-item climate-legend-row">
          <span className="legend-color" style={{ background: r.c }} />
          <span>{r.t}</span>
        </div>
      ))}
      {weeks.length > 0 && (
        <>
          <div className="legend-item">
            Precipitations/semaine: <strong>{weeks[Math.max(0, Math.min(weekIndex, weeks.length - 1))]}</strong>
          </div>
          <div className="legend-item">
            Periode: <strong>{weekIndex < historyWeeks ? 'Historique' : 'Prevision'}</strong>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, weeks.length - 1)}
            value={Math.max(0, Math.min(weekIndex, weeks.length - 1))}
            className="mosq-slider"
            onChange={(e) => onWeekChange?.(Number(e.target.value))}
          />
        </>
      )}
      {loading && <div className="legend-item">{t.climateLoading}</div>}
    </div>
  )
}

// Click anywhere on map at high zoom = get weather for that exact point
function PixelWeatherClick({ zoom, onPixelWeather }) {
  const map = useMap()
  useEffect(() => {
    if (zoom < 9) return
    const handler = (e) => {
      const { lat, lng } = e.latlng
      // Fetch weather for exact click point
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,precipitation&timezone=Europe/Paris`)
        .then(r => r.json())
        .then(data => {
          if (data.current) {
            const fav = mosquitoFav(data.current.temperature_2m, data.current.relative_humidity_2m, data.current.precipitation)
            onPixelWeather({
              lat: lat.toFixed(3),
              lon: lng.toFixed(3),
              temp: data.current.temperature_2m,
              humidity: data.current.relative_humidity_2m,
              precip: data.current.precipitation,
              fav,
            })
          }
        })
        .catch(() => {})
    }
    map.on('contextmenu', handler) // right-click
    return () => map.off('contextmenu', handler)
  }, [map, zoom, onPixelWeather])
  return null
}

// Pixel weather popup
function PixelWeatherPopup({ data, onClose }) {
  if (!data) return null
  const favColor = data.fav >= 50 ? '#FF4D4D' : data.fav >= 25 ? '#FF8C42' : data.fav >= 10 ? '#FFD93D' : '#6BCB77'
  return (
    <div className="pixel-weather">
      <button className="pixel-close" onClick={onClose}>x</button>
      <div className="pixel-title">Meteo au point</div>
      <div className="pixel-coords">{data.lat}, {data.lon}</div>
      <div className="pixel-grid">
        <div><span className="pixel-val">{data.temp}°C</span><span className="pixel-lbl">Temp.</span></div>
        <div><span className="pixel-val">{data.humidity}%</span><span className="pixel-lbl">Humidite</span></div>
        <div><span className="pixel-val">{data.precip}mm</span><span className="pixel-lbl">Precip.</span></div>
      </div>
      <div className="pixel-fav">
        <span>Activite moustique</span>
        <span className="pixel-fav-val" style={{ color: favColor }}>{data.fav}%</span>
      </div>
    </div>
  )
}

// ─── Qista Bornes on map ───
function QistaBornesLayer({ zoom, bornes, onSelectBorne, forceShow }) {
  if (!bornes || bornes.length === 0) return null
  if (!forceShow && zoom < 6) return null

  return bornes.map(b => {
    if (zoom >= 14) {
      return (
        <React.Fragment key={b.id}>
          <Circle center={[b.lat, b.lon]} radius={60}
            pathOptions={{ color: '#a3e5d3', weight: 1, opacity: 0.4, fillColor: '#a3e5d3', fillOpacity: 0.15 }} />
          <Marker position={[b.lat, b.lon]} icon={borneIcon}
            eventHandlers={{ click: () => onSelectBorne(borneStats(b)) }} />
        </React.Fragment>
      )
    }
    if (zoom >= 10) {
      return <Marker key={b.id} position={[b.lat, b.lon]} icon={borneIcon}
        eventHandlers={{ click: () => onSelectBorne(borneStats(b)) }} />
    }
    return <CircleMarker key={b.id} center={[b.lat, b.lon]} radius={zoom >= 8 ? 5 : 4}
      pathOptions={{ color: '#a3e5d3', fillColor: '#a3e5d3', fillOpacity: 0.9, weight: 2 }}
      eventHandlers={{ click: () => onSelectBorne(borneStats(b)) }} />
  })
}

// Borne detail panel
function BornePanel({ borne, onClose }) {
  if (!borne) return null
  const protectedArea = Math.round(Math.PI * borne.radius * borne.radius)

  return (
    <div className="detail-panel fade-in">
      <button className="close-btn" onClick={onClose}>x</button>

      <div className="borne-image-wrap">
        <img src="/wc-libertin.png" alt="Borne Qista" className="borne-image" />
      </div>

      <div className="borne-header">
        <div className="borne-icon-large"><div className="borne-dot"><div className="borne-ring"></div></div></div>
        <div>
          <div className="detail-nuts-id">{borne.id}</div>
          <h2>{borne.name}</h2>
          <div className="borne-city">{borne.city}</div>
        </div>
      </div>

      <div className="borne-status">
        <span className="borne-status-dot" />
        <span>Active depuis {borne.installed}</span>
      </div>

      <div className="borne-impact-section">
        <div className="section-label">Impact mesure</div>
        <div className="borne-stats">
          <div className="borne-stat">
            <span className="borne-stat-val green">{borne.reduction}%</span>
            <span className="borne-stat-lbl">Reduction moustiques</span>
          </div>
          <div className="borne-stat">
            <span className="borne-stat-val">{borne.captures_month.toLocaleString()}</span>
            <span className="borne-stat-lbl">Captures / mois</span>
          </div>
          <div className="borne-stat">
            <span className="borne-stat-val">{protectedArea.toLocaleString()} m2</span>
            <span className="borne-stat-lbl">Zone protegee</span>
          </div>
        </div>
      </div>

      <div className="borne-before-after">
        <div className="section-label">Avant / Apres installation</div>
        <div className="ba-row">
          <div className="ba-item before">
            <div className="ba-label">AVANT</div>
            <div className="ba-bar-bg"><div className="ba-bar-fill" style={{ width: '100%', background: '#FF4D4D' }} /></div>
            <div className="ba-val">Risque eleve</div>
          </div>
          <div className="ba-item after">
            <div className="ba-label">APRES</div>
            <div className="ba-bar-bg"><div className="ba-bar-fill" style={{ width: `${100 - borne.reduction}%`, background: '#a3e5d3' }} /></div>
            <div className="ba-val" style={{ color: '#a3e5d3' }}>Risque reduit de {borne.reduction}%</div>
          </div>
        </div>
      </div>

      <div className="borne-tech">
        <div className="section-label">Technologie</div>
        <div className="tech-items">
          <div className="tech-item"><span className="tech-icon">CO2</span><span>CO2 recycle (biomimetisme)</span></div>
          <div className="tech-item"><span className="tech-icon">0%</span><span>Zero insecticide</span></div>
          <div className="tech-item"><span className="tech-icon">IOT</span><span>Connectee temps reel</span></div>
          <div className="tech-item"><span className="tech-icon">60m</span><span>Rayon d'action {borne.radius}m</span></div>
        </div>
      </div>

      {borne.city === 'Hyeres' && (
        <div className="borne-context">
          <div className="section-label">Contexte</div>
          <div className="context-text">Hyeres : <strong>400+ bornes</strong> deployees depuis 2019, plus grande installation Qista au monde.</div>
        </div>
      )}

      <div className="demo-badge">Donnees de demonstration</div>
    </div>
  )
}

function MapOverlay({ nutsData, liveMode }) {
  if (!nutsData) return null
  const entries = Object.values(nutsData)
  const hot = entries.filter(e => e.risk_class === 'E').length
  const high = entries.filter(e => e.risk_class === 'D').length

  return (
    <div className="map-overlay">
      <div className="overlay-stat">
        <span className="overlay-num"><AnimNum value={entries.length} /></span>
        <span className="overlay-label">regions</span>
      </div>
      <div className="overlay-divider" />
      <div className="overlay-stat">
        <span className="overlay-num hot"><AnimNum value={hot} /></span>
        <span className="overlay-label">critiques</span>
      </div>
      <div className="overlay-divider" />
      <div className="overlay-stat">
        <span className="overlay-num warn"><AnimNum value={high} /></span>
        <span className="overlay-label">elevees</span>
      </div>
      {liveMode && <>
        <div className="overlay-divider" />
        <div className="overlay-stat">
          <span className="overlay-live-dot" />
          <span className="overlay-label">Meteo live</span>
        </div>
      </>}
    </div>
  )
}

function DetailPanel({ nutsId, nutsData, weather, forecast, onClose }) {
  if (!nutsId || !nutsData) return null
  const data = nutsData[nutsId]
  if (!data) return null
  const w = data.w || 0
  const liveCval = weather ? liveC(weather, data.c) : null
  const liveTotal = liveCval !== null ? (data.s + liveCval + data.d + data.o + w) : null
  const liveCls = liveTotal !== null ? rc(liveTotal) : null

  return (
    <div className="detail-panel fade-in">
      <button className="close-btn" onClick={onClose}>x</button>
      <div className="detail-nuts-id">{nutsId}</div>
      <h2>{data.name}</h2>

      {liveTotal !== null ? (
        <div className="live-score-section">
          <div className="section-label">Risque aujourd'hui</div>
          <div className="gauge-row">
            <CircularGauge value={liveTotal} color={RISK_COLORS[liveCls]} />
            <div className="gauge-side">
              <RiskBadge riskClass={liveCls} />
              <span className="gauge-risk-label">{RISK_LABELS[liveCls]}</span>
            </div>
          </div>
          <div className="scores-detail">
            <ScoreBadge label="S - Especes" value={data.s} max={22} />
            <ScoreBadge label="C - Climat live" value={liveCval} max={22} />
            <ScoreBadge label="D - Maladies" value={data.d} max={22} />
            <ScoreBadge label="O - Observations" value={data.o} max={19} />
            <ScoreBadge label="W - Eau" value={w} max={15} />
          </div>
        </div>
      ) : (
        <div className="loading-score">
          <div className="loader" />
          <span>Chargement meteo...</span>
        </div>
      )}

      {weather && (
        <div className="weather-widget">
          <div className="weather-title">Meteo actuelle</div>
          <div className="weather-grid">
            <div className="weather-item"><span className="weather-val">{weather.temp}°C</span><span className="weather-lbl">Temp.</span></div>
            <div className="weather-item"><span className="weather-val">{weather.humidity}%</span><span className="weather-lbl">Humidite</span></div>
            <div className="weather-item"><span className="weather-val">{weather.precip}mm</span><span className="weather-lbl">Precip.</span></div>
          </div>
          <div className="weather-fav-bar">
            <span>Activite moustique</span>
            <div className="fav-bar-bg">
              <div className="fav-bar-fill" style={{
                width: `${weather.fav}%`,
                background: weather.fav>=50?'#FF4D4D':weather.fav>=25?'#FF8C42':weather.fav>=10?'#FFD93D':'#6BCB77',
                boxShadow: `0 0 8px ${weather.fav>=50?'rgba(255,77,77,0.5)':'rgba(107,203,119,0.3)'}`,
              }} />
            </div>
            <span className="fav-bar-val">{weather.fav}%</span>
          </div>
        </div>
      )}

      <ForecastChart forecast={forecast} />

      <INatObservations lat={data.lat} lon={data.lon} regionName={data.name} />

      <TrendChart country={data.country} />

      <TourismImpact nutsId={nutsId} riskClass={data.risk_class} total={data.total} />

      <div className="structural-section">
        <div className="section-label">Potentiel annuel (ete 2024)</div>
        <div className="structural-score">
          <span className="structural-num">{data.total}</span>
          <span className="structural-label">/100</span>
        </div>
        <div className="scores-detail compact">
          <ScoreBadge label="S - Especes" value={data.s} max={22} />
          <ScoreBadge label="C - Climat ete" value={data.c} max={22} />
          <ScoreBadge label="D - Maladies" value={data.d} max={22} />
          <ScoreBadge label="O - Observations" value={data.o} max={19} />
          <ScoreBadge label="W - Eau" value={w} max={15} />
        </div>
      </div>

      <ExportPDF nutsId={nutsId} data={data} />
    </div>
  )
}

function Legend({ liveMode }) {
  return (
    <div className="legend">
      <div className="legend-title">Risque moustique{liveMode && <span className="live-dot" />}</div>
      {Object.entries(RISK_COLORS).reverse().map(([cls, color]) => (
        <div key={cls} className="legend-item">
          <span className="legend-color" style={{ background: color, boxShadow: `0 0 6px ${RISK_GLOW[cls]}` }} />
          <span>{cls} - {RISK_LABELS[cls]}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main App ───
export default function App() {
  const [geojson, setGeojson] = useState(null)
  const [baseNutsData, setBaseNutsData] = useState(null)
  const [nutsData, setNutsData] = useState(null)
  const [selectedNuts, setSelectedNuts] = useState(null)
  const [weather, setWeather] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [liveMode, setLiveMode] = useState(false)
  const [liveLoading, setLiveLoading] = useState(false)
  const [geoKey, setGeoKey] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [zoom, setZoom] = useState(4)
  const [obsPoints, setObsPoints] = useState(null)
  const [pixelWeather, setPixelWeather] = useState(null)
  const [selectedBorne, setSelectedBorne] = useState(null)
  const [showBornesOnly, setShowBornesOnly] = useState(false)
  const [showMosquitoesOnly, setShowMosquitoesOnly] = useState(false)
  const [showGbifOnly, setShowGbifOnly] = useState(false)
  const [showForecastOnly, setShowForecastOnly] = useState(false)
  const [showClimateOnly, setShowClimateOnly] = useState(false)
  const [lang, setLang] = useState('fr')
  const [bornesData, setBornesData] = useState(null)
  const [gbifPoints, setGbifPoints] = useState(null)
  const [forecastData, setForecastData] = useState(null)
  const [forecastHorizonWeek, setForecastHorizonWeek] = useState(52)
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState(null)
  const [climateData, setClimateData] = useState(null)
  const [climateLoading, setClimateLoading] = useState(false)
  const [climateMetric, setClimateMetric] = useState('temperature_2m')
  const [climateDayIndex, setClimateDayIndex] = useState(0)
  const [climateDates, setClimateDates] = useState([])
  const [climateHistoryWeeks, setClimateHistoryWeeks] = useState(156)
  const [compareMode, setCompareMode] = useState(false)
  const currentYear = new Date().getFullYear()
  const [yearRange, setYearRange] = useState({ start: 2024, end: currentYear })
  const [gbifYearRange, setGbifYearRange] = useState({ start: 2024, end: currentYear })
  const [inatLockWindow, setInatLockWindow] = useState(false)
  const [gbifLockWindow, setGbifLockWindow] = useState(false)
  const [inatShowTrail, setInatShowTrail] = useState(false)
  const [gbifShowTrail, setGbifShowTrail] = useState(false)
  const [inatWeeklyMode, setInatWeeklyMode] = useState(false)
  const [gbifWeeklyMode, setGbifWeeklyMode] = useState(false)
  const [inatWeekRange, setInatWeekRange] = useState({ start: 0, end: 104 })
  const [gbifWeekRange, setGbifWeekRange] = useState({ start: 0, end: 104 })
  const [inatSpeciesFilter, setInatSpeciesFilter] = useState(() => new Set(DEFAULT_SELECTED_SPECIES))
  const [gbifSpeciesFilter, setGbifSpeciesFilter] = useState(() => new Set(DEFAULT_SELECTED_SPECIES))
  const [forecastSpeciesFilter, setForecastSpeciesFilter] = useState(() => new Set(DEFAULT_SELECTED_SPECIES))
  const t = UI_TEXT[lang] || UI_TEXT.fr
  const twoYearsWeeks = 104
  const weekBaseDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - twoYearsWeeks * 7)
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const mosquitoYearBounds = useMemo(() => {
    if (!obsPoints?.length) return { min: 2024, max: currentYear }
    const years = obsPoints
      .map((p) => Number(String(p?.observed_on || '').slice(0, 4)))
      .filter((y) => Number.isFinite(y) && y > 1900 && y <= currentYear)
    if (!years.length) return { min: 2024, max: currentYear }
    return { min: Math.min(...years), max: Math.max(...years) }
  }, [obsPoints, currentYear])

  const gbifYearBounds = useMemo(() => {
    if (!gbifPoints?.length) return { min: 2024, max: currentYear }
    const years = gbifPoints
      .map((p) => Number(String(p?.event_date || p?.observed_on || '').slice(0, 4)))
      .filter((y) => Number.isFinite(y) && y > 1900 && y <= currentYear)
    if (!years.length) return { min: 2024, max: currentYear }
    return { min: Math.min(...years), max: Math.max(...years) }
  }, [gbifPoints, currentYear])

  useEffect(() => {
    const min = mosquitoYearBounds.min
    const max = mosquitoYearBounds.max
    const desiredStart = Math.max(2024, min)
    setYearRange((prev) => {
      const nextStart = Math.min(max, Math.max(min, prev.start || desiredStart))
      const nextEnd = Math.min(max, Math.max(nextStart, prev.end || max))
      if (nextStart === prev.start && nextEnd === prev.end) return prev
      return { start: nextStart, end: nextEnd }
    })
  }, [mosquitoYearBounds.min, mosquitoYearBounds.max])

  useEffect(() => {
    const min = gbifYearBounds.min
    const max = gbifYearBounds.max
    const desiredStart = Math.max(2024, min)
    setGbifYearRange((prev) => {
      const nextStart = Math.min(max, Math.max(min, prev.start || desiredStart))
      const nextEnd = Math.min(max, Math.max(nextStart, prev.end || max))
      if (nextStart === prev.start && nextEnd === prev.end) return prev
      return { start: nextStart, end: nextEnd }
    })
  }, [gbifYearBounds.min, gbifYearBounds.max])

  const visibleMosquitoCount = useMemo(() => {
    if (!obsPoints?.length) return 0
    const inEurope = (lat, lon) => lat >= 34 && lat <= 72 && lon >= -12 && lon <= 42
    const startDate = dateFromWeekIndex(weekBaseDate, inatWeekRange.start)
    const endDate = dateFromWeekIndex(weekBaseDate, inatWeekRange.end + 1)
    return obsPoints.filter((p) => {
      const lat = Number(p?.lat)
      const lon = Number(p?.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inEurope(lat, lon)) return false
      const d = parseObsDate(p, 'inat')
      if (!d) return false
      const y = d.getFullYear()
      if (inatWeeklyMode) {
        if (d < startDate || d >= endDate) return false
      } else if (!(y >= yearRange.start && y <= yearRange.end)) {
        return false
      }
      const key = detectMosquitoSpeciesKey(p)
      return inatSpeciesFilter.has(key)
    }).length
  }, [inatSpeciesFilter, obsPoints, yearRange.end, yearRange.start, inatWeeklyMode, weekBaseDate, inatWeekRange.start, inatWeekRange.end])

  const visibleGbifCount = useMemo(() => {
    if (!gbifPoints?.length) return 0
    const inEurope = (lat, lon) => lat >= 34 && lat <= 72 && lon >= -12 && lon <= 42
    const startDate = dateFromWeekIndex(weekBaseDate, gbifWeekRange.start)
    const endDate = dateFromWeekIndex(weekBaseDate, gbifWeekRange.end + 1)
    return gbifPoints.filter((p) => {
      const lat = Number(p?.lat)
      const lon = Number(p?.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inEurope(lat, lon)) return false
      const d = parseObsDate(p, 'gbif')
      if (!d) return false
      const y = d.getFullYear()
      if (gbifWeeklyMode) {
        if (d < startDate || d >= endDate) return false
      } else if (!(y >= gbifYearRange.start && y <= gbifYearRange.end)) {
        return false
      }
      const key = detectMosquitoSpeciesKey({ species: p?.species, scientific: p?.scientific })
      return gbifSpeciesFilter.has(key)
    }).length
  }, [gbifPoints, gbifSpeciesFilter, gbifYearRange.end, gbifYearRange.start, gbifWeeklyMode, weekBaseDate, gbifWeekRange.start, gbifWeekRange.end])

  const toggleSpeciesInat = useCallback((key) => {
    setInatSpeciesFilter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleSpeciesGbif = useCallback((key) => {
    setGbifSpeciesFilter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleSpeciesForecast = useCallback((key) => {
    setSelectedTrajectoryId(null)
    setForecastSpeciesFilter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const applyRangeChange = useCallback((next, prev, bounds, locked, changedEdge) => {
    const min = bounds.min
    const max = bounds.max
    let start = Math.max(min, Math.min(next.start, max))
    let end = Math.max(start, Math.min(next.end, max))
    if (!locked) return { start, end }

    const span = Math.max(0, prev.end - prev.start)
    if (changedEdge === 'start') {
      start = Math.max(min, Math.min(start, max - span))
      end = start + span
    } else {
      end = Math.min(max, Math.max(end, min + span))
      start = end - span
    }

    if (start < min) {
      start = min
      end = Math.min(max, start + span)
    }
    if (end > max) {
      end = max
      start = Math.max(min, end - span)
    }
    return { start, end }
  }, [])

  const onInatRangeChange = useCallback((next, changedEdge) => {
    setYearRange((prev) => applyRangeChange(next, prev, mosquitoYearBounds, inatLockWindow, changedEdge))
  }, [applyRangeChange, inatLockWindow, mosquitoYearBounds])

  const onGbifRangeChange = useCallback((next, changedEdge) => {
    setGbifYearRange((prev) => applyRangeChange(next, prev, gbifYearBounds, gbifLockWindow, changedEdge))
  }, [applyRangeChange, gbifLockWindow, gbifYearBounds])

  const onInatWeekRangeChange = useCallback((next, changedEdge) => {
    setInatWeekRange((prev) => applyRangeChange(next, prev, { min: 0, max: twoYearsWeeks }, inatLockWindow, changedEdge))
  }, [applyRangeChange, inatLockWindow])

  const onGbifWeekRangeChange = useCallback((next, changedEdge) => {
    setGbifWeekRange((prev) => applyRangeChange(next, prev, { min: 0, max: twoYearsWeeks }, gbifLockWindow, changedEdge))
  }, [applyRangeChange, gbifLockWindow])

  useEffect(() => {
    Promise.all([
      fetch('/data/nuts3_europe_10m.geojson').then(r => r.json()),
      fetch('/data/risk_score_by_nuts3.json').then(r => r.json()),
    ]).then(([geo, nuts]) => {
      setGeojson(geo); setBaseNutsData(nuts); setNutsData(nuts)
      setTimeout(() => setLoaded(true), 100)
    })
    // Lazy load observation points + bornes
    fetch('/data/observation_points.json').then(r => r.json()).then(setObsPoints).catch(() => {})
    fetch('/data/gbif_points.json').then(r => r.json()).then(setGbifPoints).catch(() => {})
    fetch('/data/mosquito_forecast_weekly.json').then(r => r.json()).then(setForecastData).catch(() => {})
    fetch('/data/qista_bornes.json').then(r => r.json()).then(setBornesData).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedNuts || !nutsData) { setWeather(null); setForecast(null); return }
    const region = nutsData[selectedNuts]; if (!region) return
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}&current=temperature_2m,relative_humidity_2m,precipitation&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum&forecast_days=7&timezone=Europe/Paris`)
      .then(r => r.json()).then(data => {
        if (data.current) setWeather({ temp: data.current.temperature_2m, humidity: data.current.relative_humidity_2m, precip: data.current.precipitation, fav: mosquitoFav(data.current.temperature_2m, data.current.relative_humidity_2m, data.current.precipitation) })
        if (data.daily) setForecast(data.daily.time.map((date, i) => ({ date, tempMax: Math.round(data.daily.temperature_2m_max[i]), tempMin: Math.round(data.daily.temperature_2m_min[i]), fav: mosquitoFav(data.daily.temperature_2m_mean[i]||0, data.daily.relative_humidity_2m_mean[i]||0, data.daily.precipitation_sum[i]||0) })))
      }).catch(() => { setWeather(null); setForecast(null) })
  }, [selectedNuts, nutsData])

  useEffect(() => {
    if (!showClimateOnly || climateData) return
    let cancelled = false
    async function loadClimate() {
      setClimateLoading(true)
      try {
        const now = new Date()
        const startDate = new Date(now)
        startDate.setDate(startDate.getDate() - (3 * 365 + 7))
        const endDate = new Date(now)
        endDate.setDate(endDate.getDate() + (2 * 365 + 7))
        const fmt = (d) => d.toISOString().slice(0, 10)
        const startStr = fmt(startDate)
        const endStr = fmt(endDate)
        const toWeeklySeries = (times = [], temps = [], hums = [], precs = []) => {
          const weekly = new Map()
          for (let i = 0; i < times.length; i += 1) {
            const d = new Date(times[i])
            if (Number.isNaN(d.getTime())) continue
            d.setHours(0, 0, 0, 0)
            const day = d.getDay()
            const mondayOffset = day === 0 ? -6 : 1 - day
            d.setDate(d.getDate() + mondayOffset)
            const key = d.toISOString().slice(0, 10)
            if (!weekly.has(key)) weekly.set(key, { t: 0, h: 0, p: 0, n: 0 })
            const row = weekly.get(key)
            row.t += Number(temps[i] ?? 0)
            row.h += Number(hums[i] ?? 0)
            row.p += Number(precs[i] ?? 0)
            row.n += 1
          }
          const keys = Array.from(weekly.keys()).sort()
          return {
            time: keys,
            temperature: keys.map((k) => {
              const r = weekly.get(k)
              return r.n ? Math.round((r.t / r.n) * 10) / 10 : 0
            }),
            humidity: keys.map((k) => {
              const r = weekly.get(k)
              return r.n ? Math.round((r.h / r.n) * 10) / 10 : 0
            }),
            precipitation: keys.map((k) => {
              const r = weekly.get(k)
              return Math.round((r.p || 0) * 10) / 10
            }),
          }
        }
        const normalizeClimateResponse = (raw) => {
          if (Array.isArray(raw)) return raw
          if (Array.isArray(raw?.results)) return raw.results
          if (Array.isArray(raw?.data)) return raw.data
          if (Array.isArray(raw?.daily)) {
            return raw.daily.map((d, i) => ({
              daily: d,
              latitude: Array.isArray(raw?.latitude) ? raw.latitude[i] : WEATHER_GRID[i]?.lat,
              longitude: Array.isArray(raw?.longitude) ? raw.longitude[i] : WEATHER_GRID[i]?.lon,
            }))
          }
          if (raw?.daily && Array.isArray(raw.daily.time)) {
            return [{
              daily: raw.daily,
              latitude: Number(raw?.latitude ?? WEATHER_GRID[0]?.lat),
              longitude: Number(raw?.longitude ?? WEATHER_GRID[0]?.lon),
            }]
          }
          return []
        }
        const buildFallbackClimate = () => {
          const nowWeek = new Date()
          nowWeek.setHours(0, 0, 0, 0)
          const day = nowWeek.getDay()
          const mondayOffset = day === 0 ? -6 : 1 - day
          nowWeek.setDate(nowWeek.getDate() + mondayOffset)
          const nowWeekKey = nowWeek.toISOString().slice(0, 10)

          const weeks = []
          const startMonday = new Date(startDate)
          const startDay = startMonday.getDay()
          startMonday.setDate(startMonday.getDate() + (startDay === 0 ? -6 : 1 - startDay))
          for (let d = new Date(startMonday); d <= endDate; d.setDate(d.getDate() + 7)) {
            weeks.push(d.toISOString().slice(0, 10))
          }

          const out = WEATHER_GRID.map((g, gi) => {
            const temperature = weeks.map((wk, wi) => {
              const k = (wi / 52) * Math.PI * 2
              const latAdj = (46 - g.lat) * 0.16
              const trend = wi * 0.003
              return Math.round((14 + 10 * Math.sin(k - 1.2) + latAdj + trend + Math.sin((gi + 1) * 0.7) * 0.6) * 10) / 10
            })
            const humidity = weeks.map((wk, wi) => {
              const k = (wi / 52) * Math.PI * 2
              return Math.round(Math.max(22, Math.min(96, 66 + 18 * Math.cos(k + 0.4) + Math.sin((gi + 1) * 0.5) * 4)))
            })
            const precipitation = weeks.map((wk, wi) => {
              const k = (wi / 52) * Math.PI * 2
              const base = 5 + 7 * (Math.sin(k + 0.8) + 1) / 2
              const local = Math.max(0, Math.sin((wi + gi) / 4) * 1.8)
              return Math.round((base + local) * 10) / 10
            })
            const weeklyIsForecast = weeks.map((w) => w > nowWeekKey)
            return {
              lat: g.lat,
              lon: g.lon,
              climate_time: nowWeekKey,
              temperature_2m: temperature[0] ?? 0,
              relative_humidity_2m: humidity[0] ?? 0,
              precipitation: precipitation[0] ?? 0,
              weekly_time: weeks,
              weekly_is_forecast: weeklyIsForecast,
              weekly_temperature_2m_max: temperature,
              weekly_relative_humidity_2m_mean: humidity,
              weekly_precipitation_sum: precipitation,
            }
          })
          return out
        }
        const resp = await fetch(
          `https://climate-api.open-meteo.com/v1/climate?latitude=${WEATHER_GRID.map(p => p.lat).join(',')}&longitude=${WEATHER_GRID.map(p => p.lon).join(',')}&start_date=${startStr}&end_date=${endStr}&models=EC_Earth3P_HR&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum&timezone=Europe/Paris`,
        )
        const raw = await resp.json()
        if (cancelled) return
        const normalizedRows = normalizeClimateResponse(raw)
        let parsed = normalizedRows.map((r, i) => {
              const dailyTime = Array.isArray(r?.daily?.time) ? r.daily.time : []
              const dailyTemp = Array.isArray(r?.daily?.temperature_2m_mean) ? r.daily.temperature_2m_mean : []
              const dailyHum = Array.isArray(r?.daily?.relative_humidity_2m_mean) ? r.daily.relative_humidity_2m_mean : []
              const dailyPrec = Array.isArray(r?.daily?.precipitation_sum) ? r.daily.precipitation_sum : []
              const weekly = toWeeklySeries(dailyTime, dailyTemp, dailyHum, dailyPrec)
              const nowWeek = new Date()
              nowWeek.setHours(0, 0, 0, 0)
              const day = nowWeek.getDay()
              const mondayOffset = day === 0 ? -6 : 1 - day
              nowWeek.setDate(nowWeek.getDate() + mondayOffset)
              const nowWeekKey = nowWeek.toISOString().slice(0, 10)
              const weeklyIsForecast = weekly.time.map((t) => t > nowWeekKey)
              return {
                lat: Number(r?.lat ?? r?.latitude ?? WEATHER_GRID[i]?.lat ?? 46),
                lon: Number(r?.lon ?? r?.longitude ?? WEATHER_GRID[i]?.lon ?? 10),
                climate_time: nowWeekKey,
                temperature_2m: weekly.temperature[0] ?? 0,
                relative_humidity_2m: weekly.humidity[0] ?? 0,
                precipitation: weekly.precipitation[0] ?? 0,
                daily_time: dailyTime,
                daily_temperature_2m_mean: dailyTemp,
                daily_relative_humidity_2m_mean: dailyHum,
                daily_precipitation_sum: dailyPrec,
                weekly_time: weekly.time,
                weekly_is_forecast: weeklyIsForecast,
                weekly_temperature_2m_max: weekly.temperature,
                weekly_relative_humidity_2m_mean: weekly.humidity,
                weekly_precipitation_sum: weekly.precipitation,
              }
            })
        if (!parsed.length || !parsed[0]?.weekly_time?.length) {
          parsed = buildFallbackClimate()
        }
        setClimateData(parsed)
        const firstWeeks = parsed?.[0]?.weekly_time || []
        setClimateDates(firstWeeks)
        const histCount = parsed?.[0]?.weekly_is_forecast?.filter((v) => !v).length || 0
        setClimateHistoryWeeks(histCount)
        setClimateDayIndex(Math.max(0, histCount - 1))
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setClimateLoading(false)
      }
    }
    loadClimate()
    return () => { cancelled = true }
  }, [showClimateOnly, climateData])

  useEffect(() => {
    if (!selectedTrajectoryId || !forecastData?.trajectories?.length) return
    const ok = forecastData.trajectories.some((tr) => tr.id === selectedTrajectoryId)
    if (!ok) setSelectedTrajectoryId(null)
  }, [forecastData, selectedTrajectoryId])

  async function toggleLive() {
    if (liveMode) { setLiveMode(false); setNutsData(baseNutsData); setGeoKey(k=>k+1); return }
    setLiveLoading(true)
    try {
      const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_GRID.map(p=>p.lat).join(',')}&longitude=${WEATHER_GRID.map(p=>p.lon).join(',')}&current=temperature_2m,relative_humidity_2m,precipitation&timezone=Europe/Paris`)
      const results = await resp.json()
      const gw = results.map((r,i) => ({ lat:WEATHER_GRID[i].lat, lon:WEATHER_GRID[i].lon, temp:r.current.temperature_2m, humidity:r.current.relative_humidity_2m, precip:r.current.precipitation, fav:mosquitoFav(r.current.temperature_2m,r.current.relative_humidity_2m,r.current.precipitation) }))
      const updated = {}
      for (const [id, reg] of Object.entries(baseNutsData)) {
        const n = nearest(reg.lat, reg.lon, gw), newC = n ? liveC(n, reg.c) : reg.c, newT = reg.s+newC+reg.d+reg.o+(reg.w||0)
        updated[id] = { ...reg, c: newC, total: newT, risk_class: rc(newT), live_temp: n?.temp, live_humidity: n?.humidity, live_fav: n?.fav }
      }
      setNutsData(updated); setLiveMode(true); setGeoKey(k=>k+1)
    } catch(e) { console.error(e) }
    setLiveLoading(false)
  }

  const styleFeature = useCallback((feature) => {
    if (!nutsData) return { fillColor: 'transparent', weight: 0, color: 'transparent', fillOpacity: 0 }
    const id = feature.properties.NUTS_ID, data = nutsData[id], r = data?.risk_class
    if (!r) return { fillColor: 'transparent', weight: 0, color: 'transparent', fillOpacity: 0 }
    const sel = id === selectedNuts
    return {
      fillColor: RISK_COLORS[r], weight: sel ? 2 : 0, color: sel ? '#fff' : 'transparent',
      fillOpacity: sel ? 0.9 : (r==='E'?0.75:r==='D'?0.55:r==='C'?0.38:r==='B'?0.25:0.12),
    }
  }, [nutsData, selectedNuts])

  const onEachFeature = useCallback((feature, layer) => {
    const id = feature.properties.NUTS_ID, name = feature.properties.NUTS_NAME || feature.properties.NAME_LATN
    const data = nutsData?.[id]
    let tip = `<div class="tip-dark"><strong>${name}</strong><br/><span class="tip-id">${id}</span>`
    if (data) tip += `<br/><span class="tip-score">${data.total}/100</span> <span class="tip-class tip-${data.risk_class}">${data.risk_class}</span>`
    tip += '</div>'
    layer.bindTooltip(tip, { sticky: true, className: 'dark-tooltip' })
    layer.on('click', () => { setSelectedNuts(id); setSelectedBorne(null) })
    layer.on('mouseover', (e) => { if (!data?.risk_class) return; e.target.setStyle({ weight: 0, color: 'transparent', fillOpacity: Math.min(0.95, (styleFeature(feature).fillOpacity||0.3)+0.25) }) })
    layer.on('mouseout', (e) => { if (nutsData) e.target.setStyle(styleFeature(feature)) })
  }, [nutsData, styleFeature])

  const anyLayerPanel = showMosquitoesOnly || showGbifOnly || showForecastOnly || showClimateOnly

  return (
    <div className={`app ${loaded ? 'loaded' : ''}`}>
      <div className="stats-bar">
        <div className="stats-left">
          <img src="/logoqista.webp" alt="Qista" className="header-logo" />
          <span className="header-subtitle">Surveillance du risque moustique en Europe</span>
          {liveMode && <span className="live-indicator">LIVE</span>}
        </div>
        <div className="stats-right">
          <SearchBar nutsData={nutsData} onSelect={setSelectedNuts} />
          <button className={`filter-btn ${compareMode?'active':''}`} onClick={() => {
            setCompareMode((v) => {
              const next = !v
              if (next) {
                setShowBornesOnly(false)
                setShowMosquitoesOnly(false)
                setShowGbifOnly(false)
                setShowForecastOnly(false)
                setShowClimateOnly(false)
                setSelectedNuts(null)
                setSelectedBorne(null)
              }
              return next
            })
          }}>
            {t.compare}
          </button>
          <button
            className={`filter-btn ${showBornesOnly?'active':''}`}
            onClick={() => {
              setShowBornesOnly(v => !v)
              setCompareMode(false)
            }}
          >
            {t.bornes}
          </button>
          <button
            className={`filter-btn ${showMosquitoesOnly?'active':''}`}
            onClick={() => {
              setShowMosquitoesOnly(v => !v)
              setCompareMode(false)
            }}
          >
            {t.mosquitoesOnly}
          </button>
          <button
            className={`filter-btn ${showGbifOnly?'active':''}`}
            onClick={() => {
              setShowGbifOnly(v => !v)
              setCompareMode(false)
            }}
          >
            {t.gbifOnly}
          </button>
          <button
            className={`filter-btn ${showForecastOnly?'active':''}`}
            onClick={() => {
              setShowForecastOnly(v => !v)
              setSelectedTrajectoryId(null)
              setCompareMode(false)
            }}
          >
            {t.forecastOnly}
          </button>
          <button
            className={`filter-btn ${showClimateOnly?'active':''}`}
            onClick={() => {
              setShowClimateOnly(v => !v)
              setCompareMode(false)
            }}
          >
            {t.climateOnly}
          </button>
          <button className={`live-btn ${liveMode?'active':''}`} onClick={toggleLive} disabled={liveLoading}>
            {liveLoading ? t.loading : liveMode ? 'LIVE' : t.liveMode}
          </button>
          <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="main-content">
        <div className="map-container">
          <div className="map-gradient" />
          {geojson && nutsData && (
            <MapContainer center={[46,10]} zoom={4} style={{height:'100%',width:'100%'}} zoomControl={true} scrollWheelZoom={true}>
              <DarkBaseLayer />
              <GeoJSON key={`${geoKey}-${selectedNuts}`} data={geojson} style={styleFeature} onEachFeature={onEachFeature} />
              <HotspotPulses nutsData={nutsData} zoom={zoom} />
              {showMosquitoesOnly && (
                <ObservationPoints
                  points={obsPoints}
                  zoom={zoom}
                  yearRange={yearRange}
                  activeSpeciesKeys={inatSpeciesFilter}
                  weeklyMode={inatWeeklyMode}
                  weekRange={inatWeekRange}
                  weekBaseDate={weekBaseDate}
                />
              )}
              {!showBornesOnly && showGbifOnly && (
                <GBIFPoints
                  points={gbifPoints}
                  zoom={zoom}
                  yearRange={gbifYearRange}
                  activeSpeciesKeys={gbifSpeciesFilter}
                  weeklyMode={gbifWeeklyMode}
                  weekRange={gbifWeekRange}
                  weekBaseDate={weekBaseDate}
                />
              )}
              {showClimateOnly && <ClimateRasterLayer data={climateData} metric={climateMetric} weekIndex={climateDayIndex} />}
              {showForecastOnly && (
                <ForecastMapLayer
                  forecastData={forecastData}
                  horizonWeek={forecastHorizonWeek}
                  activeSpeciesKeys={forecastSpeciesFilter}
                  selectedTrajectoryId={selectedTrajectoryId}
                  onSelectTrajectory={setSelectedTrajectoryId}
                />
              )}
              {showForecastOnly && (
                <ForecastTrajectoryLayer
                  forecastData={forecastData}
                  horizonWeek={forecastHorizonWeek}
                  activeSpeciesKeys={forecastSpeciesFilter}
                  selectedTrajectoryId={selectedTrajectoryId}
                  onSelectTrajectory={setSelectedTrajectoryId}
                />
              )}
              {showMosquitoesOnly && inatShowTrail && (
                <TimeTrailLines
                  points={obsPoints}
                  yearRange={yearRange}
                  activeSpeciesKeys={inatSpeciesFilter}
                  mode="inat"
                  weeklyMode={inatWeeklyMode}
                  weekRange={inatWeekRange}
                  weekBaseDate={weekBaseDate}
                />
              )}
              {showGbifOnly && gbifShowTrail && (
                <TimeTrailLines
                  points={gbifPoints}
                  yearRange={gbifYearRange}
                  activeSpeciesKeys={gbifSpeciesFilter}
                  mode="gbif"
                  weeklyMode={gbifWeeklyMode}
                  weekRange={gbifWeekRange}
                  weekBaseDate={weekBaseDate}
                />
              )}
              {showBornesOnly && <QistaBornesLayer zoom={zoom} bornes={bornesData} forceShow={showBornesOnly} onSelectBorne={(b) => { setSelectedBorne(b); setSelectedNuts(null) }} />}
              <CountryLabels zoom={zoom} />
              <FlyToRegion selectedNuts={selectedNuts} nutsData={nutsData} />
              <ZoomTracker onZoomChange={setZoom} />
              <PixelWeatherClick zoom={zoom} onPixelWeather={setPixelWeather} />
            </MapContainer>
          )}
          {!anyLayerPanel && <MapOverlay nutsData={nutsData} liveMode={liveMode} />}
          {!anyLayerPanel && <AlertsPanel onSelectRegion={(id) => { setSelectedNuts(id); setSelectedBorne(null); setCompareMode(false) }} />}
          {!anyLayerPanel && <Legend liveMode={liveMode} />}
          {!anyLayerPanel && <PixelWeatherPopup data={pixelWeather} onClose={() => setPixelWeather(null)} />}
          {!anyLayerPanel && zoom >= 4 && <div className="zoom-hint">{t.zoomHint}</div>}
        </div>

        {anyLayerPanel ? (
          <div className="detail-panel layer-side-panel">
            {showClimateOnly && (
              <div className="layer-block">
                <ClimateLegend
                  t={t}
                  metric={climateMetric}
                  onMetricChange={setClimateMetric}
                  loading={climateLoading}
                  weeks={climateDates}
                  weekIndex={climateDayIndex}
                  onWeekChange={setClimateDayIndex}
                  climateData={climateData}
                  historyWeeks={climateHistoryWeeks}
                />
              </div>
            )}
            {showMosquitoesOnly && (
              <div className="layer-block">
                <MosquitoLegend
                  t={t}
                  title={t.mosqLegendTitle}
                  activeSpeciesKeys={inatSpeciesFilter}
                  onToggle={toggleSpeciesInat}
                />
                <MosquitoTimePanel
                  t={t}
                  minYear={mosquitoYearBounds.min}
                  maxYear={mosquitoYearBounds.max}
                  yearRange={yearRange}
                  onChange={onInatRangeChange}
                  visibleCount={visibleMosquitoCount}
                  lockWindow={inatLockWindow}
                  onToggleLock={() => setInatLockWindow((v) => !v)}
                  showTrail={inatShowTrail}
                  onToggleTrail={() => setInatShowTrail((v) => !v)}
                  weeklyMode={inatWeeklyMode}
                  onToggleWeekly={() => setInatWeeklyMode((v) => !v)}
                  weekRange={inatWeekRange}
                  onWeekChange={onInatWeekRangeChange}
                  weekMax={twoYearsWeeks}
                />
              </div>
            )}
            {showGbifOnly && (
              <div className="layer-block">
                <MosquitoLegend
                  t={t}
                  title={t.gbifLegendTitle}
                  activeSpeciesKeys={gbifSpeciesFilter}
                  onToggle={toggleSpeciesGbif}
                />
                <MosquitoTimePanel
                  t={t}
                  minYear={gbifYearBounds.min}
                  maxYear={gbifYearBounds.max}
                  yearRange={gbifYearRange}
                  onChange={onGbifRangeChange}
                  visibleCount={visibleGbifCount}
                  lockWindow={gbifLockWindow}
                  onToggleLock={() => setGbifLockWindow((v) => !v)}
                  showTrail={gbifShowTrail}
                  onToggleTrail={() => setGbifShowTrail((v) => !v)}
                  weeklyMode={gbifWeeklyMode}
                  onToggleWeekly={() => setGbifWeeklyMode((v) => !v)}
                  weekRange={gbifWeekRange}
                  onWeekChange={onGbifWeekRangeChange}
                  weekMax={twoYearsWeeks}
                />
              </div>
            )}
            {showForecastOnly && (
              <div className="layer-block">
                <MosquitoLegend
                  t={t}
                  title={t.forecastSpeciesTitle}
                  activeSpeciesKeys={forecastSpeciesFilter}
                  onToggle={toggleSpeciesForecast}
                />
                <ForecastTrajectoryLegend
                  t={t}
                  forecastData={forecastData}
                  activeSpeciesKeys={forecastSpeciesFilter}
                  selectedTrajectoryId={selectedTrajectoryId}
                  onSelectTrajectory={setSelectedTrajectoryId}
                  horizonWeek={forecastHorizonWeek}
                />
                <div className="mosq-time-panel">
                  <div className="legend-title">{t.forecastWeek}: +{forecastHorizonWeek}</div>
                  <input
                    type="range"
                    min={1}
                    max={52}
                    value={forecastHorizonWeek}
                    className="mosq-slider"
                    onChange={(e) => setForecastHorizonWeek(Number(e.target.value))}
                  />
                </div>
                <ForecastChartPanel
                  t={t}
                  forecastData={forecastData}
                  horizonWeek={forecastHorizonWeek}
                  activeSpeciesKeys={forecastSpeciesFilter}
                />
                <ForecastMinutePanel
                  t={t}
                  forecastData={forecastData}
                  horizonWeek={forecastHorizonWeek}
                  activeSpeciesKeys={forecastSpeciesFilter}
                  selectedTrajectoryId={selectedTrajectoryId}
                />
              </div>
            )}
          </div>
        ) : !showMosquitoesOnly && !showGbifOnly && (compareMode ? (
          <ComparePanel nutsData={nutsData} onClose={() => setCompareMode(false)} />
        ) : selectedBorne ? (
          <BornePanel borne={selectedBorne} onClose={() => setSelectedBorne(null)} />
        ) : selectedNuts ? (
          <DetailPanel nutsId={selectedNuts} nutsData={nutsData} weather={weather} forecast={forecast} onClose={() => setSelectedNuts(null)} />
        ) : (
          <TopRanking nutsData={nutsData} onSelect={(id) => { setSelectedNuts(id); setSelectedBorne(null) }} />
        ))}
      </div>
    </div>
  )
}

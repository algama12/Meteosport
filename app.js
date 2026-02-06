// === Config ===
const MELILLA_LAT = 35.2923;
const MELILLA_LON = -2.9381;
const APP_VERSION = 'v5';

// === Weather codes to description & emoji ===
const WEATHER_MAP = {
  0:  { desc: 'Despejado', emoji: '☀️' },
  1:  { desc: 'Casi despejado', emoji: '🌤️' },
  2:  { desc: 'Parcialmente nublado', emoji: '⛅' },
  3:  { desc: 'Nublado', emoji: '☁️' },
  45: { desc: 'Niebla', emoji: '🌫️' },
  48: { desc: 'Niebla helada', emoji: '🌫️' },
  51: { desc: 'Llovizna ligera', emoji: '🌦️' },
  53: { desc: 'Llovizna', emoji: '🌦️' },
  55: { desc: 'Llovizna intensa', emoji: '🌧️' },
  61: { desc: 'Lluvia ligera', emoji: '🌧️' },
  63: { desc: 'Lluvia moderada', emoji: '🌧️' },
  65: { desc: 'Lluvia intensa', emoji: '⛈️' },
  71: { desc: 'Nieve ligera', emoji: '🌨️' },
  73: { desc: 'Nieve moderada', emoji: '🌨️' },
  75: { desc: 'Nieve intensa', emoji: '❄️' },
  80: { desc: 'Chubascos ligeros', emoji: '🌦️' },
  81: { desc: 'Chubascos moderados', emoji: '🌧️' },
  82: { desc: 'Chubascos fuertes', emoji: '⛈️' },
  95: { desc: 'Tormenta', emoji: '⛈️' },
  96: { desc: 'Tormenta con granizo', emoji: '⛈️' },
  99: { desc: 'Tormenta fuerte con granizo', emoji: '⛈️' },
};

function getWeatherInfo(code) {
  return WEATHER_MAP[code] || { desc: 'Desconocido', emoji: '🌡️' };
}

// Safe number helper
function num(val, fallback) {
  const n = Number(val);
  return isNaN(n) ? (fallback || 0) : n;
}

// === Date helpers ===
function formatDate(date) {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`;
}

function getShortDay(date) {
  return ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][date.getDay()];
}

// === Sport recommendation engine ===
function analyzeSport(conditions, recentRainDays) {
  const tempMax = num(conditions.tempMax);
  const tempMin = num(conditions.tempMin);
  const windMax = num(conditions.windMax);
  const rainTotal = num(conditions.rainTotal);
  const rainProbability = num(conditions.rainProbability);
  const weatherCode = num(conditions.weatherCode);

  const isRainy = rainTotal > 1 || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode);
  const isDrizzle = (rainTotal > 0 && rainTotal <= 1) || [51, 53, 55].includes(weatherCode);
  const isStormy = [95, 96, 99].includes(weatherCode);
  const isVeryWindy = windMax > 40;
  const isWindy = windMax > 25;
  const isModerateWind = windMax > 15;
  const isCold = tempMin < 5;
  const isHot = tempMax > 35;
  const willRainTonight = rainProbability > 60 || isDrizzle;
  const dryDays = typeof recentRainDays === 'number' ? recentRainDays : 999;
  const trailDry = dryDays >= 2 && !isRainy && !isDrizzle;

  const activities = [];
  let title = '';
  let text = '';

  if (isStormy) {
    title = 'Dia de descanso';
    text = 'Tormenta prevista. Quedate en casa, estira un poco y recupera. Tu cuerpo te lo agradecera.';
    activities.push({ name: 'Descanso', icon: '🧘', level: 'rest' });
    return { title, text, activities };
  }

  if (isRainy && rainTotal > 5) {
    title = 'Mejor descansar hoy';
    text = `Se esperan ${rainTotal.toFixed(1)}mm de lluvia. No merece la pena arriesgarse. Dia perfecto para rodillo o descanso.`;
    activities.push({ name: 'Descanso', icon: '🧘', level: 'rest' });
    return { title, text, activities };
  }

  // Running
  let runLevel = 'perfect';
  if (isRainy && rainTotal > 3) { runLevel = 'good'; }
  else if (isRainy || isDrizzle) { runLevel = 'good'; }
  if (isVeryWindy) { runLevel = 'avoid'; }
  else if (isWindy && runLevel === 'perfect') { runLevel = 'good'; }
  if (isHot && runLevel === 'perfect') { runLevel = 'good'; }
  if (isCold && runLevel === 'perfect') { runLevel = 'good'; }

  // Road cycling
  let roadLevel = 'perfect';
  if (isRainy || isDrizzle) { roadLevel = 'avoid'; }
  if (isVeryWindy) { roadLevel = 'avoid'; }
  else if (isWindy) { roadLevel = roadLevel === 'perfect' ? 'good' : roadLevel; }
  else if (isModerateWind) { roadLevel = roadLevel === 'perfect' ? 'good' : roadLevel; }
  if (willRainTonight && !isRainy && !isDrizzle && roadLevel !== 'avoid') { roadLevel = 'good'; }
  if (isHot && roadLevel === 'perfect') { roadLevel = 'good'; }

  // MTB
  let mtbLevel;
  if (isRainy || isDrizzle) {
    mtbLevel = 'avoid';
  } else if (!trailDry) {
    mtbLevel = 'avoid';
  } else {
    mtbLevel = 'perfect';
  }
  if (mtbLevel === 'perfect' && isVeryWindy) { mtbLevel = 'good'; }
  if (mtbLevel === 'perfect' && isHot) { mtbLevel = 'good'; }

  activities.push({ name: 'Correr', icon: '🏃', level: runLevel });
  activities.push({ name: 'Bici carretera', icon: '🚴', level: roadLevel });
  activities.push({ name: 'MTB', icon: '🚵', level: mtbLevel });

  const allPerfect = runLevel === 'perfect' && roadLevel === 'perfect' && mtbLevel === 'perfect';
  const allAvoid = runLevel === 'avoid' && roadLevel === 'avoid' && mtbLevel === 'avoid';
  const bestSport = [
    { name: 'correr', level: runLevel },
    { name: 'bici de carretera', level: roadLevel },
    { name: 'MTB', level: mtbLevel },
  ].sort((a, b) => {
    const order = { perfect: 0, good: 1, avoid: 2 };
    return (order[a.level] || 2) - (order[b.level] || 2);
  })[0];

  if (allPerfect) {
    title = 'Dia perfecto!';
    text = `${tempMax.toFixed(0)}°C, campo seco, sin lluvia y viento suave. Lo que te pida el cuerpo.`;
  } else if (allAvoid) {
    title = 'Mejor descansar';
    text = 'Las condiciones no acompanan. Aprovecha para descansar y recuperar.';
    activities.length = 0;
    activities.push({ name: 'Descanso', icon: '🧘', level: 'rest' });
  } else if ((isRainy || isDrizzle) && runLevel !== 'avoid') {
    title = 'Dia de lluvia, ponte las zapatillas';
    text = `Se esperan ${rainTotal.toFixed(1)}mm. Olvida la bici, sal a correr que es lo que mejor aguanta con agua.`;
  } else if (isWindy && !isRainy) {
    title = 'Ojo con el viento';
    const windNote = isVeryWindy
      ? `Rachas de ${windMax.toFixed(0)} km/h. Olvidate de la carretera.`
      : `Viento de ${windMax.toFixed(0)} km/h.`;
    text = `${windNote} ${bestSport.level === 'perfect' ? `Buen dia para ${bestSport.name}.` : `Si puedes, mejor ${bestSport.name}.`}`;
  } else if (!trailDry && !isRainy && roadLevel !== 'avoid') {
    title = 'Campo humedo, tira de carretera';
    text = `Ha llovido hace poco y el campo estara embarrado. Buen dia para bici de carretera${runLevel === 'perfect' ? ' o correr' : ''}.`;
  } else if (isHot) {
    title = 'Cuidado con el calor';
    text = `${tempMax.toFixed(0)}°C previstas. Hidratate bien y sal temprano.`;
  } else {
    title = 'Buen dia para entrenar';
    text = `Condiciones aceptables. ${bestSport.level === 'perfect' ? `Dia ideal para ${bestSport.name}.` : `La mejor opcion es ${bestSport.name}.`}`;
  }

  return { title, text, activities };
}

// === Render helpers ===
function renderActivities(container, activities) {
  container.innerHTML = activities.map(a => {
    const levelText = { perfect: 'Ideal', good: 'Puede', avoid: 'Evitar', rest: 'Descanso' };
    return `<span class="activity-badge ${a.level}">${a.icon} ${a.name} · ${levelText[a.level] || '?'}</span>`;
  }).join('');
}

function renderHourly(container, hourlyData) {
  const hours = hourlyData.filter(h => {
    const hour = new Date(h.time).getHours();
    return hour >= 6 && hour <= 22;
  });
  container.innerHTML = hours.map(h => {
    const date = new Date(h.time);
    const info = getWeatherInfo(h.weatherCode);
    return `
      <div class="hour-item">
        <span class="hour-time">${date.getHours()}:00</span>
        <div class="hour-icon">${info.emoji}</div>
        <span class="hour-temp">${num(h.temp).toFixed(0)}°</span>
        <span class="hour-wind">${num(h.wind).toFixed(0)}km/h</span>
      </div>
    `;
  }).join('');
}

function renderWeek(container, dailyData, todayDryDays) {
  container.innerHTML = dailyData.map((d, i) => {
    if (i === 0) return '';
    const date = new Date(d.date);
    const info = getWeatherInfo(d.weatherCode);
    let dryDays = todayDryDays;
    for (let j = 0; j < i; j++) {
      if (num(dailyData[j].rainTotal) > 0.5) { dryDays = 0; } else { dryDays++; }
    }
    const rec = analyzeSport(d, dryDays);
    const best = rec.activities[0] || { icon: '?', name: '?', level: 'avoid' };
    return `
      <div class="week-day">
        <span class="week-day-name">${getShortDay(date)}</span>
        <span class="week-day-icon">${info.emoji}</span>
        <span class="week-day-sport">
          <span class="activity-badge ${best.level}">${best.icon} ${best.name}</span>
        </span>
        <span class="week-day-temps">
          <span class="high">${num(d.tempMax).toFixed(0)}°</span>
          <span class="low"> ${num(d.tempMin).toFixed(0)}°</span>
        </span>
      </div>
    `;
  }).join('');
}

// === API ===
async function fetchWeather() {
  const base = 'https://api.open-meteo.com/v1/forecast';

  // Main forecast
  const url = `${base}?latitude=${MELILLA_LAT}&longitude=${MELILLA_LON}` +
    '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m' +
    '&hourly=temperature_2m,weather_code,wind_speed_10m,precipitation_probability' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,precipitation_probability_max' +
    '&timezone=Europe%2FMadrid&forecast_days=8';

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body.substring(0, 200)}`);
  }
  const data = await res.json();

  // Past rain (separate call, fails silently)
  let pastRain = [];
  try {
    const pastUrl = `${base}?latitude=${MELILLA_LAT}&longitude=${MELILLA_LON}` +
      '&daily=precipitation_sum&timezone=Europe%2FMadrid&forecast_days=1&past_days=5';
    const pastRes = await fetch(pastUrl);
    if (pastRes.ok) {
      const pastData = await pastRes.json();
      pastRain = (pastData.daily.precipitation_sum || []).slice(0, -1);
    }
  } catch (_) { /* ignore */ }

  data._pastRain = pastRain;
  return data;
}

// Consecutive dry days from past rain array
function calcDryDaysBefore(pastRain) {
  if (!pastRain || pastRain.length === 0) return 999;
  let dryDays = 0;
  for (let i = pastRain.length - 1; i >= 0; i--) {
    if (num(pastRain[i]) > 0.5) break;
    dryDays++;
  }
  return dryDays;
}

// === Main ===
async function loadWeather() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const errorEl = document.getElementById('error');

  loading.style.display = 'flex';
  content.style.display = 'none';
  errorEl.style.display = 'none';

  try {
    const data = await fetchWeather();
    const d = data.daily;
    const c = data.current;
    const pastRain = data._pastRain || [];

    document.getElementById('date').textContent = formatDate(new Date());

    // === Today ===
    const todayInfo = getWeatherInfo(c.weather_code);
    document.getElementById('todayIcon').textContent = todayInfo.emoji;
    document.getElementById('tempNow').textContent = `${num(c.temperature_2m).toFixed(0)}°`;
    document.getElementById('todayDesc').textContent = todayInfo.desc;
    document.getElementById('windSpeed').textContent = `${num(c.wind_speed_10m).toFixed(0)} km/h`;
    document.getElementById('humidity').textContent = `${num(c.relative_humidity_2m)}%`;
    document.getElementById('rain').textContent = `${num(d.precipitation_sum[0]).toFixed(1)} mm`;

    // Today recommendation
    const todayDryDays = calcDryDaysBefore(pastRain);
    const todayRec = analyzeSport({
      tempMax: d.temperature_2m_max[0],
      tempMin: d.temperature_2m_min[0],
      windMax: d.wind_gusts_10m_max[0],
      windAvg: d.wind_speed_10m_max[0],
      rainTotal: d.precipitation_sum[0],
      weatherCode: d.weather_code[0],
      rainProbability: d.precipitation_probability_max[0],
    }, todayDryDays);

    document.getElementById('recTitle').textContent = todayRec.title;
    document.getElementById('recText').textContent = todayRec.text;
    renderActivities(document.getElementById('recActivities'), todayRec.activities);

    // === Tomorrow ===
    const tmInfo = getWeatherInfo(d.weather_code[1]);
    document.getElementById('tomorrowSummary').textContent = `${tmInfo.emoji} ${tmInfo.desc}`;
    document.getElementById('tomorrowTemp').textContent =
      `${num(d.temperature_2m_min[1]).toFixed(0)}° / ${num(d.temperature_2m_max[1]).toFixed(0)}°`;
    document.getElementById('tomorrowWind').textContent =
      `${num(d.wind_speed_10m_max[1]).toFixed(0)} km/h (rachas ${num(d.wind_gusts_10m_max[1]).toFixed(0)})`;
    document.getElementById('tomorrowRain').textContent =
      `${num(d.precipitation_sum[1]).toFixed(1)} mm (${num(d.precipitation_probability_max[1])}%)`;
    document.getElementById('tomorrowHumidity').textContent =
      `${num(c.relative_humidity_2m)}%`;

    const tomorrowDryDays = num(d.precipitation_sum[0]) > 0.5 ? 0 : todayDryDays + 1;
    const tomorrowRec = analyzeSport({
      tempMax: d.temperature_2m_max[1],
      tempMin: d.temperature_2m_min[1],
      windMax: d.wind_gusts_10m_max[1],
      windAvg: d.wind_speed_10m_max[1],
      rainTotal: d.precipitation_sum[1],
      weatherCode: d.weather_code[1],
      rainProbability: d.precipitation_probability_max[1],
    }, tomorrowDryDays);

    document.getElementById('tomorrowRecTitle').textContent = tomorrowRec.title;
    document.getElementById('tomorrowRecText').textContent = tomorrowRec.text;
    renderActivities(document.getElementById('tomorrowRecActivities'), tomorrowRec.activities);

    // Border colors
    const lc = { perfect: '#34c759', good: '#ff9500', avoid: '#ff3b30', rest: '#af52de' };
    document.getElementById('recommendation').style.borderLeftColor =
      lc[todayRec.activities[0]?.level] || '#007aff';
    document.getElementById('tomorrowRecommendation').style.borderLeftColor =
      lc[tomorrowRec.activities[0]?.level] || '#007aff';

    // === Hourly (tomorrow) ===
    const tmDate = d.time[1];
    const hourlyData = data.hourly.time
      .map((t, i) => ({
        time: t,
        temp: data.hourly.temperature_2m[i],
        weatherCode: data.hourly.weather_code[i],
        wind: data.hourly.wind_speed_10m[i],
      }))
      .filter(h => h.time.startsWith(tmDate));
    renderHourly(document.getElementById('hourlyScroll'), hourlyData);

    // === Week ===
    const dailyData = d.time.map((date, i) => ({
      date,
      tempMax: d.temperature_2m_max[i],
      tempMin: d.temperature_2m_min[i],
      windMax: d.wind_gusts_10m_max[i],
      rainTotal: d.precipitation_sum[i],
      weatherCode: d.weather_code[i],
      rainProbability: d.precipitation_probability_max[i],
    }));
    renderWeek(document.getElementById('weekList'), dailyData, todayDryDays);

    loading.style.display = 'none';
    content.style.display = 'block';

  } catch (err) {
    console.error('Error:', err);
    loading.style.display = 'none';
    errorEl.style.display = 'flex';
    errorEl.querySelector('p').textContent = `Error (${APP_VERSION}): ${err.message}`;
  }
}

loadWeather();

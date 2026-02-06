// === Config ===
const MELILLA_LAT = 35.2923;
const MELILLA_LON = -2.9381;
const APP_VERSION = 'v7';

// Ventana de entrenamiento (horas del dia)
const TRAIN_HOUR_START = 6; // 06:00
const TRAIN_HOUR_END = 8;   // 08:00

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

// === Extract conditions for morning training window from hourly data ===
// Returns { temp, windGusts, windSpeed, rainProb, precipitation, weatherCode }
// for the TRAIN_HOUR_START - TRAIN_HOUR_END window of a given date string
function getMorningConditions(hourlyData, dateStr) {
  const hours = hourlyData.filter(h => {
    if (!h.time.startsWith(dateStr)) return false;
    const hour = new Date(h.time).getHours();
    return hour >= TRAIN_HOUR_START && hour <= TRAIN_HOUR_END;
  });

  if (hours.length === 0) return null;

  // Worst-case across the window
  const maxGust = Math.max(...hours.map(h => num(h.windGusts)));
  const maxWind = Math.max(...hours.map(h => num(h.windSpeed)));
  const maxRainProb = Math.max(...hours.map(h => num(h.rainProb)));
  const totalPrecip = hours.reduce((sum, h) => sum + num(h.precip), 0);
  const avgTemp = hours.reduce((sum, h) => sum + num(h.temp), 0) / hours.length;
  // Worst weather code (highest = most severe)
  const worstCode = Math.max(...hours.map(h => num(h.weatherCode)));

  return {
    temp: avgTemp,
    windGusts: maxGust,
    windSpeed: maxWind,
    rainProb: maxRainProb,
    precipitation: totalPrecip,
    weatherCode: worstCode,
  };
}

// Convert morning conditions to analyzeSport format
function morningToConditions(morning, dailyData) {
  return {
    tempMax: morning.temp,
    tempMin: morning.temp,
    windMax: morning.windGusts,
    rainTotal: morning.precipitation,
    weatherCode: morning.weatherCode,
    rainProbability: morning.rainProb,
  };
}

// === Sport recommendation engine ===
function analyzeSport(conditions, recentRainDays) {
  const tempMax = num(conditions.tempMax);
  const tempMin = num(conditions.tempMin);
  const windMax = num(conditions.windMax);
  const rainTotal = num(conditions.rainTotal);
  const rainProbability = num(conditions.rainProbability);
  const weatherCode = num(conditions.weatherCode);

  const isRainy = rainTotal > 0.5 || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode);
  const isDrizzle = (rainTotal > 0 && rainTotal <= 0.5) || [51, 53, 55].includes(weatherCode);
  const highRainProb = rainProbability > 50;
  const isStormy = [95, 96, 99].includes(weatherCode);
  // Umbrales para rachas (gusts) - Melilla es ventosa
  const isVeryWindy = windMax > 65;
  const isWindy = windMax > 45;
  const isCold = tempMin < 5;
  const isHot = tempMax > 35;
  const dryDays = typeof recentRainDays === 'number' ? recentRainDays : 999;
  const trailDry = dryDays >= 2 && !isRainy && !isDrizzle;

  const activities = [];
  let title = '';
  let text = '';

  if (isStormy) {
    title = 'Tormenta a las 7h';
    text = 'Tormenta prevista en tu ventana de entreno. Quedate en la cama o tira de rodillo.';
    activities.push({ name: 'Descanso', icon: '🧘', level: 'rest' });
    return { title, text, activities };
  }

  if (isRainy && rainTotal > 5) {
    title = 'Lluvia fuerte a primera hora';
    text = `Se esperan ${rainTotal.toFixed(1)}mm entre las 6 y las 8. Dia de sofa y rodillo.`;
    activities.push({ name: 'Descanso', icon: '🧘', level: 'rest' });
    return { title, text, activities };
  }

  // Running: casi siempre se puede
  let runLevel = 'perfect';
  if (isRainy && rainTotal > 2) { runLevel = 'good'; }
  else if (isRainy || isDrizzle || highRainProb) { runLevel = 'good'; }
  if (isVeryWindy) { runLevel = 'good'; }
  else if (isWindy && runLevel === 'perfect') { runLevel = 'good'; }
  if (isHot && runLevel === 'perfect') { runLevel = 'good'; }
  if (isCold && runLevel === 'perfect') { runLevel = 'good'; }

  // Road cycling: seco y viento controlado
  let roadLevel = 'perfect';
  if (isRainy || isDrizzle) { roadLevel = 'avoid'; }
  else if (highRainProb) { roadLevel = 'good'; }
  if (isVeryWindy) { roadLevel = 'avoid'; }
  else if (isWindy && roadLevel === 'perfect') { roadLevel = 'good'; }
  if (isHot && roadLevel === 'perfect') { roadLevel = 'good'; }

  // MTB: campo seco
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
    title = 'Manana perfecta!';
    text = `${tempMax.toFixed(0)}°C a las 7h, sin lluvia y viento suave. Lo que te pida el cuerpo.`;
  } else if (allAvoid) {
    title = 'Mejor descansar';
    text = 'Mala manana para entrenar fuera. Aprovecha para descansar.';
    activities.length = 0;
    activities.push({ name: 'Descanso', icon: '🧘', level: 'rest' });
  } else if ((isRainy || isDrizzle) && runLevel !== 'avoid') {
    title = 'Lluvia a primera hora';
    text = `Agua entre las 6 y las 8. Olvida la bici, ponte las zapatillas y sal a correr.`;
  } else if (highRainProb && !isRainy && runLevel !== 'avoid') {
    title = 'Puede llover a primera hora';
    text = `${rainProbability.toFixed(0)}% de probabilidad de lluvia. Mejor correr por si acaso, la bici se lleva peor.`;
  } else if (isWindy && !isRainy) {
    title = 'Viento a primera hora';
    const windNote = isVeryWindy
      ? `Rachas de ${windMax.toFixed(0)} km/h a las 7h. Olvidate de la carretera.`
      : `Viento de ${windMax.toFixed(0)} km/h a primera hora.`;
    text = `${windNote} ${bestSport.level === 'perfect' ? `Buen dia para ${bestSport.name}.` : `Si puedes, mejor ${bestSport.name}.`}`;
  } else if (!trailDry && !isRainy && roadLevel !== 'avoid') {
    title = 'Campo humedo, tira de carretera';
    text = `Ha llovido hace poco y el campo estara embarrado. Buen dia para bici de carretera${runLevel === 'perfect' ? ' o correr' : ''}.`;
  } else if (isHot) {
    title = 'Cuidado con el calor';
    text = `${tempMax.toFixed(0)}°C a las 7h. Hidratate bien.`;
  } else {
    title = 'Buena manana para entrenar';
    text = `Condiciones buenas a primera hora. ${bestSport.level === 'perfect' ? `Dia ideal para ${bestSport.name}.` : `La mejor opcion es ${bestSport.name}.`}`;
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
    return hour >= 5 && hour <= 22;
  });
  container.innerHTML = hours.map(h => {
    const date = new Date(h.time);
    const hr = date.getHours();
    const info = getWeatherInfo(h.weatherCode);
    const isTrainWindow = hr >= TRAIN_HOUR_START && hr <= TRAIN_HOUR_END;
    return `
      <div class="hour-item${isTrainWindow ? ' current' : ''}">
        <span class="hour-time">${hr}:00</span>
        <div class="hour-icon">${info.emoji}</div>
        <span class="hour-temp">${num(h.temp).toFixed(0)}°</span>
        <span class="hour-wind">${num(h.windGusts).toFixed(0)}km/h</span>
      </div>
    `;
  }).join('');
}

function renderWeek(container, dailyData, allHourly, todayDryDays) {
  container.innerHTML = dailyData.map((d, i) => {
    if (i === 0) return '';
    const date = new Date(d.date);
    const info = getWeatherInfo(d.weatherCode);
    let dryDays = todayDryDays;
    for (let j = 0; j < i; j++) {
      if (num(dailyData[j].rainTotal) > 0.5) { dryDays = 0; } else { dryDays++; }
    }

    // Use morning window if hourly data available for this day
    const morning = getMorningConditions(allHourly, d.date);
    const conditions = morning ? morningToConditions(morning) : d;
    const rec = analyzeSport(conditions, dryDays);
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

  const url = `${base}?latitude=${MELILLA_LAT}&longitude=${MELILLA_LON}` +
    '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m' +
    '&hourly=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,precipitation_probability,precipitation' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,precipitation_probability_max' +
    '&timezone=Europe%2FMadrid&forecast_days=8';

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body.substring(0, 200)}`);
  }
  const data = await res.json();

  // Past rain (separate, fails silently)
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

function calcDryDaysBefore(pastRain) {
  if (!pastRain || pastRain.length === 0) return 999;
  let dryDays = 0;
  for (let i = pastRain.length - 1; i >= 0; i--) {
    if (num(pastRain[i]) > 0.5) break;
    dryDays++;
  }
  return dryDays;
}

// Parse hourly arrays into objects
function parseHourly(data) {
  return data.hourly.time.map((t, i) => ({
    time: t,
    temp: data.hourly.temperature_2m[i],
    weatherCode: data.hourly.weather_code[i],
    windSpeed: data.hourly.wind_speed_10m[i],
    windGusts: data.hourly.wind_gusts_10m[i],
    rainProb: data.hourly.precipitation_probability[i],
    precip: data.hourly.precipitation[i],
  }));
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
    const allHourly = parseHourly(data);

    document.getElementById('date').textContent = formatDate(new Date());

    // === Today ===
    const todayInfo = getWeatherInfo(c.weather_code);
    document.getElementById('todayIcon').textContent = todayInfo.emoji;
    document.getElementById('tempNow').textContent = `${num(c.temperature_2m).toFixed(0)}°`;
    document.getElementById('todayDesc').textContent = todayInfo.desc;
    document.getElementById('windSpeed').textContent = `${num(c.wind_speed_10m).toFixed(0)} km/h`;
    document.getElementById('humidity').textContent = `${num(c.relative_humidity_2m)}%`;
    document.getElementById('rain').textContent = `${num(d.precipitation_sum[0]).toFixed(1)} mm`;

    // Today recommendation based on morning window
    const todayDryDays = calcDryDaysBefore(pastRain);
    const todayMorning = getMorningConditions(allHourly, d.time[0]);
    const todayConditions = todayMorning
      ? morningToConditions(todayMorning)
      : { tempMax: d.temperature_2m_max[0], tempMin: d.temperature_2m_min[0],
          windMax: d.wind_gusts_10m_max[0], rainTotal: d.precipitation_sum[0],
          weatherCode: d.weather_code[0], rainProbability: d.precipitation_probability_max[0] };

    const todayRec = analyzeSport(todayConditions, todayDryDays);
    document.getElementById('recTitle').textContent = todayRec.title;
    document.getElementById('recText').textContent = todayRec.text;
    renderActivities(document.getElementById('recActivities'), todayRec.activities);

    // === Tomorrow ===
    const tmInfo = getWeatherInfo(d.weather_code[1]);
    const tmMorning = getMorningConditions(allHourly, d.time[1]);

    document.getElementById('tomorrowSummary').textContent = `${tmInfo.emoji} ${tmInfo.desc}`;

    // Show morning-specific data if available
    if (tmMorning) {
      document.getElementById('tomorrowTemp').textContent = `${num(tmMorning.temp).toFixed(0)}° a las 7h`;
      document.getElementById('tomorrowWind').textContent =
        `${num(tmMorning.windSpeed).toFixed(0)} km/h (rachas ${num(tmMorning.windGusts).toFixed(0)})`;
      document.getElementById('tomorrowRain').textContent =
        `${num(tmMorning.precipitation).toFixed(1)} mm (${num(tmMorning.rainProb)}%)`;
    } else {
      document.getElementById('tomorrowTemp').textContent =
        `${num(d.temperature_2m_min[1]).toFixed(0)}° / ${num(d.temperature_2m_max[1]).toFixed(0)}°`;
      document.getElementById('tomorrowWind').textContent =
        `${num(d.wind_speed_10m_max[1]).toFixed(0)} km/h (rachas ${num(d.wind_gusts_10m_max[1]).toFixed(0)})`;
      document.getElementById('tomorrowRain').textContent =
        `${num(d.precipitation_sum[1]).toFixed(1)} mm (${num(d.precipitation_probability_max[1])}%)`;
    }
    document.getElementById('tomorrowHumidity').textContent = `${num(c.relative_humidity_2m)}%`;

    const tomorrowDryDays = num(d.precipitation_sum[0]) > 0.5 ? 0 : todayDryDays + 1;
    const tomorrowConditions = tmMorning
      ? morningToConditions(tmMorning)
      : { tempMax: d.temperature_2m_max[1], tempMin: d.temperature_2m_min[1],
          windMax: d.wind_gusts_10m_max[1], rainTotal: d.precipitation_sum[1],
          weatherCode: d.weather_code[1], rainProbability: d.precipitation_probability_max[1] };

    const tomorrowRec = analyzeSport(tomorrowConditions, tomorrowDryDays);
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
    const tmHourly = allHourly.filter(h => h.time.startsWith(tmDate));
    renderHourly(document.getElementById('hourlyScroll'), tmHourly);

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
    renderWeek(document.getElementById('weekList'), dailyData, allHourly, todayDryDays);

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

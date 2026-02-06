// === Config ===
const MELILLA_LAT = 35.2923;
const MELILLA_LON = -2.9381;

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
function analyzeSport(conditions) {
  // conditions: { tempMax, tempMin, windMax, windAvg, rainTotal, humidity, weatherCode, rainProbability }
  const { tempMax, tempMin, windMax, windAvg, rainTotal, humidity, weatherCode, rainProbability } = conditions;

  const isRainy = rainTotal > 1 || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode);
  const isDrizzle = rainTotal > 0 && rainTotal <= 1 || [51, 53, 55].includes(weatherCode);
  const isStormy = [95, 96, 99].includes(weatherCode);
  const isVeryWindy = windMax > 40;
  const isWindy = windMax > 25;
  const isModerateWind = windMax > 15;
  const isCold = tempMin < 5;
  const isHot = tempMax > 35;
  const isNice = tempMax >= 15 && tempMax <= 30 && !isRainy && !isVeryWindy;
  const willRainTonight = rainProbability > 60 || isDrizzle;

  const activities = [];
  let title = '';
  let text = '';

  // Storm = rest
  if (isStormy) {
    title = 'Dia de descanso';
    text = 'Tormenta prevista. Quedate en casa, estira un poco y recupera. Tu cuerpo te lo agradecera.';
    activities.push({ name: 'Descanso', icon: '🧘', level: 'rest' });
    return { title, text, activities };
  }

  // Heavy rain = rest or indoor
  if (isRainy && rainTotal > 5) {
    title = 'Mejor descansar hoy';
    text = `Se esperan ${rainTotal.toFixed(1)}mm de lluvia. No merece la pena arriesgarse. Dia perfecto para rodillo o descanso.`;
    activities.push({ name: 'Descanso', icon: '🧘', level: 'rest' });
    return { title, text, activities };
  }

  // Evaluate each sport
  // Running
  let runLevel = 'perfect';
  let runReasons = [];
  if (isRainy) { runLevel = 'avoid'; runReasons.push('lluvia'); }
  else if (isDrizzle) { runLevel = 'good'; runReasons.push('posible llovizna'); }
  if (isVeryWindy) { runLevel = 'avoid'; runReasons.push('mucho viento'); }
  else if (isWindy) { runLevel = runLevel === 'perfect' ? 'good' : runLevel; runReasons.push('viento'); }
  if (isHot) { runLevel = runLevel === 'perfect' ? 'good' : runLevel; runReasons.push('calor'); }
  if (isCold) { runLevel = runLevel === 'perfect' ? 'good' : runLevel; runReasons.push('frio'); }

  // Road cycling
  let roadLevel = 'perfect';
  let roadReasons = [];
  if (isRainy || isDrizzle) { roadLevel = 'avoid'; roadReasons.push('asfalto mojado'); }
  if (isVeryWindy) { roadLevel = 'avoid'; roadReasons.push('viento peligroso'); }
  else if (isWindy) { roadLevel = 'good'; roadReasons.push('viento'); }
  else if (isModerateWind) { roadLevel = roadLevel === 'perfect' ? 'good' : roadLevel; }
  if (willRainTonight && !isRainy && !isDrizzle) { roadLevel = roadLevel === 'avoid' ? 'avoid' : 'good'; roadReasons.push('puede llover'); }
  if (isHot) { roadLevel = roadLevel === 'perfect' ? 'good' : roadLevel; roadReasons.push('calor'); }

  // MTB
  let mtbLevel = 'perfect';
  let mtbReasons = [];
  if (isRainy && rainTotal > 3) { mtbLevel = 'avoid'; mtbReasons.push('barro'); }
  else if (isRainy || isDrizzle) { mtbLevel = 'good'; mtbReasons.push('terreno humedo'); }
  if (isVeryWindy) { mtbLevel = 'good'; mtbReasons.push('viento'); }
  if (willRainTonight && !isRainy) { mtbLevel = mtbLevel === 'avoid' ? 'avoid' : 'good'; mtbReasons.push('terreno puede estar humedo'); }
  if (isHot) { mtbLevel = mtbLevel === 'perfect' ? 'good' : mtbLevel; mtbReasons.push('calor'); }

  activities.push({ name: 'Correr', icon: '🏃', level: runLevel, reasons: runReasons });
  activities.push({ name: 'Bici carretera', icon: '🚴', level: roadLevel, reasons: roadReasons });
  activities.push({ name: 'MTB', icon: '🚵', level: mtbLevel, reasons: mtbReasons });

  // Generate title and text
  const allPerfect = runLevel === 'perfect' && roadLevel === 'perfect' && mtbLevel === 'perfect';
  const allAvoid = runLevel === 'avoid' && roadLevel === 'avoid' && mtbLevel === 'avoid';
  const bestSport = [
    { name: 'correr', level: runLevel },
    { name: 'bici de carretera', level: roadLevel },
    { name: 'MTB', level: mtbLevel },
  ].sort((a, b) => {
    const order = { perfect: 0, good: 1, avoid: 2 };
    return order[a.level] - order[b.level];
  })[0];

  if (allPerfect) {
    title = 'Dia perfecto!';
    text = `${tempMax.toFixed(0)}°C, sin lluvia y viento suave. Elige lo que te apetezca, cualquier deporte sera un placer.`;
  } else if (allAvoid) {
    title = 'Mejor descansar';
    text = 'Las condiciones no acompanan para ninguna actividad al aire libre. Aprovecha para recuperar.';
    activities.length = 0;
    activities.push({ name: 'Descanso', icon: '🧘', level: 'rest' });
  } else if (isWindy && !isRainy) {
    title = 'Ojo con el viento';
    const windNote = isVeryWindy
      ? `Rachas de ${windMax.toFixed(0)} km/h. Olvidate de la bici de carretera.`
      : `Viento de ${windMax.toFixed(0)} km/h.`;
    text = `${windNote} ${bestSport.level === 'perfect' ? `Buen dia para ${bestSport.name}.` : `Si puedes, mejor ${bestSport.name}.`}`;
  } else if (isRainy && !isVeryWindy) {
    title = 'Dia de lluvia';
    text = `Se esperan ${rainTotal.toFixed(1)}mm. ${mtbLevel !== 'avoid' ? 'Si no te importa el barro, la MTB aguanta bien.' : 'Mejor quedarse en casa hoy.'}`;
  } else if (isDrizzle) {
    title = 'Posible llovizna';
    text = `Algo de agua pero nada grave. ${bestSport.level !== 'avoid' ? `Buen dia para ${bestSport.name}.` : 'Ve preparado por si acaso.'}`;
  } else if (isHot) {
    title = 'Cuidado con el calor';
    text = `${tempMax.toFixed(0)}°C previstas. Hidratate bien y sal temprano. ${bestSport.name === 'correr' ? 'Si corres, mejor a primera hora.' : ''}`;
  } else {
    title = 'Buen dia para entrenar';
    text = `Condiciones aceptables. ${bestSport.level === 'perfect' ? `Dia ideal para ${bestSport.name}.` : `La mejor opcion es ${bestSport.name}.`}`;
  }

  return { title, text, activities };
}

// === Render helpers ===
function renderActivities(container, activities) {
  container.innerHTML = activities.map(a => {
    const levelText = {
      perfect: 'Ideal',
      good: 'Puede',
      avoid: 'Evitar',
      rest: 'Descanso',
    };
    return `<span class="activity-badge ${a.level}">${a.icon} ${a.name} · ${levelText[a.level]}</span>`;
  }).join('');
}

function renderHourly(container, hourlyData) {
  // Show hours from 6:00 to 22:00 for tomorrow
  const hours = hourlyData.filter(h => {
    const hour = new Date(h.time).getHours();
    return hour >= 6 && hour <= 22;
  });

  container.innerHTML = hours.map(h => {
    const date = new Date(h.time);
    const hourStr = `${date.getHours()}:00`;
    const info = getWeatherInfo(h.weatherCode);
    return `
      <div class="hour-item">
        <span class="hour-time">${hourStr}</span>
        <div class="hour-icon">${info.emoji}</div>
        <span class="hour-temp">${h.temp.toFixed(0)}°</span>
        <span class="hour-wind">${h.wind.toFixed(0)}km/h</span>
      </div>
    `;
  }).join('');
}

function renderWeek(container, dailyData) {
  container.innerHTML = dailyData.map((d, i) => {
    if (i === 0) return ''; // skip today
    const date = new Date(d.date);
    const info = getWeatherInfo(d.weatherCode);
    const rec = analyzeSport(d);
    const bestActivity = rec.activities[0];

    return `
      <div class="week-day">
        <span class="week-day-name">${getShortDay(date)}</span>
        <span class="week-day-icon">${info.emoji}</span>
        <span class="week-day-sport">
          <span class="activity-badge ${bestActivity.level}">${bestActivity.icon} ${bestActivity.name}</span>
        </span>
        <span class="week-day-temps">
          <span class="high">${d.tempMax.toFixed(0)}°</span>
          <span class="low"> ${d.tempMin.toFixed(0)}°</span>
        </span>
      </div>
    `;
  }).join('');
}

// === API ===
async function fetchWeather() {
  const params = new URLSearchParams({
    latitude: MELILLA_LAT,
    longitude: MELILLA_LON,
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m',
    hourly: 'temperature_2m,weather_code,wind_speed_10m,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,precipitation_probability_max,relative_humidity_2m_max',
    timezone: 'Europe/Madrid',
    forecast_days: 8,
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// === Main ===
async function loadWeather() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const error = document.getElementById('error');

  loading.style.display = 'flex';
  content.style.display = 'none';
  error.style.display = 'none';

  try {
    const data = await fetchWeather();

    // Set date
    document.getElementById('date').textContent = formatDate(new Date());

    // === Today ===
    const current = data.current;
    const todayInfo = getWeatherInfo(current.weather_code);

    document.getElementById('todayIcon').textContent = todayInfo.emoji;
    document.getElementById('tempNow').textContent = `${current.temperature_2m.toFixed(0)}°`;
    document.getElementById('todayDesc').textContent = todayInfo.desc;
    document.getElementById('windSpeed').textContent = `${current.wind_speed_10m.toFixed(0)} km/h`;
    document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;

    // Today rain from daily
    const todayRain = data.daily.precipitation_sum[0];
    document.getElementById('rain').textContent = `${todayRain.toFixed(1)} mm`;

    // Today recommendation
    const todayConditions = {
      tempMax: data.daily.temperature_2m_max[0],
      tempMin: data.daily.temperature_2m_min[0],
      windMax: data.daily.wind_gusts_10m_max[0],
      windAvg: data.daily.wind_speed_10m_max[0],
      rainTotal: data.daily.precipitation_sum[0],
      humidity: data.daily.relative_humidity_2m_max[0],
      weatherCode: data.daily.weather_code[0],
      rainProbability: data.daily.precipitation_probability_max[0],
    };

    const todayRec = analyzeSport(todayConditions);
    document.getElementById('recTitle').textContent = todayRec.title;
    document.getElementById('recText').textContent = todayRec.text;
    renderActivities(document.getElementById('recActivities'), todayRec.activities);

    // === Tomorrow ===
    const tomorrowIdx = 1;
    const tomorrowInfo = getWeatherInfo(data.daily.weather_code[tomorrowIdx]);

    document.getElementById('tomorrowSummary').textContent =
      `${tomorrowInfo.emoji} ${tomorrowInfo.desc}`;
    document.getElementById('tomorrowTemp').textContent =
      `${data.daily.temperature_2m_min[tomorrowIdx].toFixed(0)}° / ${data.daily.temperature_2m_max[tomorrowIdx].toFixed(0)}°`;
    document.getElementById('tomorrowWind').textContent =
      `${data.daily.wind_speed_10m_max[tomorrowIdx].toFixed(0)} km/h (rachas ${data.daily.wind_gusts_10m_max[tomorrowIdx].toFixed(0)})`;
    document.getElementById('tomorrowRain').textContent =
      `${data.daily.precipitation_sum[tomorrowIdx].toFixed(1)} mm (${data.daily.precipitation_probability_max[tomorrowIdx]}%)`;
    document.getElementById('tomorrowHumidity').textContent =
      `${data.daily.relative_humidity_2m_max[tomorrowIdx]}%`;

    // Tomorrow recommendation
    const tomorrowConditions = {
      tempMax: data.daily.temperature_2m_max[tomorrowIdx],
      tempMin: data.daily.temperature_2m_min[tomorrowIdx],
      windMax: data.daily.wind_gusts_10m_max[tomorrowIdx],
      windAvg: data.daily.wind_speed_10m_max[tomorrowIdx],
      rainTotal: data.daily.precipitation_sum[tomorrowIdx],
      humidity: data.daily.relative_humidity_2m_max[tomorrowIdx],
      weatherCode: data.daily.weather_code[tomorrowIdx],
      rainProbability: data.daily.precipitation_probability_max[tomorrowIdx],
    };

    const tomorrowRec = analyzeSport(tomorrowConditions);
    document.getElementById('tomorrowRecTitle').textContent = tomorrowRec.title;
    document.getElementById('tomorrowRecText').textContent = tomorrowRec.text;
    renderActivities(document.getElementById('tomorrowRecActivities'), tomorrowRec.activities);

    // Set border color based on best recommendation
    const tomorrowCard = document.getElementById('tomorrowRecommendation');
    const bestLevel = tomorrowRec.activities[0]?.level;
    const levelColors = { perfect: '#34c759', good: '#ff9500', avoid: '#ff3b30', rest: '#af52de' };
    tomorrowCard.style.borderLeftColor = levelColors[bestLevel] || '#007aff';

    const todayCard = document.getElementById('recommendation');
    const todayBestLevel = todayRec.activities[0]?.level;
    todayCard.style.borderLeftColor = levelColors[todayBestLevel] || '#007aff';

    // === Hourly (tomorrow) ===
    const tomorrowDate = data.daily.time[tomorrowIdx];
    const hourlyData = data.hourly.time
      .map((t, i) => ({
        time: t,
        temp: data.hourly.temperature_2m[i],
        weatherCode: data.hourly.weather_code[i],
        wind: data.hourly.wind_speed_10m[i],
        rainProb: data.hourly.precipitation_probability[i],
      }))
      .filter(h => h.time.startsWith(tomorrowDate));

    renderHourly(document.getElementById('hourlyScroll'), hourlyData);

    // === Week ===
    const dailyData = data.daily.time.map((date, i) => ({
      date,
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      windMax: data.daily.wind_gusts_10m_max[i],
      windAvg: data.daily.wind_speed_10m_max[i],
      rainTotal: data.daily.precipitation_sum[i],
      humidity: data.daily.relative_humidity_2m_max[i],
      weatherCode: data.daily.weather_code[i],
      rainProbability: data.daily.precipitation_probability_max[i],
    }));

    renderWeek(document.getElementById('weekList'), dailyData);

    // Show content
    loading.style.display = 'none';
    content.style.display = 'block';

  } catch (err) {
    console.error('Error loading weather:', err);
    loading.style.display = 'none';
    error.style.display = 'flex';
  }
}

// Init
loadWeather();

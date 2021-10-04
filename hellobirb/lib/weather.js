// Functionality to get weather forecasts from weather.gov.
import { isAfter, isBefore, isEqual, parseISO } from 'date-fns';
import axios from 'axios';

// Leave day names alone, but change "Tonight" or "This Afternoon" to
// lowercase so it doesn't look silly.
function cleanName(name) {
  if (/^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/.test(name)) {
    return name;
  }
  return name.toLowerCase();
}

// Decorate the weather forecast with emoji matching the descriptive words.
function decorateForecast(forecast) {
  let decorated = forecast;
  // These are declared in an array because we want a predictable order
  // for iteration, going from more specific phrases to more general ones.
  const conditions = [
    {
      phrase: 'part(ly|ially) sunny',
      emoji: ':white_sun_small_cloud:',
    },
    { phrase: 'part(ly|ially) cloudy', emoji: ':white_sun_cloud:' },
    { phrase: 'cloud[sy]', emoji: ':cloud:' },
    { phrase: 'sun(ny)?', emoji: ':sun_with_face:' },
    { phrase: 'rainy?', emoji: ':cloud_with_rain:' },
    { phrase: 'snowy?', emoji: ':snowflake:' },
  ];
  conditions.forEach((condition) => {
    const re = new RegExp(`(${condition.phrase})(?! :)`, 'gi');
    decorated = decorated.replaceAll(re, `$1 ${condition.emoji}`);
  });

  return decorated;
}

// Weather.gov forecast returns an array of forecasts for different periods
// (seemingly in order, though the documentation doesn't guarantee this, so
// maybe worth making sure). In experimenting with the API it appears that
// a period that has already passed may be included, so we can't just return
// the first period and assume it's for "now."
function findFirstApplicableWeather(response) {
  const { properties } = response;
  const { periods } = properties;
  if (!periods) {
    throw new Error('no weather data found in weather.gov response');
  }
  const now = new Date();
  for (let i = 0; i < periods.length; i += 1) {
    const period = periods[i];
    const startTime = parseISO(period.startTime);
    const endTime = parseISO(period.endTime);
    if (
      (isAfter(now, startTime) || isEqual(startTime, now)) &&
      isBefore(now, endTime)
    ) {
      return {
        for: cleanName(period.name),
        forecast: period.detailedForecast,
      };
    }
  }
  throw new Error(
    'no current weather period found in weather response',
  );
}

async function getWeatherForecast(officeAndGrid) {
  if (!officeAndGrid) {
    throw new Error('weather parameter must not be blank');
  }
  const url = `https://api.weather.gov/gridpoints/${officeAndGrid}/forecast`;
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'hellobirb-discord-bot' },
    });
    const currentWeather = findFirstApplicableWeather(response.data);
    currentWeather.forecast = decorateForecast(
      currentWeather.forecast,
    );
    return currentWeather;
  } catch (err) {
    throw new Error(`getting weather forecast: ${err}`);
  }
}

export default getWeatherForecast;

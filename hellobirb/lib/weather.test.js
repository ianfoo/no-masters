import { internalFunctions } from './weather';

const { decorateForecast, cleanName } = internalFunctions;

const decorateForecastTests = [
  {
    name: 'places emoji after weather conditions',
    input: [
      {
        input: 'Sunny conditions',
        want: 'Sunny :sun_with_face: conditions',
      },
      { input: 'rain', want: 'rain :cloud_with_rain:' },
      { input: 'rainy', want: 'rainy :cloud_with_rain:' },
      { input: 'rainfall', want: 'rainfall :cloud_with_rain:' },
      { input: 'showers', want: 'showers :cloud_with_rain:' },
      { input: 'clouds', want: 'clouds :cloud:' },
      { input: 'cloudy', want: 'cloudy :cloud:' },
      {
        input: 'Partly sunny',
        want: 'Partly sunny :white_sun_cloud:',
      },
      {
        input: 'partially sunny',
        want: 'partially sunny :white_sun_cloud:',
      },
      {
        input: 'partly cloudy',
        want: 'partly cloudy :white_sun_small_cloud:',
      },
      {
        input: 'partially cloudy',
        want: 'partially cloudy :white_sun_small_cloud:',
      },
      { input: 'ice', want: 'ice :ice_cube:' },
      { input: 'icy', want: 'icy :ice_cube:' },
      { input: 'snow', want: 'snow :snowflake:' },
      { input: 'snowfall', want: 'snowfall :snowflake:' },
      { input: 'flurries', want: 'flurries :snowflake:' },
      { input: 'snow flurries', want: 'snow :snowflake: flurries' },
      {
        input: 'thunderstorm',
        want: 'thunderstorm :cloud_lightning:',
      },
      {
        input: 'thunderstorms',
        want: 'thunderstorms :cloud_lightning:',
      },
      { input: 'lightning', want: 'lightning :cloud_lightning:' },
    ],
  },
  {
    name: 'does not break up words',
    input: [
      {
        input: 'expected rainfall is 1 inch',
        want: 'expected rainfall :cloud_with_rain: is 1 inch',
      },
      {
        input: 'partly sunny',
        want: 'partly sunny :white_sun_cloud:',
      },
    ],
  },
  {
    name: 'does not affect already-decorated phrases',
    input: 'Cloudy :cloud: conditions',
    want: 'Cloudy :cloud: conditions',
  },
  {
    name: 'does not try to decorate emoji names',
    input: ':sunny:',
    want: ':sunny:',
  },
  {
    name: 'only replaces first instance',
    input: 'Sunny, then cloudy, then sunny again, then cloudy again',
    want: 'Sunny :sun_with_face:, then cloudy :cloud:, then sunny again, then cloudy again',
  },
];
decorateForecastTests.forEach(({ name, input, want }) => {
  test(name, () => {
    if (Array.isArray(input)) {
      input.forEach((current) => {
        expect(decorateForecast(current.input)).toBe(current.want);
      });
    } else {
      expect(decorateForecast(input)).toBe(want);
    }
  });
});

const cleanNameTests = [
  { input: 'Monday', want: 'Monday' },
  { input: 'Tuesday', want: 'Tuesday' },
  { input: 'Wednesday', want: 'Wednesday' },
  { input: 'Thursday', want: 'Thursday' },
  { input: 'Friday', want: 'Friday' },
  { input: 'Saturday', want: 'Saturday' },
  { input: 'Sunday', want: 'Sunday' },
  { input: 'Tonight', want: 'tonight' },
  { input: 'Tomorrow', want: 'tomorrow' },
  { input: 'This Afternoon', want: 'this afternoon' },
];
test('capitalizes time periods correctly', () => {
  cleanNameTests.forEach((current) => {
    expect(cleanName(current.input)).toBe(current.want);
  });
});

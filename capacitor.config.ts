import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.youthcoachhub.app',
  appName: 'Youth Coach Hub',
  webDir: 'public', // Placeholder — hosted URL mode means this is rarely used
  server: {
    url: 'https://youthcoachhub.com',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    // TODO: Configure deep link auth callback (Universal Links / Associated Domains)
    // before App Store submission. Required for Supabase auth redirect to work
    // natively instead of opening Safari.
  },
  android: {
    // TODO: Configure deep link auth callback (App Links / intent-filter)
    // before Play Store submission.
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      backgroundColor: '#0d1117',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0d1117',
    },
  },
};

export default config;

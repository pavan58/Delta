/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#06101f', 900: '#0b1b33', 800: '#12284a', 700: '#1b3a66', 600: '#2a4f85' },
        brand: { 50: '#ecfdf3', 100: '#d1fadf', 400: '#34d399', 500: '#16a34a', 600: '#15803d', 700: '#166534' },
      },
    },
  },
  plugins: [],
};

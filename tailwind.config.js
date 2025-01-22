/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-custom-blue': 'linear-gradient(45deg, #0EA5E9, #38BDF8)',
      },
      colors: {
        'logo-custom': '#0EA5E9',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/react-app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sq: {
          green: "#007A3D",
          red: "#CE1126",
          black: "#0B0F19",
          whatsapp: "#25D366",
          "whatsapp-hover": "#20BA5A",
        },
      },
    },
  },
  plugins: [],
};

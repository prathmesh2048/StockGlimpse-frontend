/** @type {import('tailwindcss').Config} */
export const content = ["./src/**/*.{js,jsx}", "./public/index.html"];
export const theme = {
  extend: {
    keyframes: {
      "bounce-x": {
        "0%, 100%": {
          transform: "translateX(0)",
          "animation-timing-function": "cubic-bezier(0.4, 0, 0.6, 1)",
        },
        "50%": {
          transform: "translateX(12%)",
          "animation-timing-function": "cubic-bezier(0.4, 0, 0.2, 1)",
        },
      },
    },
    animation: {
      "bounce-x": "bounce-x 1s infinite",
    },
  },
};
export const plugins = [];

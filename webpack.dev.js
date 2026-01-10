const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "development",

  entry: "./src/main.tsx",
  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "bundle.js",
  },

  devtool: "eval-source-map",

  resolve: {
    extensions: [".tsx", ".ts", ".js", ".cjs", ".json"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: "./index.html",
    }),
  ],

  devServer: {
    hot: true,
  },
};

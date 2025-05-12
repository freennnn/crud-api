import path from "path";
import { fileURLToPath } from "url";
import webpack from "webpack";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: {
    server: "./src/server.ts",
    cluster: "./src/cluster.ts",
    "db-server": "./src/db-server.ts",
  },
  target: "node",
  mode: "production",
  experiments: {
    outputModule: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.PORT": JSON.stringify("4000"),
    }),
  ],
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    module: true,
    chunkFormat: "module",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
};

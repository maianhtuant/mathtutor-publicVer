const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const backend = process.env.API_PROXY_TARGET || 'http://localhost:8080';

module.exports = (env, argv) => ({
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: argv.mode === 'production' ? 'assets/[name].[contenthash].js' : 'assets/[name].js',
    publicPath: '/',
    clean: true,
  },
  devtool: argv.mode === 'production' ? false : 'eval-cheap-module-source-map',
  resolve: {
    // React Native components render through react-native-web in the browser.
    alias: { 'react-native$': 'react-native-web' },
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.web.js', '.js'],
  },
  module: {
    rules: [
      { test: /\.[jt]sx?$/, exclude: /node_modules\/(?!react-native-web)/, use: 'babel-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.(woff2?|ttf|eot)$/, type: 'asset/resource', generator: { filename: 'fonts/[name][ext]' } },
      // Images get a content hash, so nginx can cache /assets/ for a year.
      { test: /\.(png|jpe?g|svg)$/, type: 'asset/resource', generator: { filename: 'assets/[name].[contenthash][ext]' } },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: './public/index.html', favicon: './public/favicon.png' })],
  devServer: {
    port: 3000,
    historyApiFallback: true,
    proxy: [{ context: ['/api'], target: backend, changeOrigin: true }],
  },
  performance: { hints: false },
});

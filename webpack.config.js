const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const htmlWebpackPlugin = require('html-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const path = require('path');

const MonacoEditorSrc = path.join(__dirname, '..', '..', 'src');

module.exports = {
  entry: './src/Editor.js',
  output: {
    path: path.join(__dirname, './dist'),
    filename: 'index.js',
  },
  module: {
    rules: [
      {
        test: /\.html$/,
        use: ['file-loader'],
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [{ loader: 'react-hot-loader/webpack' }, { loader: 'babel-loader' }]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ],
  },
  resolve: {
    extensions: ['.js', '.json'],
    alias: { 'react-monaco-editor': MonacoEditorSrc }
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.LoaderOptionsPlugin({ debug: true }),
    new webpack.SourceMapDevToolPlugin({ exclude: /node_modules/ }),
    new webpack.DefinePlugin({
      'process.env': { NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development') },
    }),
    new htmlWebpackPlugin({
      filename:'index.html',
    }),
    new UglifyJsPlugin(),
    new CopyWebpackPlugin([{
      from: 'node_modules/monaco-editor/min/vs',
      to: 'vs',
    }]),
  ],
  devServer: { contentBase: './' }
}

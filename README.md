# Smart Search Extension 🔎

[![Firefox Add-on](https://img.shields.io/amo/v/ai-smart-search)](https://addons.mozilla.org/en-US/firefox/addon/ai-smart-search/)
[![Mozilla Add-on](https://img.shields.io/amo/users/ai-smart-search)](https://addons.mozilla.org/en-US/firefox/addon/ai-smart-search/)
[![License](https://img.shields.io/github/license/JaggedGem/ai-smart-search)](LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/JaggedGem/ai-smart-search)](https://github.com/JaggedGem/ai-smart-search/issues)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Transform your search experience with AI-powered answers. Smart Search automatically redirects your questions to Perplexity AI for comprehensive, intelligent responses.

![Demo GIF](https://raw.githubusercontent.com/JaggedGem/ai-smart-search/refs/heads/main/docs/images/demo.gif)

## ⚡ Key Features

- 🎯 **Intelligent Detection**: Automatically identifies question-based searches
- 🔄 **Seamless Redirection**: Smooth transition to Perplexity AI
- 📊 **Analytics Dashboard**: Track your search patterns and time saved
- 🌓 **Theme Support**: Adapts to your browser's theme
- ⚙️ **Customizable Rules**: Fine-tune with whitelist/blacklist options
- 📑 **Multi-tab Mode**: Compare results across different sources

## 🚀 Installation

### Firefox

[![Install for Firefox](https://img.shields.io/badge/Install%20for-Firefox-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/ai-smart-search/)

### Chrome

![Coming Soon](https://img.shields.io/badge/Coming-Soon-yellow?style=for-the-badge&logo=google-chrome&logoColor=white)

Help me get a Chrome WebStore license for $5 by pressing the Sponsor button. Thank you!
Until then, you can build the extension and [Load the `dist` folder as unpacked](https://webkul.com/blog/how-to-install-the-unpacked-extension-in-chrome/) 

## 💻 Development

### Setup & Installation

First, clone the repository, then install the required dependencies:

```bash
# Cloning the repository
git clone https://github.com/JaggedGem/ai-smart-search.git
cd ai-smart-search
git checkout chrome
git pull origin chrome

# Installing dependencies
npm install
npm install -g web-ext
```

### Development Scripts

The `package.json` contains several npm scripts for development:

```json
{
  "scripts": {
    "build": "npm run lint && npm run clean && npm run copy-chrome && npm run package",
    "dev": "npm run copy-chrome && web-ext run --target=chromium --source-dir=./dist/",
    "lint": "eslint . --fix",
    "clean": "rimraf web-ext-artifacts dist/",
    "copy-chrome": "node scripts/copy-chrome.js",
    "package": "web-ext build -s dist/ -a web-ext-artifacts -o",
    "watch": "nodemon --watch src --ext js,json,html,css --exec \"npm run build\"",
    "format": "prettier --write ."
  }
}
```

#### Important Notes:

1. **Build Process**:

   - `npm run build` - Full build with linting
   - `npm run dev` - Development mode with Firefox Developer Edition(or any other Firefox based browser)
   - `npm run format` - Format code using Prettier

2. **Development Tools**:

   - ESLint for code quality (`npm run lint`)
   - Prettier for code formatting (`npm run format`)
   - web-ext for Chrome extension development

3. **File Structure**:
   - Background script: `background.js`
   - Content script: `content.js`
   - Popup UI: `popup.html` and `popup.js`

### Building for Production

Run the build script to create a production-ready extension:

```sh
npm run build
```

This will:

1. Lint the code
2. Clean previous builds
3. Create a ZIP file in `web-ext-artifacts`

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Install dependencies (`npm install`)
4. Make your changes
5. Run tests and linting (`npm run lint`)
6. Format code (`npm run format`)
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/JaggedGem/ai-smart-search/blob/main/LICENSE) file for details.

## 🙏 Acknowledgments

- Icon by [Grafixpoint - Flaticon](https://www.flaticon.com/free-icons/ss)

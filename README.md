# AI Bug Ticket Generator 🐛✨

An AI-powered web application that analyzes bug descriptions and screenshots/videos to generate comprehensive, detailed bug tickets automatically using Claude AI.

## Features

- 🤖 **AI-Powered Analysis**: Uses Anthropic's Claude to analyze bugs intelligently
- 📸 **Media Support**: Upload screenshots or videos of bugs (no size limit)
- 🎬 **Video Analysis**: Automatically extracts frames from videos for AI analysis
- 📝 **Detailed Tickets**: Generates comprehensive bug reports with all necessary fields
- 🎨 **Modern UI**: Beautiful, responsive design with Tailwind CSS
- ⚡ **Fast**: Built with Vite and React for optimal performance
- 📋 **Easy Copy**: One-click copy to clipboard functionality

## Tech Stack

- **Frontend**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **AI**: Anthropic Claude API (Sonnet 4)

## Getting Started

### Prerequisites

- Node.js 16+ installed
- npm or yarn package manager

### Installation

1. Clone or navigate to the project directory:
```bash
cd "/Users/kishanagrawal/Documents/WS-Automation/Kishan Script"
```

2. Install dependencies:
```bash
npm install
```

3. Start both backend and frontend servers:
```bash
./start-dev.sh
```

Or run them separately:
```bash
# Terminal 1 - Backend API
npm run dev:server

# Terminal 2 - Frontend
npm run dev
```

4. Open your browser and visit: `http://localhost:3000`

### Build for Production

To create a production build:

```bash
npm run build
```

The build output will be in the `dist` directory.

## Deployment Instructions

### Option 1: Deploy to Vercel (Recommended - Easiest)

1. **Install Vercel CLI** (if not already installed):
```bash
npm install -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy**:
```bash
vercel
```
   - Follow the prompts
   - Press Enter to accept defaults
   - Your site will be live in seconds!

4. **For production deployment**:
```bash
vercel --prod
```

### Option 2: Deploy to Netlify

1. **Install Netlify CLI**:
```bash
npm install -g netlify-cli
```

2. **Login to Netlify**:
```bash
netlify login
```

3. **Build the project**:
```bash
npm run build
```

4. **Deploy**:
```bash
netlify deploy --prod --dir=dist
```

### Option 3: Deploy to GitHub Pages

1. Install gh-pages:
```bash
npm install --save-dev gh-pages
```

2. Add to package.json:
```json
"homepage": "https://yourusername.github.io/your-repo-name",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

3. Update vite.config.js with base path:
```javascript
export default defineConfig({
  base: '/your-repo-name/',
  plugins: [react()],
})
```

4. Deploy:
```bash
npm run deploy
```

### Option 4: Deploy to Any Static Host

Build the project and upload the `dist` folder to any static hosting service:
- AWS S3 + CloudFront
- Google Cloud Storage
- Azure Static Web Apps
- Cloudflare Pages

## Usage

1. **Enter Bug Description**: Provide a brief description of the bug
2. **Upload Media** (Optional): Add a screenshot or video showing the bug
3. **Click Generate**: The AI will analyze and create a detailed ticket
4. **Copy & Use**: Copy the ticket to your bug tracking system

## Generated Ticket Format

The AI generates tickets with:
- Clear, concise title
- Detailed description
- Steps to reproduce
- Expected vs actual behavior
- Impact assessment
- Priority level
- Environment details
- Attachment analysis

## Security Note

⚠️ **Important**: The Anthropic API key is embedded in the code for this deployment. For production use with multiple users, consider:
- Moving the API key to environment variables
- Implementing a backend API to proxy requests
- Setting up API key rotation
- Monitoring API usage and costs

## File Structure

```
.
├── index.html              # Entry HTML file
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── postcss.config.js       # PostCSS configuration
├── vercel.json            # Vercel deployment config
├── src/
│   ├── main.jsx           # React entry point
│   ├── App.jsx            # Main application component
│   └── index.css          # Global styles with Tailwind
└── README.md              # This file
```

## Troubleshooting

### Build Errors
- Make sure Node.js version is 16 or higher
- Delete `node_modules` and run `npm install` again
- Clear Vite cache: `rm -rf node_modules/.vite`

### API Errors
- Check that the Anthropic API key is valid
- Ensure you have sufficient API credits
- Check browser console for detailed error messages

### Deployment Issues
- Ensure all dependencies are in `package.json`
- Check build output in `dist` directory
- Verify deployment platform configuration

## License

MIT License - feel free to use this project for any purpose.

## Support

For issues or questions, please check:
- Vite documentation: https://vitejs.dev/
- React documentation: https://react.dev/
- Anthropic API docs: https://docs.anthropic.com/
- Vercel deployment: https://vercel.com/docs

---

Built with ❤️ using React, Vite, and Claude AI


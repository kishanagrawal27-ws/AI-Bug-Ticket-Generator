#!/bin/bash

# AI Bug Ticket Generator - Deployment Script
# This script will help you deploy your application quickly

echo "🚀 AI Bug Ticket Generator - Deployment Script"
echo "=============================================="
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Ask user which deployment method they prefer
echo "Choose your deployment method:"
echo "1. Vercel (Recommended - Fastest & Free)"
echo "2. Netlify (Alternative - Free)"
echo "3. Build only (I'll deploy manually)"
echo "4. Test locally first"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Deploying to Vercel..."
        echo ""
        
        # Check if vercel is installed
        if ! command -v vercel &> /dev/null; then
            echo "📦 Installing Vercel CLI..."
            npm install -g vercel
        fi
        
        echo "🔐 Please login to Vercel (browser will open)..."
        vercel login
        
        echo ""
        echo "🚀 Deploying..."
        vercel --prod
        
        echo ""
        echo "✅ Deployment complete! Your site is live!"
        ;;
    2)
        echo ""
        echo "🚀 Deploying to Netlify..."
        echo ""
        
        # Check if netlify is installed
        if ! command -v netlify &> /dev/null; then
            echo "📦 Installing Netlify CLI..."
            npm install -g netlify-cli
        fi
        
        echo "🔐 Please login to Netlify (browser will open)..."
        netlify login
        
        echo "🔨 Building project..."
        npm run build
        
        echo ""
        echo "🚀 Deploying..."
        netlify deploy --prod --dir=dist
        
        echo ""
        echo "✅ Deployment complete! Your site is live!"
        ;;
    3)
        echo ""
        echo "🔨 Building project..."
        npm run build
        
        echo ""
        echo "✅ Build complete! Your files are in the 'dist' folder."
        echo ""
        echo "You can now:"
        echo "  - Upload the 'dist' folder to any static host"
        echo "  - Use services like AWS S3, GitHub Pages, etc."
        ;;
    4)
        echo ""
        echo "🔨 Starting local development server..."
        echo ""
        echo "Open http://localhost:3000 in your browser"
        echo "Press Ctrl+C to stop the server"
        echo ""
        npm run dev
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "=============================================="
echo "✨ Thank you for using AI Bug Ticket Generator!"


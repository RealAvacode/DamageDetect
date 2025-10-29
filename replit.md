# Laptop Damage Assessment App

## Overview

This is an AI-powered laptop damage assessment system that uses OpenAI's GPT-4 Vision API to analyze laptop images and provide automated quality grading. The application allows users to upload laptop images, receive detailed damage assessments with confidence scores, and manage a database of evaluated equipment. The system is designed for equipment assessment professionals, refurbishers, and organizations needing standardized laptop condition evaluation.

## Publishing to GitHub for Replit

To preview this app on Replit you first need the code available in a GitHub repository. From a local terminal inside this project:

1. Create a GitHub repository and copy its HTTPS or SSH URL.
2. Add the remote to this project, replacing the placeholder with your URL:
   ```bash
   git remote add origin https://github.com/<username>/<repo>.git
   ```
3. Confirm the remote was added correctly:
   ```bash
   git remote -v
   ```
4. Push the current branch (named `work`) to GitHub and set it as the upstream:
   ```bash
   git push -u origin work
   ```
5. Authenticate with GitHub when prompted. Once the push succeeds, Replit can import the repository and run the app.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: shadcn/ui component library with Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with custom design system and dark/light theme support
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for client-side routing
- **File Uploads**: React Dropzone for drag-and-drop image upload functionality

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints with file upload support via Multer
- **Error Handling**: Centralized error middleware with structured error responses
- **Development**: Hot module replacement via Vite middleware integration

### AI Integration
- **Provider**: OpenAI GPT-4 Vision API for image analysis
- **Assessment Logic**: Structured prompt engineering to return consistent JSON responses
- **Grading System**: Four-tier grading (A, B, C, D) with confidence scores and detailed findings
- **Processing**: Automatic image encoding to base64 for API submission

### Data Storage
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Schema**: Assessment records with laptop metadata, grades, damage descriptions, and AI analysis results
- **File Storage**: In-memory processing for images (no persistent file storage currently implemented)

### Design System
- **Typography**: Inter font family via Google Fonts
- **Color Palette**: Neutral base with semantic colors for grading (green for A, amber for B/C, red for D)
- **Layout**: Responsive grid system with consistent spacing units
- **Components**: Card-based interfaces for laptop records and assessment results
- **Accessibility**: Radix UI primitives ensure WCAG compliance

### Key Features
- **Image Upload**: Multi-file drag-and-drop interface with preview functionality
- **AI Assessment**: Automated damage detection with detailed category-based findings
- **Database Search**: Filterable laptop record database with grade-based filtering
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Theme Support**: Light/dark mode toggle with persistent preferences

## External Dependencies

### Core Technologies
- **React**: Frontend framework with hooks and functional components
- **TypeScript**: Type safety across frontend and backend
- **Tailwind CSS**: Utility-first styling framework
- **Vite**: Fast build tool and development server

### UI Components
- **shadcn/ui**: Pre-built component library
- **Radix UI**: Accessible primitive components for complex UI patterns
- **Lucide React**: Icon library for consistent iconography

### Backend Services
- **Express.js**: Web server framework
- **Multer**: File upload middleware for handling image uploads
- **OpenAI**: GPT-4 Vision API for image analysis and assessment

### Database
- **PostgreSQL**: Primary database via Neon serverless platform
- **Drizzle ORM**: Type-safe database operations and migrations
- **Neon Database**: Serverless PostgreSQL hosting

### Development Tools
- **TanStack React Query**: Server state management and caching
- **React Hook Form**: Form handling with validation
- **Wouter**: Lightweight routing library
- **ESBuild**: Fast JavaScript bundler for production builds

### File Handling
- **React Dropzone**: Drag-and-drop file upload interface
- **File API**: Browser-native file processing for image previews
# Resume Scanner Frontend

A Next.js-based web interface for the Resume Scanner application. Upload and screen resumes with AI-powered analysis.

## Features

- Resume upload and management
- Real-time resume analysis
- Candidate ranking and screening
- Integration with backend API
- Responsive UI with Tailwind CSS

## Setup

### Prerequisites

- Node.js 16+ installed
- pnpm package manager

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
pnpm install
```

3. Create `.env.local` from `.env.example`:
```bash
cp .env.example .env.local
```

4. Update `.env.local` with your backend API URL:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hr_copilot
```

5. Generate Prisma client and push database schema:
```bash
pnpm prisma:generate
pnpm prisma:push
```

## Running Locally

### Development Server

Start the development server:
```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

### Build for Production

```bash
pnpm build
pnpm start
```

## Project Structure

```
src/
├── app/              # Next.js app directory
│   ├── layout.tsx    # Root layout with header/footer
│   ├── page.tsx      # Home page
│   └── globals.css   # Global styles
├── components/       # React components
│   └── resume-uploader.tsx
├── lib/              # Utilities and API clients
│   └── api.ts        # API integration
└── types/            # TypeScript types
```

## API Integration

The frontend communicates with the backend API at the URL specified in `NEXT_PUBLIC_API_URL`. 

Key endpoints:
- `POST /api/resumes/upload` - Upload resume files
- `POST /api/analyze` - Analyze resumes against job description
- `GET /api/candidates` - Get list of candidates

## Technologies

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Prisma ORM** - Next.js server-side DB access for local API fallback

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Backend API base URL (default: http://localhost:8000)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - Google OAuth client id for frontend login
- `DATABASE_URL` - PostgreSQL connection string for Prisma Next API routes

## Troubleshooting

### CORS Issues
If you encounter CORS errors, ensure your backend is configured to allow requests from `http://localhost:3000`.

### API Connection Failed
Check that:
1. Backend server is running on the configured API URL
2. `NEXT_PUBLIC_API_URL` environment variable is set correctly
3. Network connectivity between frontend and backend

## License

ISC

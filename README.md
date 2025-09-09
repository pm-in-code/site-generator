# Prompt2Site

A production-ready Next.js 14 application that generates live websites from simple text prompts using OpenAI and deploys them to Netlify.

## Features

- 🎯 **Simple Interface**: Just type a description and get a live website
- 🚀 **Instant Deployment**: Automatic deployment to Netlify with CDN
- 🔗 **Short Links**: Generate shareable short URLs for every site
- 🛡️ **Security First**: Rate limiting, input validation, and content sanitization
- 📱 **Responsive**: Works perfectly on mobile and desktop
- ⚡ **Fast**: Built with Next.js 14 App Router and TypeScript
- 🧪 **Well Tested**: Comprehensive test suite with Vitest

## Demo

Visit a deployed site or try the example:

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Landing page for a coworking space with pricing tiers and contact form"}'
```

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **API**: OpenAI Responses API with strict JSON schema
- **Deployment**: Netlify API with file-digest method
- **Database**: SQLite with Prisma ORM
- **Validation**: Zod schemas
- **Testing**: Vitest with mocked fetch
- **Security**: Rate limiting, input sanitization

## Prerequisites

1. **OpenAI API Key**: Get one from [OpenAI Platform](https://platform.openai.com/)
2. **Netlify Account**: Sign up at [Netlify](https://netlify.com/)
3. **Node.js**: Version 18 or higher

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo>
cd prompt2site
npm install
```

### 2. Database Setup

```bash
# Generate Prisma client and create database
npm run db:generate
npm run db:push
```

### 3. Environment Configuration

Copy the environment template and fill in your values:

```bash
cp env.example .env.local
```

Edit `.env.local`:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4.1-mini

# Netlify Configuration  
NETLIFY_AUTH_TOKEN=your-netlify-pat
NETLIFY_SITE_ID=your-site-id

# Application Configuration
BASE_URL=http://localhost:3000
```

### 4. Getting Netlify Credentials

#### Netlify Personal Access Token (NETLIFY_AUTH_TOKEN)

1. Go to [Netlify User Settings](https://app.netlify.com/user/applications)
2. Click "Personal access tokens" 
3. Click "New access token"
4. Give it a name (e.g., "Prompt2Site")
5. Copy the generated token

#### Netlify Site ID (NETLIFY_SITE_ID)

**Option A: Use existing site ID**
1. Go to your [Netlify Sites](https://app.netlify.com/sites)
2. Click on any site
3. Go to Site Settings > General
4. Copy the "Site ID" (looks like: `abc123def-456g-789h-012i-jklmnop345qr`)

**Option B: Use site domain**
1. Instead of Site ID, you can use your site's domain
2. Example: `mysite.netlify.app` or `my-custom-domain.com`

### 5. Run the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

Visit [http://localhost:3000](http://localhost:3000)

## Usage

### Web Interface

1. Open the application in your browser
2. Enter a description of the website you want (1-500 characters)
3. Click "Generate Site"
4. Wait 10-30 seconds for generation and deployment
5. Get your short link and share it!

### API Usage

The application exposes a REST API:

#### Generate Site

```bash
POST /api/generate
Content-Type: application/json

{
  "prompt": "Blog about sustainable living with article grid and newsletter signup"
}
```

**Response:**
```json
{
  "shortUrl": "http://localhost:3000/s/abc123",
  "deployUrl": "https://your-site.netlify.app"
}
```

#### Health Check

```bash
GET /api/health
```

**Response:**
```json
{
  "ok": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "database": true,
    "openai": true,
    "netlify": true
  }
}
```

#### URL Redirection

```bash
GET /s/{slug}
```

Redirects to the deployed site with a 302 status.

## Rate Limits

- **Generation**: 8 requests per hour per IP address
- **Netlify Deploys**: ~3 per minute, ~100 per day (Netlify limits)

Rate limit headers are included in responses:
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp
- `Retry-After`: Seconds to wait (on 429 errors)

## Security Features

- Input validation with Zod schemas
- Content sanitization (no external scripts/styles)
- Size limits (200 KB max per site)
- Rate limiting per IP
- Safe HTML validation
- No eval() or Function() execution
- Database prepared statements

## Error Handling

The API returns user-friendly error messages:

- `MODEL_INVALID_OUTPUT`: "The generator returned an invalid site. Try a shorter or simpler prompt."
- `NETLIFY_REQUIRED_UPLOAD_FAILED`: "Couldn't upload required files. Please retry."
- `NETLIFY_DEPLOY_TIMEOUT`: "Deployment took too long. Please retry."
- `NETLIFY_AUTH`: "Netlify auth misconfigured. Check NETLIFY_AUTH_TOKEN / NETLIFY_SITE_ID."
- `RATE_LIMIT`: Returns 429 with Retry-After header

## Development

### Available Scripts

```bash
# Development
npm run dev          # Start dev server with hot reload

# Building
npm run build        # Build for production
npm start           # Start production server

# Database
npm run db:generate # Generate Prisma client
npm run db:push     # Push schema to database
npm run db:studio   # Open Prisma Studio

# Testing
npm test            # Run tests in watch mode
npm run test:run    # Run tests once
npm run test:ui     # Open test UI

# Linting
npm run lint        # Run ESLint
```

### Testing

The project includes comprehensive tests:

```bash
# Run all tests
npm run test:run

# Run tests with UI
npm run test:ui

# Watch mode for development
npm test
```

Test coverage includes:
- Slug generation and validation
- Zod schema validation
- Netlify client with mocked fetch
- URL validation utilities

### Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── api/
│   │   ├── generate/    # Main generation endpoint
│   │   └── health/      # Health check endpoint
│   ├── s/[slug]/        # Short URL redirects
│   └── page.tsx         # Main UI page
├── components/          # React components
│   ├── copy-button.tsx
│   └── status-indicator.tsx
└── lib/                 # Core logic
    ├── __tests__/       # Test files
    ├── db.ts           # Database operations
    ├── netlify.ts      # Netlify deployment client
    ├── openai.ts       # OpenAI API client
    ├── rate-limit.ts   # Rate limiting logic
    ├── utils.ts        # Utility functions
    └── validation.ts   # Zod schemas
```

## Deployment

### Environment Variables for Production

```env
OPENAI_API_KEY=sk-your-production-key
NETLIFY_AUTH_TOKEN=your-production-token
NETLIFY_SITE_ID=your-production-site-id
BASE_URL=https://your-domain.com
DATABASE_URL="file:./prisma/prod.db"
```

### Vercel Deployment

1. Push your code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Monitoring

The application includes:

- Health check endpoint (`/api/health`)
- Status indicator in UI
- Comprehensive error logging
- Rate limit monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Troubleshooting

### Common Issues

**"NETLIFY_AUTH" Error**
- Check your `NETLIFY_AUTH_TOKEN` is correct
- Verify the token has appropriate permissions
- Make sure `NETLIFY_SITE_ID` exists and is accessible

**"MODEL_INVALID_OUTPUT" Error**
- Try a shorter, simpler prompt
- Avoid complex technical requirements
- Check OpenAI API key and quota

**Rate Limit Errors**
- Wait for the rate limit to reset
- Consider implementing user accounts for higher limits

**Database Errors**
- Run `npm run db:push` to sync schema
- Check file permissions for SQLite database

### Debug Mode

Set `NODE_ENV=development` for detailed error logs.

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review error messages carefully
3. Open an issue with reproduction steps

---

Built with ❤️ using Next.js, OpenAI, and Netlify.
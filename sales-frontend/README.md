# Sales Frontend

This is the frontend application for the Sales Billit system.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Set up environment variables:
   ```
   cp .env.example .env
   ```
   Then edit the `.env` file with your actual configuration values.

3. Run the development server:
   ```
   npm run dev
   ```

## Environment Variables

The application requires certain environment variables to be configured. See `.env.example` for a complete list of required variables.

Key variables:
- `NEXT_PUBLIC_API_URL`: The URL of your backend API
- `NEXT_PUBLIC_APP_ENV`: The environment (development, staging, production)

## Development

The application uses:
- React/Next.js for the frontend framework
- TypeScript for type safety
- CSS/Tailwind for styling

## Deployment

Make sure to set the appropriate environment variables in your production environment before deploying.

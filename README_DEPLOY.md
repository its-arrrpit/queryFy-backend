# Deployment config

Set these in your production environment:

- PORT=5001
- MONGODB_URI=your_mongodb_connection_string
- GEMINI_API_KEY=your_key_optional
- ALLOWED_ORIGINS=https://query-fy.vercel.app,*.vercel.app

Wildcard support:
- Use entries like `*.vercel.app` to allow all Vercel preview URLs.
	Note: keep your production domain explicit (https://query-fy.vercel.app).


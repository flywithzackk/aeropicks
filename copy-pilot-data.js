[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[dev]
  command = "npm run build -- --watch"
  publish = "dist"
  targetPort = 5173

[[redirects]]
  from = "/api/photo/*"
  to = "/.netlify/functions/photo/:splat"
  status = 200

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

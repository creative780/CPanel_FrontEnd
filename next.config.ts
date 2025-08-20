/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Django media served from your API domain
      { protocol: 'https', hostname: 'api.click2print.store', pathname: '/media/**' },

      // CDNs you already use
      { protocol: 'https', hostname: 'storage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: 'scontent.fisb1-2.fna.fbcdn.net', pathname: '/**' },
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com', pathname: '/**' },
      { protocol: 'https', hostname: 'i.pravatar.cc', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },

      // Local dev (Django runserver)
      { protocol: 'http', hostname: '127.0.0.1', port: '8000', pathname: '/media/**' },
      { protocol: 'http', hostname: 'localhost',  port: '8000', pathname: '/media/**' },

      // Local dev if you test via Gunicorn on 8001
      { protocol: 'http', hostname: '127.0.0.1', port: '8001', pathname: '/media/**' },
      { protocol: 'http', hostname: 'localhost',  port: '8001', pathname: '/media/**' },
    ],
  },
};

export default nextConfig;